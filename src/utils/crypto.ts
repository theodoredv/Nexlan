import SparkMD5 from 'spark-md5';

const MD5_CHUNK_SIZE = 8 * 1024 * 1024; // 8MB（原为2MB，加大减少手机端读取次数）

async function calculateMD5MainThread(file: File, onProgress?: (progress: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const chunkSize = MD5_CHUNK_SIZE;
    const chunks = Math.ceil(file.size / chunkSize);
    let currentChunk = 0;
    const spark = new SparkMD5.ArrayBuffer();

    reader.onload = function (e) {
      spark.append(e.target?.result as ArrayBuffer);
      currentChunk++;
      
      if (onProgress) {
        onProgress(currentChunk / chunks);
      }
      
      if (currentChunk < chunks) {
        loadNext();
      } else {
        resolve(spark.end());
      }
    };

    reader.onerror = function () {
      reject(new Error('Failed to calculate MD5'));
    };

    function loadNext() {
      const start = currentChunk * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      reader.readAsArrayBuffer(file.slice(start, end));
    }

    loadNext();
  });
}

async function calculateMD5WithWorker(file: File, onProgress?: (progress: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(new URL('./md5.worker.ts', import.meta.url), {
        type: 'module'
      });

      const chunkSize = MD5_CHUNK_SIZE;
      const chunks = Math.ceil(file.size / chunkSize);
      let currentChunk = 0;
      const reader = new FileReader();

      worker.onmessage = function (e) {
        const { type, progress, md5 } = e.data;
        
        if (type === 'progress' && onProgress) {
          onProgress(progress);
        } else if (type === 'result') {
          worker.terminate();
          resolve(md5);
        }
      };

      worker.onerror = function (error) {
        worker.terminate();
        reject(new Error('Worker error: ' + error.message));
      };

      reader.onload = function (e) {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        
        worker.postMessage({
          type: 'chunk',
          chunk: arrayBuffer,
          chunks,
          currentChunk: currentChunk + 1
        });

        currentChunk++;
        
        if (currentChunk < chunks) {
          loadNext();
        } else {
          worker.postMessage({ type: 'finish' });
        }
      };

      reader.onerror = function () {
        worker.terminate();
        reject(new Error('Failed to read file'));
      };

      function loadNext() {
        const start = currentChunk * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        reader.readAsArrayBuffer(file.slice(start, end));
      }

      worker.postMessage({ type: 'init' });
      loadNext();
    } catch (error) {
      reject(new Error('Failed to create worker: ' + (error as Error).message));
    }
  });
}

export async function calculateMD5(file: File, onProgress?: (progress: number) => void): Promise<string> {
  try {
    return await calculateMD5WithWorker(file, onProgress);
  } catch (error) {
    console.warn('[calculateMD5] Web Worker failed, falling back to main thread:', error);
    return await calculateMD5MainThread(file, onProgress);
  }
}

// 缓存已计算的 MD5
export const md5Cache = new Map<string, string>();

export async function calculateMD5WithCache(file: File, onProgress?: (progress: number) => void): Promise<string> {
  const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
  
  if (md5Cache.has(fileKey)) {
    return md5Cache.get(fileKey)!;
  }
  
  const md5 = await calculateMD5(file, onProgress);
  md5Cache.set(fileKey, md5);
  return md5;
}

