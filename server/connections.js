// Connection keys for AI apps (MCP clients).
//
// Each key belongs to exactly one account and one permission level, and can be
// revoked. The key is shown once when it is created; only a SHA-256 hash is
// stored. The account is always taken from the key, never from anything the
// AI app or the model sends, so a connected AI cannot switch accounts.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DATA_DIR, ensureDataDir } from './env.js'
import { accountExists, normalizeUsername } from '../src/lib/accounts.js'

export const SCOPES = {
  read: { label: 'Read only', canWrite: false, canDelete: false },
  write: { label: 'Read and add', canWrite: true, canDelete: false },
  full: { label: 'Full access', canWrite: true, canDelete: true },
}

const MAX_PER_ACCOUNT = 10
const ACTIVE_MS = 15 * 60 * 1000 // "connected" if used in the last 15 minutes
const file = () => path.join(ensureDataDir(), '.connections.json')
const sha = (s) => createHash('sha256').update(s).digest('hex')

let cache = null
function load() {
  if (cache) return cache
  try {
    cache = existsSync(file()) ? JSON.parse(readFileSync(file(), 'utf8')) : { connections: [] }
  } catch {
    cache = { connections: [] }
  }
  if (!Array.isArray(cache.connections)) cache.connections = []
  return cache
}
function save() {
  const tmp = `${file()}.tmp`
  writeFileSync(tmp, JSON.stringify(cache, null, 2), { mode: 0o600 })
  renameSync(tmp, file())
}

// Re-read from disk (another process, e.g. the test runner, may have changed it).
export function reload() {
  cache = null
  return load()
}

export function publicView(c) {
  const last = c.lastUsed ? Date.parse(c.lastUsed) : 0
  const status = !c.lastUsed ? 'waiting' : Date.now() - last < ACTIVE_MS ? 'connected' : 'idle'
  return { id: c.id, name: c.name, client: c.client, scope: c.scope, created: c.created, lastUsed: c.lastUsed || null, lastClient: c.lastClient || null, status }
}

export function listConnections(username) {
  const u = normalizeUsername(username)
  return load().connections.filter((c) => c.user === u).map(publicView)
}

export function createConnection(username, { name, client, scope } = {}) {
  const u = normalizeUsername(username)
  if (!accountExists(u)) throw Object.assign(new Error('Unknown account.'), { status: 404 })
  if (!SCOPES[scope]) throw Object.assign(new Error('Pick read, write or full.'), { status: 400 })
  const mine = load().connections.filter((c) => c.user === u)
  if (mine.length >= MAX_PER_ACCOUNT) throw Object.assign(new Error(`You can have up to ${MAX_PER_ACCOUNT} connections. Remove one first.`), { status: 400 })
  const id = randomBytes(6).toString('hex')
  const secret = randomBytes(24).toString('base64url')
  const c = {
    id,
    user: u,
    name: String(name || 'AI app').trim().slice(0, 40) || 'AI app',
    client: String(client || 'other').slice(0, 30),
    scope,
    hash: sha(secret),
    created: new Date().toISOString(),
    lastUsed: null,
    lastClient: null,
  }
  load().connections.push(c)
  save()
  return { connection: publicView(c), key: `ssk_${id}_${secret}` }
}

export function revokeConnection(username, id) {
  const u = normalizeUsername(username)
  const list = load().connections
  const i = list.findIndex((c) => c.id === id && c.user === u)
  if (i < 0) return false
  list.splice(i, 1)
  save()
  return true
}

// key -> { user, scope, id } or null
export function authenticate(key) {
  if (typeof key !== 'string') return null
  const m = key.trim().match(/^ssk_([0-9a-f]{12})_([A-Za-z0-9_-]{20,})$/)
  if (!m) return null
  const c = load().connections.find((x) => x.id === m[1])
  if (!c) return null
  const a = Buffer.from(sha(m[2]))
  const b = Buffer.from(c.hash)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  if (!accountExists(c.user)) return null
  return { user: c.user, scope: c.scope, id: c.id }
}

// Record that a connection was used, and by which app (from MCP initialize).
let lastWrite = 0
export function touchConnection(id, clientName) {
  const c = load().connections.find((x) => x.id === id)
  if (!c) return
  c.lastUsed = new Date().toISOString()
  if (clientName) c.lastClient = String(clientName).slice(0, 60)
  // Write at most every 20s unless the client name changed.
  if (clientName || Date.now() - lastWrite > 20000) {
    lastWrite = Date.now()
    save()
  }
}

export const keyFrom = (req) => {
  const m = /^Bearer\s+(\S+)/i.exec(String(req.headers.authorization || '').trim())
  return m ? m[1] : null
}
