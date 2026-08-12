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
        // Public invoices must always load the current customer-facing page.
        // They are online-only and should not be served from an old app shell.
        navigateFallbackDenylist: [/^\/invoice(?:\/|$)/],
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
    // Let Rollup keep route-only dependencies behind their lazy page imports.
    // A hand-written vendor map can turn a chart dependency into an entry
    // modulepreload, forcing every first visit to download Recharts.
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
