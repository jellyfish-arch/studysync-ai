import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const API = `http://127.0.0.1:${process.env.STUDYSYNC_PORT || 8787}`

// When the StudySync server restarts, close any half-sent response (the live
// /api/events stream) so the browser notices and reconnects. Left alone, the
// proxy keeps it open and silent.
const api = {
  target: API,
  changeOrigin: false,
  configure: (proxy) =>
    proxy.on('error', (_err, _req, res) => {
      if (res && 'writableEnded' in res && res.headersSent && !res.writableEnded) res.end()
    }),
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The StudySync server (server/index.js) answers /api; npm run dev starts both.
    proxy: { '/api': api },
  },
  preview: { proxy: { '/api': api } },
  test: { environment: 'node' },
})
