import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  // Only the port is used here; no credentials are exposed to the browser.
  const env = loadEnv(mode, resolve(import.meta.dirname, '..'), '')
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: Number(env.FRONTEND_PORT || 5173),
      strictPort: true,
      proxy: { '/api': `http://127.0.0.1:${env.BACKEND_PORT || 8000}` },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      restoreMocks: true,
    },
  }
})
