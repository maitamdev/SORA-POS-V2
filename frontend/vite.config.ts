import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // Sử dụng manifest.webmanifest thủ công trong public/
      workbox: {
        // Precache the application shell only. Large images are handled by the
        // runtime cache below so the first install does not download the whole
        // media library before the POS becomes interactive.
        globPatterns: ['**/*.{js,css,html,ico,svg,woff,woff2}'],
        // Keep the fixed public logo out of precache so it cannot remain stale.
        globIgnores: ['assets/logo.png'],
        // Runtime caching cho Google Fonts CDN
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpe?g|webp)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'sora-images-v1',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Split vendor chunks for better caching & faster initial load
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react-router')) return 'react-vendor';
            if (id.includes('recharts') || id.includes('d3-')) return 'chart-vendor';
            if (id.includes('@supabase') || id.includes('dexie')) return 'db-vendor';
            if (id.includes('axios') || id.includes('zustand')) return 'data-vendor';
            if (id.includes('html2canvas') || id.includes('html5-qrcode') || id.includes('qrcode')) return 'media-vendor';
            if (id.includes('react-icons') || id.includes('react-hot-toast')) return 'ui-vendor';
            if (id.includes('zod') || id.includes('react-hook-form') || id.includes('@hookform')) return 'form-vendor';
          }
        },
      },
    },
    // Increase warning threshold for production chunks
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
