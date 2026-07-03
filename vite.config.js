import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Local dev: browser calls same-origin `/api/...` (no CORS).
 * Vite proxies to VITE_API_PROXY_TARGET (deployed API) or localhost:3001.
 * Production: set VITE_API_BASE_URL on the frontend build instead.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = (env.VITE_API_PROXY_TARGET || 'http://localhost:3001').replace(/\/+$/, '')

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          // Vercel Hobby cold starts can take 30–90s before the function responds.
          timeout: 120_000,
          proxyTimeout: 120_000,
        },
      },
    },
  }
})
