import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
