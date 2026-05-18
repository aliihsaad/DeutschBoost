/// <reference types="vite/client" />
import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import {
  DEEPGRAM_API_TARGET,
  DEEPGRAM_PROXY_PATH,
  rewriteDeepgramProxyPath,
} from './src/infrastructure/browser/deepgramProxy';

// Vite configuration for DeutschBoost
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const tauriDevHost = process.env.TAURI_DEV_HOST;
    const isTauriBuild = Boolean(process.env.TAURI_ENV_PLATFORM);
    const deepgramProxy = {
      [DEEPGRAM_PROXY_PATH]: {
        target: DEEPGRAM_API_TARGET,
        changeOrigin: true,
        rewrite: rewriteDeepgramProxyPath,
      },
    };

    return {
      clearScreen: false,
      server: {
        port: 5173,
        strictPort: true,
        host: tauriDevHost || '0.0.0.0',
        hmr: tauriDevHost
          ? {
              protocol: 'ws',
              host: tauriDevHost,
              port: 1421,
            }
          : undefined,
        watch: {
          ignored: ['**/src-tauri/**'],
        },
        proxy: deepgramProxy,
      },
      preview: {
        host: '0.0.0.0',
        proxy: deepgramProxy,
      },
      plugins: [
        react(),
        isTauriBuild ? tauriDesktopServiceWorkerCleanupPlugin() : VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'mask-icon.svg', 'app-icon.svg'],
          manifest: {
            name: 'DeutschBoost - Learn German with AI',
            short_name: 'DeutschBoost',
            description: 'AI-powered German language learning platform for A1-C2 levels and Goethe-Zertifikat preparation',
            theme_color: '#1d4ed8',
            background_color: '#f8fbff',
            display: 'standalone',
            scope: '/',
            start_url: '/',
            icons: [
              {
                src: '/pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: '/pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png'
              },
              {
                src: '/pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable'
              },
              {
                src: '/app-icon.svg',
                sizes: 'any',
                type: 'image/svg+xml'
              }
            ]
          },
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                urlPattern: /^https:\/\/cdn\.tailwindcss\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'tailwind-cdn-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                  }
                }
              }
            ]
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.API_KEY || env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.API_KEY || env.GEMINI_API_KEY)
      },
      envPrefix: ['VITE_', 'TAURI_ENV_'],
      build: {
        target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
        minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
        sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

function tauriDesktopServiceWorkerCleanupPlugin(): Plugin {
  return {
    name: 'tauri-desktop-service-worker-cleanup',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
    await self.registration.unregister();
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(clientsList.map(client => client.navigate(client.url)));
  })());
});
`.trimStart(),
      });
      this.emitFile({
        type: 'asset',
        fileName: 'registerSW.js',
        source: `
if ('serviceWorker' in navigator && location.hostname === 'tauri.localhost') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
`.trimStart(),
      });
    },
  };
}
