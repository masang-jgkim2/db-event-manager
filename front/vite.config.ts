import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const strProxyTarget = env.VITE_PROXY_TARGET || 'http://127.0.0.1:4000';
  const objProxy = {
    '/api': {
      target: strProxyTarget,
      changeOrigin: true,
    },
  };

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy: objProxy,
    },
    preview: {
      host: true,
      proxy: objProxy,
    },
  };
});
