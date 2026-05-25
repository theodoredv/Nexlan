import { FileItem } from '../../../shared/types';
import { uploadConfig } from '../../config/upload';
import { API_BASE, fetchWithTimeout, waitForServer } from './index';

const CHUNK_SIZE = uploadConfig.chunkSize;
const CONCURRENT_CHUNKS = uploadConfig.concurrentChunks;
const TIMEOUT = uploadConfig.timeout;

export async function getFiles(): Promise<FileItem[]> {
  const res = await fetch(`${API_BASE}/files`);
  if (!res.ok) throw new Error('Failed to get files');
  return res.json();
}

export async function checkFileExists(md5: string, size: number, signal?: AbortSignal): Promise<{ exists: boolean; file?: FileItem; uploadedChunks?: number[] }> {
  const res = await fetchWithTimeout(`${API_BASE}/files/check-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ md5, size }),
    signal,
  });
  if (!res.ok) throw new Error('Failed to check file');
  return res.json();
}

export async function uploadChunk(md5: string, chunk: Blob, chunkIndex: number, totalChunks: number, fileName: string, fileSize: number, fileType: string, fileId: string, signal?: AbortSignal): Promise<void> {
  const formData = new FormData();
  formData.append('chunk', chunk);
  formData.append('md5', md5);
  formData.append('chunkIndex', chunkIndex.toString());
  formData.append('totalChunks', totalChunks.toString());
  formData.append('fileName', fileName);
  formData.append('fileSize', fileSize.toString());
  formData.append('fileType', fileType);
  formData.append('fileId', fileId);

  const res = await fetchWithTimeout(`${API_BASE}/files/upload-chunk`, {
    method: 'POST',
    body: formData,
    signal,
  });
  if (!res.ok) throw new Error('Failed to upload chunk');
}

export async function sendUploadStart(files: { id: string; name: string; size: number; type: string; uploadedAt: string; status: string; progress: number }[], signal?: AbortSignal): Promise<void> {
  const res = await fetchWithTimeout(`${API_BASE}/files/upload-start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
    signal,
  });
  if (!res.ok) throw new Error('Failed to send upload start event');
}

export async function mergeChunks(md5: string, fileName: string, fileSize: number, fileType: string, totalChunks: number, signal?: AbortSignal): Promise<FileItem> {
  const res = await fetchWithTimeout(`${API_BASE}/files/merge-chunks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ md5, fileName, fileSize, fileType, totalChunks }),
    signal,
  });
  if (!res.ok) throw new Error('Failed to merge chunks');
  const data = await res.json();
  return data.file;
}

export async function uploadFiles(
  files: File[],
  onProgress?: (progress: number, fileName: string) => void,
  fileIds?: string[],
  signal?: AbortSignal
): Promise<FileItem[]> {
  const { calculateMD5WithCache } = await import('../crypto');
  const uploadedFiles: FileItem[] = [];

  if (fileIds && fileIds.length > 0) {
    const uploadStartFiles = files.map((file, index) => ({
      id: fileIds[index],
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
      status: 'uploading',
      progress: 0
    }));
    try {
      await sendUploadStart(uploadStartFiles, signal);
    } catch (error) {
      if (signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError');
      console.error('[uploadFiles] Failed to send upload start event:', error);
    }
  }

  for (const [index, file] of files.entries()) {
    if (signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError');

    try {
      let md5: string;
      try {
        md5 = await Promise.race([
          calculateMD5WithCache(file, (progress) => {
            if (onProgress) {
              onProgress(Math.round(progress * 10), file.name);
            }
          }),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error('MD5计算超时，跳过秒传检测')), TIMEOUT)
          ),
        ]);
      } catch {
        if (signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError');
        console.warn('[uploadFiles] MD5 calculation failed, uploading without dedup');
        md5 = `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      const checkResult = await checkFileExists(md5, file.size, signal);

      if (checkResult.exists && checkResult.file) {
        uploadedFiles.push(checkResult.file);
        if (onProgress) onProgress(100, file.name);
        continue;
      }

      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

      const uploadedChunks = new Set(checkResult.uploadedChunks || []);

      let uploadedCount = uploadedChunks.size;
      const uploadedChunksSet = new Set(uploadedChunks);
      const fileId = fileIds ? fileIds[index] : `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const uploadChunkWithProgress = async (chunkIndex: number) => {
        if (signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError');
        if (uploadedChunksSet.has(chunkIndex)) return;

        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        await uploadChunk(md5, chunk, chunkIndex, totalChunks, file.name, file.size, file.type, fileId, signal);

        uploadedCount++;
        uploadedChunksSet.add(chunkIndex);

        if (onProgress) {
          const progress = Math.round(10 + (uploadedCount / totalChunks) * 90);
          onProgress(progress, file.name);
        }
      };

      const chunksToUpload = [];
      for (let i = 0; i < totalChunks; i++) {
        if (!uploadedChunks.has(i)) {
          chunksToUpload.push(i);
        }
      }

      for (let i = 0; i < chunksToUpload.length; i += CONCURRENT_CHUNKS) {
        if (signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError');
        const batch = chunksToUpload.slice(i, i + CONCURRENT_CHUNKS);
        await Promise.all(batch.map(uploadChunkWithProgress));
      }

      const mergedFile = await mergeChunks(md5, file.name, file.size, file.type, totalChunks, signal);
      uploadedFiles.push(mergedFile);
    } catch (error) {
      if (signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError');
      console.error('[uploadFiles] Error uploading file:', file.name, error);
      throw error;
    }
  }

  return uploadedFiles;
}

export async function downloadFile(id: string, name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/files/${id}/download`);
  if (!res.ok) throw new Error('Failed to download file');
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export async function deleteFile(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/files/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete file');
}

export function subscribeToFiles(
  onUpload: (files: FileItem[]) => void,
  onDelete: (fileId: string) => void,
  onUploadStart?: (files: FileItem[]) => void,
  onUploadChunk?: (fileId: string, chunkIndex: number, totalChunks: number) => void,
  onReconnect?: () => void
): () => void {
  let closed = false;
  let currentES: EventSource | null = null;
  let delay = 1000;
  const maxDelay = 30000;
  let lastEventId = '';

  function connect() {
    if (closed) return;

    const url = lastEventId
      ? `${API_BASE}/files/stream?lastEventId=${lastEventId}`
      : `${API_BASE}/files/stream`;
    const es = new EventSource(url);
    currentES = es;

    es.onopen = () => {
      delay = 1000;
    };

    es.onmessage = (event) => {
      if (event.lastEventId) lastEventId = event.lastEventId;
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (data.type === 'upload') {
        onUpload(data.files);
      } else if (data.type === 'delete') {
        onDelete(data.fileId);
      } else if (data.type === 'upload-start' && onUploadStart) {
        onUploadStart(data.files);
      } else if (data.type === 'upload-chunk' && onUploadChunk) {
        onUploadChunk(data.fileId, parseInt(data.chunkIndex), parseInt(data.totalChunks));
      }
    };

    es.onerror = () => {
      es.close();
      currentES = null;
      if (closed) return;

      if (onReconnect) onReconnect();
      delay = Math.min(delay * 2, maxDelay);
      setTimeout(async () => {
        await waitForServer();
        connect();
      }, delay);
    };
  }

  connect();

  return () => {
    closed = true;
    if (currentES) {
      currentES.close();
      currentES = null;
    }
  };
}
