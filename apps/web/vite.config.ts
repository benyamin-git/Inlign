import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Inlign",
        short_name: "Inlign",
        display: "standalone",
        start_url: "/",
        theme_color: "#1c1b1f",
        background_color: "#fffbfe",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,wasm,svg,png,woff2}"],
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 7406,
    strictPort: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 7406,
    strictPort: true,
  },
  // The engine worker imports the WASM module, which Vite instantiates with
  // top-level await; the default IIFE worker format cannot express that.
  worker: {
    format: "es",
  },
});
