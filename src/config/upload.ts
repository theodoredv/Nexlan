// 上传配置

// 默认配置（适合局域网）
export const uploadConfig = {
  // 分片大小（字节）
  chunkSize: 20 * 1024 * 1024, // 20MB for LAN
  
  // 并发上传数
  concurrentChunks: 6, // 6 concurrent chunks for LAN
  
  // 重试次数
  maxRetries: 3,
  
  // 重试间隔（毫秒）
  retryInterval: 1000,
  
  // 超时时间（毫秒）
  timeout: 30000,
};

export default uploadConfig;
