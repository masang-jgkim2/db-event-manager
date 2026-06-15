import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv, type ServerOptions } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

type TDevHttps = NonNullable<ServerOptions['https']>;

const fnResolveDevHttps = (env: Record<string, string>): {
  objHttps?: TDevHttps;
  bUseBasicSsl: boolean;
} => {
  const strCertPath = env.VITE_DEV_SSL_CERT?.trim();
  const strKeyPath = env.VITE_DEV_SSL_KEY?.trim();
  if (strCertPath && strKeyPath) {
    return {
      objHttps: {
        cert: fs.readFileSync(path.resolve(strCertPath)),
        key: fs.readFileSync(path.resolve(strKeyPath)),
      },
      bUseBasicSsl: false,
    };
  }
  if (env.VITE_DEV_HTTPS === 'true') {
    return { bUseBasicSsl: true };
  }
  return { bUseBasicSsl: false };
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const { objHttps, bUseBasicSsl } = fnResolveDevHttps(env);
  const strProxyTarget = env.VITE_PROXY_TARGET || 'http://127.0.0.1:4000';
  const arrAllowedHosts = (env.VITE_ALLOWED_HOSTS || 'localhost,db.masangsoft.com')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const objProxy = {
    '/api': {
      target: strProxyTarget,
      changeOrigin: true,
    },
  };

  return {
    plugins: [react(), ...(bUseBasicSsl ? [basicSsl()] : [])],
    server: {
      host: true,
      port: 5173,
      https: objHttps,
      allowedHosts: arrAllowedHosts,
      proxy: objProxy,
    },
    preview: {
      host: true,
      https: objHttps,
      allowedHosts: arrAllowedHosts,
      proxy: objProxy,
    },
  };
});
