
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const clientPort = parseInt(env.VITE_CLIENT_PORT) || 5175;
  const serverPort = parseInt(env.PORT) || 34567;

  return {
    plugins: [
      react(),
      tsconfigPaths(),
    ],
    server: {
      host: '0.0.0.0',
      port: clientPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
          secure: false,
          proxyTimeout: 5 * 60 * 1000, // 代理等待后端响应的超时时间
          timeout: 5 * 60 * 1000,      // 请求体的超时时间（大文件上传需要）
        },
      },
    },
  };
})
