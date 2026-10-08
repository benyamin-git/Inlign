/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

const tauriPlatform = process.env.TAURI_ENV_PLATFORM

// Unit tests do not touch CSS, and loading Tailwind's Oxide scanner under
// Vitest is pure overhead — and a startup hazard on Android, where it runs
// through its wasm fallback.
const isVitest = Boolean(process.env.VITEST)

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_PLATFORM__: JSON.stringify(tauriPlatform ?? 'web'),
  },
  plugins: [
    react(),
    ...(isVitest ? [] : [tailwindcss()]),
    VitePWA({
      // Tauri serves the bundle from its own scheme; the SW would only cache a
      // local origin that never needs it.
      disable: isVitest || Boolean(tauriPlatform),
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Inlign',
        short_name: 'Inlign',
        display: 'standalone',
        theme_color: '#fffbfe',
        background_color: '#fffbfe',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{html,js,css,svg,png,ico,woff,woff2,webmanifest}'],
        // The CAS engine and the editor bundle are the app: precache them even
        // as they grow, and never fail the build over size when offline is the
        // point.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
