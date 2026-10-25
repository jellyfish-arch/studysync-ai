// Each account's data lives in data/<username>.json as { rev, updated, data }.
// The server is the only writer; the app and MCP clients both go through it.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DATA_DIR, ensureDataDir } from './env.js'
import { normalize } from '../src/lib/ops.js'
import { mergeData } from '../src/lib/merge.js'
import { callTool } from '../src/lib/tools.js'
import { accountExists, normalizeUsername } from '../src/lib/accounts.js'

const cache = new Map()
const listeners = new Map() // username -> Set<fn>

const fileFor = (u) => path.join(DATA_DIR, `${u}.json`)

function load(username) {
  const u = normalizeUsername(username)
  if (!accountExists(u)) throw new Error(`Unknown account "${username}".`)
  if (cache.has(u)) return cache.get(u)
  ensureDataDir()
  let rec = { rev: 0, updated: null, data: normalize(null), exists: false }
  const f = fileFor(u)
  if (existsSync(f)) {
    try {
      const raw = JSON.parse(readFileSync(f, 'utf8'))
      rec = { rev: raw.rev || 0, updated: raw.updated || null, data: normalize(raw.data), exists: true }
    } catch (e) {
      console.error(`[studysync] ${f} is not valid JSON (${e.message}). Starting that account empty; the bad file was left in place.`)
      rec = { rev: 0, updated: null, data: normalize(null), exists: false, broken: true }
    }
  }
  cache.set(u, rec)
  return rec
}

function save(u, data, source, clientId = null) {
  const prev = load(u)
  if (prev.broken) throw new Error(`data/${u}.json could not be read, so it was not overwritten. Fix or delete it, then restart.`)
  const rec = { rev: prev.rev + 1, updated: new Date().toISOString(), data: normalize(data), exists: true }
  cache.set(u, rec)
  const f = fileFor(u)
  const tmp = `${f}.tmp`
  writeFileSync(tmp, JSON.stringify({ rev: rec.rev, updated: rec.updated, data: rec.data }, null, 2))
  renameSync(tmp, f)
  touch(u)
  for (const fn of listeners.get(u) || []) fn({ rev: rec.rev, source, clientId })
  return rec
}

export function getState(username) {
  const r = load(username)
  return { rev: r.rev, updated: r.updated, data: r.data, exists: r.exists }
}

// The app sends its copy plus the version it started from; the server merges
// so edits made meanwhile by an AI are kept.
export function putState(username, { baseRev, base, data, clientId }) {
  const u = normalizeUsername(username)
  const cur = load(u)
  const merged = cur.exists && (baseRev !== cur.rev || base) ? mergeData(base || cur.data, data, cur.data) : normalize(data)
  const rec = save(u, merged, 'app', clientId)
  return { rev: rec.rev, data: rec.data }
}

// Change an account's data with a function (used by Mission Planner to apply
// an approved plan). fn(data) -> { data, result }; nothing is saved if it throws.
export function mutate(username, fn, source = 'planner') {
  const u = normalizeUsername(username)
  const cur = load(u)
  const { data, result } = fn(cur.data)
  if (data && data !== cur.data) save(u, data, source)
  return result
}

// Run one AI tool (MCP or Yuuki-on-server) against an account.
export function runTool(username, name, args, source = 'mcp') {
  const u = normalizeUsername(username)
  const cur = load(u)
  const { data, output } = callTool(cur.data, name, args)
  if (data) save(u, data, source)
  return output
}

export function subscribe(username, fn) {
  const u = normalizeUsername(username)
  if (!listeners.has(u)) listeners.set(u, new Set())
  listeners.get(u).add(fn)
  return () => listeners.get(u)?.delete(fn)
}

export const listenerCount = () => [...listeners.values()].reduce((n, s) => n + s.size, 0)

/* ---------- which account an MCP client works on ---------- */
const stateFile = () => path.join(ensureDataDir(), '.state.json')
export function touch(u) {
  try {
    writeFileSync(stateFile(), JSON.stringify({ lastUser: u, at: new Date().toISOString() }))
  } catch {
    /* ignore */
  }
}
export function lastUser() {
  try {
    return JSON.parse(readFileSync(stateFile(), 'utf8')).lastUser || null
  } catch {
    return null
  }
}
