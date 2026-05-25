
import express, {
  type Request,
  type Response,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { router as filesRouter } from './routes/files'
import { router as messagesRouter } from './routes/messages'
import { router as networkRouter } from './routes/network'
import { router as deviceNamesRouter } from './routes/deviceNames'
import { getSSEStats } from './sse'
import { projectRoot, dataDir, uploadsDir } from './config.js'
import { createLogger } from './logger.js'

const log = createLogger('app')

dotenv.config()

const UPLOAD_LIMIT = process.env.UPLOAD_LIMIT || '10mb'
const isProduction = process.env.NODE_ENV === 'production'

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: UPLOAD_LIMIT }))
app.use(express.urlencoded({ extended: true, limit: UPLOAD_LIMIT }))

app.use('/api/files', filesRouter)
app.use('/api/messages', messagesRouter)
app.use('/api/network', networkRouter)
app.use('/api/device-names', deviceNamesRouter)

let diskCache = { data: '0MB', uploads: '0MB', updatedAt: 0 };

async function getDirSizeRecursive(dir: string): Promise<number> {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    let totalSize = 0;
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile()) {
        const stats = await fs.promises.stat(fullPath);
        totalSize += stats.size;
      } else if (entry.isDirectory()) {
        totalSize += await getDirSizeRecursive(fullPath);
      }
    }
    return totalSize;
  } catch {
    return 0;
  }
}

async function updateDiskCache() {
  const [dataSize, uploadsSize] = await Promise.all([
    getDirSizeRecursive(dataDir),
    getDirSizeRecursive(uploadsDir),
  ]);
  diskCache = {
    data: `${Math.round(dataSize / 1024 / 1024)}MB`,
    uploads: `${Math.round(uploadsSize / 1024 / 1024)}MB`,
    updatedAt: Date.now(),
  };
}
setInterval(updateDiskCache, 30000);
updateDiskCache();

app.use(
  '/api/health',
  async (_req: Request, res: Response): Promise<void> => {
    const memUsage = process.memoryUsage();

    res.status(200).json({
      success: true,
      message: 'ok',
      uptime: Math.floor(process.uptime()),
      memory: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      },
      disk: diskCache,
      sse: getSSEStats(),
    });
  },
);

if (isProduction) {
  const distDir = path.join(projectRoot, 'dist');

  app.use(express.static(distDir));

  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

app.use((error: Error, _req: Request, res: Response, _next: () => void) => {
  log.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

export default app
