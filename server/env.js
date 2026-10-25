// Settings for the StudySync server. API keys come from the .env file in the
// project root (copy .env.example to .env). They are only ever read here, on
// your computer, and never sent to the browser.
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const ROOT = fileURLToPath(new URL('..', import.meta.url))

const envFile = path.join(ROOT, '.env')
if (existsSync(envFile) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envFile)
  } catch (e) {
    console.warn(`[studysync] Could not read .env: ${e.message}`)
  }
}

// Hosted (Render sets RENDER and PORT): listen on every interface, on its port.
// On a computer: localhost only, so nothing else on the network can reach it.
export const HOSTED = Boolean(process.env.RENDER || process.env.STUDYSYNC_HOSTED)
export const PORT = Number(process.env.STUDYSYNC_PORT || (HOSTED && process.env.PORT) || 8787)
export const HOST = process.env.STUDYSYNC_HOST || (HOSTED ? '0.0.0.0' : '127.0.0.1')
// The public address, e.g. studysync-ai.onrender.com (Render provides it).
export const PUBLIC_HOST = process.env.STUDYSYNC_PUBLIC_HOST || process.env.RENDER_EXTERNAL_HOSTNAME || null
// On Render's free plan this folder is wiped when the server restarts; a
// real launch needs a database (docs/monetization.md).
export const DATA_DIR = path.resolve(ROOT, process.env.STUDYSYNC_DATA_DIR || 'data')
export const DIST_DIR = path.join(ROOT, 'dist')

export function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  return DATA_DIR
}
