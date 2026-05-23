
import express from 'express';
import os from 'os';
import { NetworkInfo } from '../../shared/types';

const router = express.Router();

function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) {
        return alias.address;
      }
    }
  }
  return '127.0.0.1';
}

router.get('/', (req, res) => {
  const ip = getLocalIP();
  let port = parseInt(process.env.PORT || '34567');
  let url = `http://${ip}:${port}`;

  // 检查反向代理头信息
  if (req.headers['x-forwarded-host']) {
    const forwardedHost = req.headers['x-forwarded-host'] as string;
    const forwardedProto = (req.headers['x-forwarded-proto'] as string) || 'http';
    
    // 从X-Forwarded-Host中提取端口
    const hostParts = forwardedHost.split(':');
    if (hostParts.length > 1) {
      port = parseInt(hostParts[1], 10);
    }
    
    url = `${forwardedProto}://${forwardedHost}`;
  }

  const info: NetworkInfo = {
    ip,
    port,
    url,
  };
  res.json(info);
});

export { router };
