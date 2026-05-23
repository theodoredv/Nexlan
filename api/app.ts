
import express, {
  type Request,
  type Response,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { router as filesRouter } from './routes/files'
import { router as messagesRouter } from './routes/messages'
import { router as networkRouter } from './routes/network'
import { router as deviceNamesRouter } from './routes/deviceNames'
import { getSSEStats } from './sse'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOAD_LIMIT = process.env.UPLOAD_LIMIT || '10mb'
const isProduction = process.env.NODE_ENV === 'production'
const projectRoot = path.join(__dirname, '..')

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: UPLOAD_LIMIT }))
app.use(express.urlencoded({ extended: true, limit: UPLOAD_LIMIT }))

app.use('/api/files', filesRouter)
app.use('/api/messages', messagesRouter)
app.use('/api/network', networkRouter)
app.use('/api/device-names', deviceNamesRouter)

app.use(
  '/api/health',
  (_req: Request, res: Response): void => {
    const dataDir = path.join(projectRoot, 'data');
    const uploadsDir = path.join(projectRoot, 'uploads');

    function getDirSize(dir: string): number {
      if (!fs.existsSync(dir)) return 0;
      return fs.readdirSync(dir).reduce((size, file) => {
        const stats = fs.statSync(path.join(dir, file));
        return size + (stats.isFile() ? stats.size : 0);
      }, 0);
    }

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
      disk: {
        data: `${Math.round(getDirSize(dataDir) / 1024 / 1024)}MB`,
        uploads: `${Math.round(getDirSize(uploadsDir) / 1024 / 1024)}MB`,
      },
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

app.use((_error: Error, _req: Request, res: Response, _next: () => void) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

export default app
