import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

declare const process: { env: Record<string, string | undefined> };

// Базовый путь приложения. По умолчанию '/', для деплоя под подпуть
// (напр. за nginx на https://домен/finance/) задаётся VITE_BASE=/finance/ на сборке.
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Семейный бюджет',
        short_name: 'Бюджет',
        description: 'Учёт семейных доходов и расходов',
        theme_color: '#5260ff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: base,
        start_url: base,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // API и загрузки не подменять офлайн-страницей (совпадение в любом месте пути)
        navigateFallbackDenylist: [/\/api\//, /\/uploads\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // GET-запросы к API: онлайн — сеть + обновление кэша; офлайн/бэк лежит —
            // отдаём последний закэшированный ответ. Мутации (POST) сюда не попадают.
            urlPattern: ({ url, request }) =>
              url.pathname.includes('/api/') && request.method === 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'finance-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Загруженные чеки — из кэша, если уже видели
            urlPattern: ({ url }) => url.pathname.includes('/uploads/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'finance-uploads',
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 3600 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
});
