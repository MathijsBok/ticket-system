import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    host: true,
    allowedHosts: ['dev.kleverchain.cloud', 'support.kleverchain.cloud', 'localhost'],
    proxy: {
      '^/api/': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
