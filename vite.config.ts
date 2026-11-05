/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  base: '/',
  build: {
    // Keep font files as separate assets: inlining the small Japanese slices bloats the CSS.
    assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined),
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Flashcards',
        short_name: 'Flashcards',
        description: 'Offline flashcards for learning anything',
        lang: 'en',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#b0a3ce',
        theme_color: '#b0a3ce',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'monochrome-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'monochrome' },
        ],
      },
      workbox: {
        // Fonts: precache Latin/Cyrillic and the Japanese card face, so the app looks right offline.
        // Murecho's Japanese slices (headings only) are cached the first time they're used.
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,webmanifest}',
          'assets/*-{latin,latin-ext,cyrillic,cyrillic-ext}-wght-normal-*.woff2',
          'assets/biz-udpgothic-japanese-700-normal-*.woff2',
        ],
        // The link-sharing preview is for crawlers, not for the app offline.
        globIgnores: ['**/og-image.png'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 200 } },
          },
        ],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
