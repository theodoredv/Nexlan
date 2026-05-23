#!/usr/bin/env node

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createLogger } from './api/logger.js';

const log = createLogger('proxy');

const app = express();
const PORT = 8080;

app.use('/api', createProxyMiddleware({
  target: 'http://localhost:34567',
  changeOrigin: true,
  onError: (_err, _req, res) => {
    res.status(500).send('Backend service not running');
  }
}));

app.use('/', createProxyMiddleware({
  target: 'http://localhost:5175',
  changeOrigin: true,
  onError: (_err, _req, res) => {
    res.status(500).send('Frontend dev server not running');
  }
}));

app.listen(PORT, () => {
  log.info('Reverse proxy started');
  console.log(`
==================================
  Reverse proxy started
==================================
  URL: http://localhost:${PORT}
  Frontend: http://localhost:${PORT} -> http://localhost:5175
  Backend:  http://localhost:${PORT}/api -> http://localhost:34567/api
==================================
  Press Ctrl+C to stop
==================================`);
});
