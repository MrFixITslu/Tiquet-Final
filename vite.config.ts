import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      // Proxy API calls to the Express backend during local dev (npm run dev:all).
      // In production the same Express server serves both the built frontend
      // and /api routes, so no proxy is needed there.
      proxy: {
        '/api': {
          target: `http://localhost:${process.env.PORT || 8080}`,
          changeOrigin: true,
        },
      },
    },
  };
});
