/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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
  plugins: [react(), ...(isVitest ? [] : [tailwindcss()])],
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
