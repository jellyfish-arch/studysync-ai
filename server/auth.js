// Login tokens for the app, and a local secret for the MCP bridge.
// Tokens are HMAC-signed, so they keep working after the server restarts.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DATA_DIR, ensureDataDir } from './env.js'
import { accountExists, normalizeUsername, verifyPassword } from '../src/lib/accounts.js'

const TOKEN_DAYS = 30
let secret = null

// One random secret per install, kept in data/.secret (never committed).
// On Vercel there is no disk, so STUDYSYNC_SECRET must be set there.
export function getSecret() {
  if (secret) return secret
  if (process.env.STUDYSYNC_SECRET) return (secret = process.env.STUDYSYNC_SECRET)
  // Render's free plan has no lasting disk, so a random secret would log
  // everyone out at each restart. Until STUDYSYNC_SECRET is set, derive one
  // that stays the same for this service (its private id plus the accounts).
  if (process.env.RENDER_SERVICE_ID) {
    let accounts = ''
    try {
      accounts = readFileSync(new URL('../src/lib/accounts.json', import.meta.url), 'utf8')
    } catch {
      /* ignore */
    }
    console.warn('[studysync] Set STUDYSYNC_SECRET (any long random text) for proper login security.')
    return (secret = createHash('sha256').update(`studysync:${process.env.RENDER_SERVICE_ID}:${accounts}`).digest('hex'))
  }
  try {
    ensureDataDir()
    const file = path.join(DATA_DIR, '.secret')
    if (existsSync(file)) secret = readFileSync(file, 'utf8').trim()
    if (!secret) {
      secret = randomBytes(32).toString('hex')
      writeFileSync(file, secret, { mode: 0o600 })
    }
  } catch {
    // Read-only disk (e.g. Vercel without STUDYSYNC_SECRET): tokens last until this instance stops.
    secret = randomBytes(32).toString('hex')
    console.warn('[studysync] Set STUDYSYNC_SECRET so logins survive restarts.')
  }
  return secret
}

const b64 = (s) => Buffer.from(s).toString('base64url')
const sign = (payload) => createHmac('sha256', getSecret()).update(payload).digest('base64url')

export function issueToken(username) {
  const payload = b64(JSON.stringify({ u: normalizeUsername(username), exp: Date.now() + TOKEN_DAYS * 864e5 }))
  return `${payload}.${sign(payload)}`
}

export function readToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null
  const [payload, sig] = token.split('.')
  const expected = sign(payload)
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!u || Date.now() > exp || !accountExists(u)) return null
    return u
  } catch {
    return null
  }
}

export async function login(username, password) {
  if (!(await verifyPassword(username, password))) return null
  return { username: normalizeUsername(username), token: issueToken(username) }
}

// The MCP bridge (server/stdio.js) runs on the same computer and proves it
// with this value, read from data/.secret.
export const localKey = () => createHmac('sha256', getSecret()).update('mcp-local').digest('hex')
export function isLocalKey(value) {
  const k = localKey()
  return typeof value === 'string' && value.length === k.length && timingSafeEqual(Buffer.from(value), Buffer.from(k))
}
