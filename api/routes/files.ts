
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { FileItem } from '../../shared/types';
import { createLogger } from '../logger.js';
import { createSSEManager } from '../sse.js';

const log = createLogger('files');
const sse = createSSEManager('files');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '../..');

const allowedDirs = [
  path.resolve(path.join(projectRoot, 'uploads')),
  path.resolve(path.join(projectRoot, 'thumbnails')),
];

function isPathSafe(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return allowedDirs.some((dir) => resolved.startsWith(dir + path.sep) || resolved === dir);
}

const router = express.Router();

const uploadsDir = path.join(projectRoot, 'uploads');
const chunksDir = path.join(projectRoot, 'chunks');
const thumbnailsDir = path.join(projectRoot, 'thumbnails');
const dataDir = path.join(projectRoot, 'data');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(chunksDir)) {
  fs.mkdirSync(chunksDir, { recursive: true });
}
if (!fs.existsSync(thumbnailsDir)) {
  fs.mkdirSync(thumbnailsDir, { recursive: true });
}
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

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

const indexFilePath = path.join(dataDir, 'files-index.json');
function saveFileIndex() {
  try {
    const obj: Record<string, string> = {};
    fileMd5Map.forEach((fileId, md5) => { obj[md5] = fileId; });
    fs.writeFileSync(indexFilePath, JSON.stringify(obj, null, 2));
  } catch (error) {
    log.error('Failed to save file index:', error);
  }
}
function loadFileIndex() {
  try {
    if (fs.existsSync(indexFilePath)) {
      const raw = fs.readFileSync(indexFilePath, 'utf-8');
      const obj = JSON.parse(raw);
      Object.entries(obj).forEach(([md5, fileId]) => {
        if (files.has(fileId as string)) {
          fileMd5Map.set(md5, fileId as string);
        }
      });
      log.info(`Loaded ${fileMd5Map.size} file MD5 index entries`);
    }
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

fs.readdirSync(uploadsDir).forEach((filename) => {
  const filePath = path.join(uploadsDir, filename);
  const stat = fs.statSync(filePath);
  const parts = filename.split('-');
  const id = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : Date.now().toString();
  const originalName = parts.length >= 2 ? parts.slice(2).join('-') : filename;
  
  const thumbnailPath = path.join(thumbnailsDir, `${id}.jpg`);
  const fileItem: FileItem & { path: string; thumbnailPath?: string } = {
    id,
    name: originalName,
    size: stat.size,
    type: path.extname(filename) || 'application/octet-stream',
    uploadedAt: stat.mtime.toISOString(),
    path: filePath,
  };
  
  if (fs.existsSync(thumbnailPath)) {
    fileItem.thumbnailPath = thumbnailPath;
  }
  
  files.set(id, fileItem);
});

log.info(`Loaded ${files.size} files from disk`);
loadFileIndex();

router.get('/', (_req, res) => {
  const fileList = Array.from(files.values()).map(({ path: _p, ...item }) => item);
  res.json(fileList);
});

router.post('/check-file', (req, res) => {
  const { md5, size } = req.body;
  const fileId = fileMd5Map.get(md5);
  
  if (fileId && files.has(fileId)) {
    const file = files.get(fileId)!;
    if (file.size === size) {
      log.debug(`File exists (instant upload): ${file.name}`);
      return res.json({ exists: true, file: { ...file, path: undefined } });
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
      if (!fs.existsSync(chunksDir)) {
        fs.mkdirSync(chunksDir, { recursive: true });
      }
      
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
  
  try {
    const id = Date.now().toString() + '-' + Math.round(Math.random() * 1e9);
    const outputPath = path.join(uploadsDir, `${id}-${fileName}`);
    log.info(`Merging ${totalChunks} chunks for: ${fileName}`);
    const writeStream = fs.createWriteStream(outputPath);
    
    for (let i = 0; i < parseInt(totalChunks); i++) {
      const chunkPath = path.join(chunksDir, `${md5}-${i}`);
      if (!fs.existsSync(chunkPath)) {
        log.error(`Chunk ${i} missing for ${fileName}`);
        return res.status(400).json({ error: `Chunk ${i} missing` });
      }
      
      const chunkData = fs.readFileSync(chunkPath);
      writeStream.write(chunkData);
      fs.unlinkSync(chunkPath);
    }
    
    await new Promise<void>((resolve, reject) => {
      writeStream.end();
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    
    const fileItem: FileItem & { path: string; thumbnailPath?: string } = {
      id,
      name: fileName,
      size: parseInt(fileSize),
      type: fileType,
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
    saveFileIndex();
    
    log.info(`File merged and saved: ${fileName} (${fileItem.size} bytes), broadcasting to ${sse.getClientCount()} clients`);
    
    const fileToBroadcast = { ...fileItem, path: undefined };
    
    sse.broadcast({ type: 'upload', files: [fileToBroadcast] });
    
    res.json({ file: { ...fileItem, path: undefined } });
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
    const id = file.filename.split('-')[0];
    const originalName = file.filename.split('-').slice(1).join('-') || file.originalname;
    const fileItem: FileItem & { path: string } = {
      id,
      name: originalName,
      size: file.size,
      type: file.mimetype,
      uploadedAt: new Date().toISOString(),
      path: file.path,
    };
    files.set(id, fileItem);
    uploadedFiles.push(fileItem);
  });

  log.info(`Simple upload: ${uploadedFiles.map(f => f.name).join(', ')}`);

  sse.broadcast({ type: 'upload', files: uploadedFiles });

  res.json(uploadedFiles);
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
    saveFileIndex();
    
    sse.broadcast({ type: 'delete', fileId: req.params.id });
    
    log.info(`File deleted: ${file.name} (${req.params.id})`);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

router.get('/stream', (req, res) => {
  sse.addClient(req, res);
});

export { router, files };
