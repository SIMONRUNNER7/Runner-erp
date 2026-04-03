import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const ASSET_HOST = process.env.VITE_ASSET_HOST ?? 'https://erp.runner.golf';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // In production the assets are served from erp.runner.golf/b2b-assets/
  base: mode === 'production' ? `${ASSET_HOST}/b2b-assets/` : '/',
  build: {
    rollupOptions: {
      output: {
        // Predictable filenames so Shopify page can hardcode the URLs
        entryFileNames: 'app.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (info) => {
          if (info.name?.endsWith('.css')) return 'app.css';
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
}));
