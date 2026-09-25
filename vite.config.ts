import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      "/api/v1": {
        target: process.env.DEV_API_PROXY_TARGET || "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },

   resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
