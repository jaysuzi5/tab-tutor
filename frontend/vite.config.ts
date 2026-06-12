import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server on localhost = secure context, so getUserMedia (mic) works.
// Prod served by FastAPI; LAN access needs HTTPS (cloudflared tunnel) for mic.
// Backend origin for the dev proxy. Defaults to :8000; override with
// BACKEND_URL when running the API on another port.
const backend = process.env.BACKEND_URL ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "localhost",
    port: 5173,
    proxy: {
      "/api": { target: backend, changeOrigin: true },
      "/readyz": { target: backend, changeOrigin: true },
      "/healthz": { target: backend, changeOrigin: true },
    },
  },
  build: { outDir: "dist" },
});
