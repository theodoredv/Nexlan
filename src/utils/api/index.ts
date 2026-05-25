import { uploadConfig } from '../../config/upload';

export const API_BASE = '/api';
const TIMEOUT = uploadConfig.timeout;

export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let onAbort: (() => void) | null = null;
  if (options.signal) {
    onAbort = () => controller.abort();
    options.signal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
    if (onAbort && options.signal) {
      options.signal.removeEventListener('abort', onAbort);
    }
  }
}

async function isServerAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function waitForServer(maxWait = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    if (await isServerAvailable()) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

export { getFiles, checkFileExists, uploadChunk, sendUploadStart, mergeChunks, uploadFiles, downloadFile, deleteFile, subscribeToFiles } from './files';
export { getMessages, sendMessage, subscribeToMessages, deleteMessage, deleteMessagesBatch, updateMessageSender } from './messages';
export { getNetworkInfo, getDeviceName, setDeviceName, getHealthInfo } from './network';
export type { HealthInfo } from './network';
