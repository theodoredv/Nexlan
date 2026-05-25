
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { FileItem } from '../../shared/types';
import { createLogger } from '../logger.js';
import { createSSEManager } from '../sse.js';
import { db } from '../database.js';
import { uploadsDir, chunksDir, thumbnailsDir, ensureDir, extToMime } from '../config.js';

const log = createLogger('files');
const sse = createSSEManager('files');

const allowedDirs = [
  path.resolve(uploadsDir),
  path.resolve(thumbnailsDir),
];

function isPathSafe(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return allowedDirs.some((dir) => resolved.startsWith(dir + path.sep) || resolved === dir);
}

const router = express.Router();

ensureDir(uploadsDir);
ensureDir(chunksDir);
ensureDir(thumbnailsDir);

const chunkStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, chunksDir);
  },
  filename: (_req, _file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `chunk-${uniqueSuffix}`);
  },
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

function parseSizeString(str: string): number {
  const match = str.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)?$/i);
  if (!match) return 10 * 1024 * 1024;
  const value = parseFloat(match[1]);
  const unit = (match[2] || 'b').toLowerCase();
  const multipliers: Record<string, number> = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 };
  return Math.floor(value * (multipliers[unit] || 1));
}

const UPLOAD_LIMIT_BYTES = parseSizeString(process.env.UPLOAD_LIMIT || '10mb');
const CHUNK_SIZE_BYTES = 20 * 1024 * 1024;
const CHUNK_UPLOAD_LIMIT = Math.max(UPLOAD_LIMIT_BYTES, CHUNK_SIZE_BYTES + 1024 * 1024);

const upload = multer({ storage, limits: { fileSize: UPLOAD_LIMIT_BYTES } });
const chunkUpload = multer({ storage: chunkStorage, limits: { fileSize: CHUNK_UPLOAD_LIMIT } });

const files: Map<string, FileItem & { path: string; thumbnailPath?: string }> = new Map();
const fileMd5Map: Map<string, string> = new Map();

const upsertMd5Stmt = db.prepare('INSERT INTO file_md5_index (md5, file_id) VALUES (?, ?) ON CONFLICT(md5) DO UPDATE SET file_id = excluded.file_id');
const deleteMd5ByFileIdStmt = db.prepare('DELETE FROM file_md5_index WHERE file_id = ?');

function loadFileIndex() {
  try {
    const rows = db.prepare('SELECT md5, file_id FROM file_md5_index').all() as Array<{
      md5: string;
      file_id: string;
    }>;
    for (const row of rows) {
      if (files.has(row.file_id)) {
        fileMd5Map.set(row.md5, row.file_id);
      }
    }
    log.info(`Loaded ${fileMd5Map.size} file MD5 index entries from database`);
  } catch (error) {
    log.error('Failed to load file index:', error);
  }
}

function generateThumbnail(filePath: string, fileId: string): Promise<string> {
  return new Promise((resolve) => {
    const thumbnailPath = path.join(thumbnailsDir, `${fileId}.jpg`);
    const args = ['-i', filePath, '-ss', '0.1', '-vframes', '1', '-s', '200x200', thumbnailPath];
    
    execFile('ffmpeg', args, (error, _stdout, stderr) => {
      if (error) {
        log.error(`Thumbnail generation failed for ${fileId}:`, error);
        log.debug(`FFmpeg stderr: ${stderr}`);
        resolve(filePath);
      } else {
        log.info(`Thumbnail generated: ${thumbnailPath}`);
        resolve(thumbnailPath);
      }
    });
  });
}

function isVideoFile(fileName: string): boolean {
  const videoExts = ['.mp4', '.webm', '.ogg', '.mov', '.mkv'];
  const ext = path.extname(fileName).toLowerCase();
  return videoExts.includes(ext);
}

function sanitizeFile<T extends FileItem & { path?: string; thumbnailPath?: string }>(file: T): FileItem {
  const { path: _p, thumbnailPath: _t, ...rest } = file;
  return rest;
}

async function loadFilesFromDisk(): Promise<void> {
  const entries = await fs.promises.readdir(uploadsDir);
  for (const filename of entries) {
    const filePath = path.join(uploadsDir, filename);
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) continue;
    const parts = filename.split('-');
    const id = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : Date.now().toString();
    const originalName = parts.length >= 2 ? parts.slice(2).join('-') : filename;
    
    const thumbnailPath = path.join(thumbnailsDir, `${id}.jpg`);
    const fileItem: FileItem & { path: string; thumbnailPath?: string } = {
      id,
      name: originalName,
      size: stat.size,
      type: extToMime(filename),
      uploadedAt: stat.mtime.toISOString(),
      path: filePath,
    };
    
    try {
      await fs.promises.access(thumbnailPath);
      fileItem.thumbnailPath = thumbnailPath;
    } catch {
      // no thumbnail
    }
    
    files.set(id, fileItem);
  }
}

await loadFilesFromDisk();

log.info(`Loaded ${files.size} files from disk`);
loadFileIndex();

router.get('/', (_req, res) => {
  const fileList = Array.from(files.values()).map(sanitizeFile);
  res.json(fileList);
});

router.post('/check-file', (req, res) => {
  const { md5, size } = req.body;
  const fileId = fileMd5Map.get(md5);
  
  if (fileId && files.has(fileId)) {
    const file = files.get(fileId)!;
    if (file.size === size) {
      log.debug(`File exists (instant upload): ${file.name}`);
      return res.json({ exists: true, file: sanitizeFile(file) });
    }
  }
  
  const chunkFiles = fs.existsSync(chunksDir) 
    ? fs.readdirSync(chunksDir).filter(f => f.startsWith(md5 + '-'))
    : [];
  const uploadedChunks = chunkFiles.map(f => parseInt(f.split('-')[1])).sort((a, b) => a - b);
  
  log.debug(`Check file: md5=${md5}, uploadedChunks=${uploadedChunks.length}`);
  res.json({ exists: false, uploadedChunks });
});

router.post('/upload-chunk', chunkUpload.single('chunk'), (req, res) => {
  const { md5, chunkIndex, totalChunks, fileId } = req.body;
  
  if (req.file && md5 && chunkIndex) {
    const chunkPath = path.join(chunksDir, `${md5}-${chunkIndex}`);
    
    try {
      ensureDir(chunksDir);
      
      const chunkData = fs.readFileSync(req.file.path);
      fs.writeFileSync(chunkPath, chunkData);
      log.debug(`Chunk saved: ${chunkPath}`);
      
      fs.unlinkSync(req.file.path);
      
      if (fileId && totalChunks) {
        log.debug(`Broadcasting chunk ${chunkIndex}/${totalChunks} for file ${fileId}`);
        
        sse.broadcast({ type: 'upload-chunk', fileId, chunkIndex, totalChunks });
      }
    } catch (error) {
      log.error('Failed to save chunk:', error);
      return res.status(500).json({ error: 'Failed to save chunk' });
    }
  } else {
    log.error('Upload chunk missing required parameters');
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  
  res.json({ success: true });
});

router.post('/upload-start', (req, res) => {
  const { files: uploadFiles } = req.body;
  
  if (uploadFiles && Array.isArray(uploadFiles)) {
    log.info(`Upload start: ${uploadFiles.map((f: { name: string }) => f.name).join(', ')}`);
    
    sse.broadcast({ type: 'upload-start', files: uploadFiles });
    
    res.json({ success: true });
  } else {
    log.error('Upload start missing files parameter');
    res.status(400).json({ error: 'Missing files parameter' });
  }
});

router.post('/merge-chunks', async (req, res) => {
  const { md5, fileName, fileSize, fileType, totalChunks } = req.body;
  
  if (!fileName || fileName.length > 255) {
    return res.status(400).json({ error: 'Invalid file name' });
  }
  const total = parseInt(totalChunks);
  if (isNaN(total) || total < 1 || total > 10000) {
    return res.status(400).json({ error: 'Invalid total chunks' });
  }
  
  try {
    const id = Date.now().toString() + '-' + Math.round(Math.random() * 1e9);
    const outputPath = path.join(uploadsDir, `${id}-${fileName}`);
    log.info(`Merging ${total} chunks for: ${fileName}`);
    const writeStream = fs.createWriteStream(outputPath);
    
    for (let i = 0; i < total; i++) {
      const chunkPath = path.join(chunksDir, `${md5}-${i}`);
      if (!fs.existsSync(chunkPath)) {
        writeStream.destroy();
        return res.status(400).json({ error: `Chunk ${i} missing` });
      }
      await new Promise<void>((resolve, reject) => {
        const chunkStream = fs.createReadStream(chunkPath);
        chunkStream.on('end', () => {
          fs.promises.unlink(chunkPath).catch(() => {});
          resolve();
        });
        chunkStream.on('error', reject);
        chunkStream.pipe(writeStream, { end: false });
      });
    }
    
    await new Promise<void>((resolve, reject) => {
      writeStream.end();
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    
    const fileItem: FileItem & { path: string; thumbnailPath?: string } = {
      id,
      name: fileName,
      size: parseInt(fileSize) || 0,
      type: fileType || extToMime(fileName),
      uploadedAt: new Date().toISOString(),
      path: outputPath,
    };
    
    if (isVideoFile(fileName)) {
      try {
        const thumbnailPath = await generateThumbnail(outputPath, id);
        fileItem.thumbnailPath = thumbnailPath;
        log.info(`Video thumbnail generated for: ${fileName}`);
      } catch (error) {
        log.warn(`Failed to generate thumbnail for ${fileName}:`, error);
      }
    }
    
    files.set(id, fileItem);
    fileMd5Map.set(md5, id);
    upsertMd5Stmt.run(md5, id);
    
    log.info(`File merged and saved: ${fileName} (${fileItem.size} bytes), broadcasting to ${sse.getClientCount()} clients`);
    
    const fileToBroadcast = sanitizeFile(fileItem);
    
    sse.broadcast({ type: 'upload', files: [fileToBroadcast] });
    
    res.json({ file: fileToBroadcast });
  } catch (error) {
    log.error('Merge chunks failed:', error);
    res.status(500).json({ error: 'Failed to merge chunks' });
  }
});

router.post('/upload', upload.array('files'), (req, res) => {
  if (!req.files || !Array.isArray(req.files)) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const uploadedFiles: FileItem[] = [];
  req.files.forEach((file) => {
    const parts = file.filename.split('-');
    const id = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : file.filename;
    const originalName = parts.length >= 2 ? parts.slice(2).join('-') || file.originalname : file.originalname;
    const fileItem: FileItem & { path: string } = {
      id,
      name: originalName,
      size: file.size,
      type: file.mimetype,
      uploadedAt: new Date().toISOString(),
      path: file.path,
    };
    files.set(id, fileItem);
    uploadedFiles.push(sanitizeFile(fileItem));
  });

  log.info(`Simple upload: ${uploadedFiles.map(f => f.name).join(', ')}`);

  sse.broadcast({ type: 'upload', files: uploadedFiles });

  res.json(uploadedFiles);
});

router.get('/stream', (req, res) => {
  sse.addClient(req, res);
});

router.get('/:id/preview', (req, res) => {
  const file = files.get(req.params.id);
  if (!file || !isPathSafe(file.path)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.sendFile(file.path);
});

router.get('/:id/thumbnail', (req, res) => {
  const file = files.get(req.params.id);
  if (!file || !isPathSafe(file.path)) {
    return res.status(404).json({ error: 'File not found' });
  }

  if (file.thumbnailPath && fs.existsSync(file.thumbnailPath) && isPathSafe(file.thumbnailPath)) {
    res.sendFile(file.thumbnailPath);
  } else {
    res.sendFile(file.path);
  }
});

router.get('/:id/download', (req, res) => {
  const file = files.get(req.params.id);
  if (!file || !isPathSafe(file.path)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(file.path, file.name);
});

router.delete('/:id', (req, res) => {
  const file = files.get(req.params.id);
  if (!file || !isPathSafe(file.path)) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    fs.unlinkSync(file.path);
    files.delete(req.params.id);
    
    for (const [md5, fid] of fileMd5Map) {
      if (fid === req.params.id) {
        fileMd5Map.delete(md5);
      }
    }
    deleteMd5ByFileIdStmt.run(req.params.id);
    
    sse.broadcast({ type: 'delete', fileId: req.params.id });
    
    log.info(`File deleted: ${file.name} (${req.params.id})`);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export { router, files };
