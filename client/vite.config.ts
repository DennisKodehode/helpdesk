import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Pull only the React core (react + react-dom + scheduler + router) into
        // its own long-lived chunk: it's large, rarely changes, and is shared by
        // every route, so it stays cached across app deploys. Everything else is
        // left to Rollup's default splitting on purpose — a catch-all `vendor`
        // bucket would yank route-only deps (react-table, dompurify, …) out of
        // their lazy route chunks into one eager chunk, bloating first load.
        manualChunks(id) {
          if (
            /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/.test(id)
          ) {
            return "react-vendor";
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
