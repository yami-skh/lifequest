/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      // Регистрируем сами в main.tsx: в APK service worker не нужен.
      injectRegister: false,
      // Новая версия включается сразу, даже если открыта страница старой сборки.
      workbox: { skipWaiting: true, clientsClaim: true, globPatterns: ['**/*.{js,css,html,woff2,png,svg}'], globIgnores: ['bundle-*.zip'] },
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'LifeQuest',
        short_name: 'LifeQuest',
        description: 'Прокачка себя как RPG-персонажа',
        lang: 'ru',
        theme_color: '#0E1015',
        background_color: '#0E1015',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
