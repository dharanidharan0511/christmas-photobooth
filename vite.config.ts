import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// This app talks ONLY to the edge engine via a dev proxy.
// See src/lib/engineClient.ts — the only module allowed to call fetch.
//
// How the proxy works:
//   Browser  →  localhost:5353/api/...   (same-origin, no CORS)
//   Vite     →  VITE_ENGINE_PROXY_TARGET/api/...  (server-side, no CORS check)
//
// VITE_ENGINE_URL is left empty in .env so all fetch paths are relative.
// VITE_ENGINE_PROXY_TARGET holds the real engine URL (used only by this file).

export default defineConfig(({ mode }) => {
  // loadEnv reads .env files without VITE_ filtering — lets us read
  // VITE_ENGINE_PROXY_TARGET here (also available client-side via import.meta.env).
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_ENGINE_PROXY_TARGET?.trim();

  // Proxy all engine API + auth paths to the real engine.
  // changeOrigin: rewrites the Host header to match the target (required).
  // secure: false: accept self-signed certs on the engine.
  const engineProxy = proxyTarget
    ? {
        "/api": { target: proxyTarget, changeOrigin: true, secure: false },
        "/user": { target: proxyTarget, changeOrigin: true, secure: false },
      }
    : undefined;

  return {
    base: process.env.VITE_BASE_PATH || "/",
    plugins: [react()],
    server: {
      host: "localhost",
      port: 5353,
      strictPort: true,
      proxy: engineProxy,
      watch: {
        usePolling: true,
        interval: 1000,
      },
    },
    preview: {
      host: "localhost",
      port: 5353,
      strictPort: true,
    },
  };
});
