import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isProd = mode === 'production';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: {
        ignored: ['**/data.db', '**/data.db-journal', '**/data.db-shm', '**/data.db-wal', '**/.env'],
      },
      proxy: {
        '/api': { target: 'http://127.0.0.1:3001', ws: true },
        '/ws': { target: 'http://127.0.0.1:3001', ws: true },
        '/health': { target: 'http://127.0.0.1:3001' },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: !isProd,
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'lucide-react', 'recharts', 'motion'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
  };
});
