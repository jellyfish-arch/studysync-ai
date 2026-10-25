// Keeps the browser copy of an account in step with the StudySync server, so
// changes made by an MCP client (Claude Desktop, Cursor...) show up in the app
// within a second, and the app's changes are there for the AI.
//
// The browser stays the place you work: every change is saved locally first.
// When the server is not running the app simply says "Saved on this device".
import { create } from 'zustand'
import { DATA_KEYS, emitOp, pickData, useStore } from './store.js'
import { LIST_KEYS, normalize } from './ops.js'
import { api, serverHealth } from './api.js'
import { getSession, clearSession } from './session.js'
import { diffAdded } from './merge.js'

// ready = the first sync finished (or there is no server), so Yuuki knows
// whether this account has been set up before.
export const useSync = create(() => ({ status: 'local', ready: false, lastSynced: null, health: null, error: null }))
const setStatus = (status, extra = {}) => useSync.setState({ status, ...extra })

const clientId = Math.random().toString(36).slice(2)
const baseKey = (u) => `studysync:base:${u}`
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

let base = null // { rev, data } = last version both sides agreed on
let user = null
let events = null
let pushTimer = null
let retryTimer = null
let listenTimer = null
let listenDelay = 2000
let watchTimer = null
let remoteSource = 'server' // who made the change the server just told us about
let inFlight = false
let pendingAgain = false
let applying = false
let unsubscribe = null

function saveBase() {
  try {
    localStorage.setItem(baseKey(user), JSON.stringify(base))
  } catch {
    /* ignore */
  }
}

function applyServer(data, source) {
  const before = pickData(useStore.getState())
  applying = true
  useStore.getState().applyRemote(data)
  applying = false
  const added = diffAdded(before, data)
  if (Object.keys(added).length) emitOp({ name: 'remote', added, source })
}

async function push() {
  pushTimer = null
  if (!user) return
  if (inFlight) {
    pendingAgain = true
    return
  }
  inFlight = true
  const sent = pickData(useStore.getState())
  setStatus('saving')
  try {
    const res = await api('/state', { method: 'PUT', body: { baseRev: base?.rev ?? 0, base: base?.data ?? null, data: sent, clientId } })
    const now = pickData(useStore.getState())
    if (same(now, sent)) {
      if (!same(res.data, sent)) applyServer(res.data, res.source || 'server')
      base = { rev: res.rev, data: res.data }
    } else {
      // More edits happened while saving; fold the server's version in on the next push.
      base = { rev: res.rev, data: sent }
      pendingAgain = true
    }
    saveBase()
    setStatus('synced', { lastSynced: Date.now(), error: null, ready: true })
  } catch (e) {
    offline(e)
  } finally {
    inFlight = false
    if (pendingAgain) {
      pendingAgain = false
      schedulePush(50)
    }
  }
}

function schedulePush(delay = 400) {
  clearTimeout(pushTimer)
  pushTimer = setTimeout(push, delay)
}

function offline(e) {
  setStatus(e?.status === 401 ? 'signed-out' : 'offline', { error: e?.message || null, ready: true })
  // The server no longer accepts this login (e.g. it was redeployed): log in again.
  // Data saved in this browser stays and syncs back afterwards.
  if (e?.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    clearSession()
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`)
  }
  clearTimeout(retryTimer)
  if (e?.status !== 401) retryTimer = setTimeout(() => reconcile(), 8000)
}

const isEmpty = (d) => LIST_KEYS.every((k) => !d[k]?.length)

// Bring both sides together: adopt the server copy if nothing changed here,
// otherwise push (the server merges).
async function reconcile() {
  if (!user) return
  try {
    const res = await api('/state')
    const local = pickData(useStore.getState())
    const adopt = () => {
      if (!same(res.data, local)) applyServer(res.data, remoteSource)
      remoteSource = 'server'
      base = { rev: res.rev, data: res.data }
      saveBase()
      setStatus('synced', { lastSynced: Date.now(), error: null, ready: true })
    }
    if (!res.exists) return push() // first time on the server: send what we have
    if (!base) {
      // Never synced from this browser. An empty copy takes the server's;
      // otherwise both are combined (nothing deleted).
      if (isEmpty(local)) return adopt()
      base = { rev: res.rev, data: normalize(null) }
      return push()
    }
    if (same(local, base.data)) return adopt()
    return push()
  } catch (e) {
    offline(e)
  }
}

function listen(token) {
  clearTimeout(listenTimer)
  clearInterval(watchTimer)
  events?.close()
  const es = new EventSource(`/api/events?token=${encodeURIComponent(token)}`)
  events = es
  // The server pings every 20 s. A stream that goes quiet for longer has
  // stalled (e.g. a proxy kept it open while the server restarted): reopen it.
  let lastBeat = Date.now()
  const beat = () => (lastBeat = Date.now())
  watchTimer = setInterval(() => {
    if (events === es && Date.now() - lastBeat > 50000) listen(token)
  }, 10000)
  es.addEventListener('ping', beat)
  es.addEventListener('state', (ev) => {
    beat()
    let msg
    try {
      msg = JSON.parse(ev.data)
    } catch {
      return
    }
    if (msg.clientId === clientId || (base && msg.rev <= base.rev)) return
    remoteSource = msg.source || 'server'
    if (inFlight || pushTimer) {
      pendingAgain = true
      return
    }
    reconcile()
  })
  es.addEventListener('open', () => {
    beat()
    listenDelay = 2000
    reconcile()
  })
  es.onerror = () => {
    if (useSync.getState().status !== 'offline') setStatus('offline', { error: 'Lost the connection to the StudySync server.' })
    // The browser reconnects by itself, except when the connection is refused
    // outright (e.g. the server was restarting). Then try again ourselves, or
    // changes from AI apps would stop showing up until a reload.
    if (es.readyState === EventSource.CLOSED && events === es) {
      // A login the server refuses closes the stream too, and EventSource can't
      // say why: ask once more over HTTP (a 401 there sends you to log in).
      reconcile()
      listenTimer = setTimeout(() => events === es && listen(token), listenDelay)
      listenDelay = Math.min(listenDelay * 2, 30000)
    }
  }
}

export async function startSync() {
  stopSync()
  const session = getSession()
  if (!session) return
  user = session.username
  try {
    base = JSON.parse(localStorage.getItem(baseKey(user)) || 'null')
  } catch {
    base = null
  }
  const health = await serverHealth(true)
  useSync.setState({ health })
  if (!health?.sync) return setStatus('local', { ready: true })
  if (!session.token) return setStatus('signed-out', { error: 'Log in again to sync with the server.', ready: true })
  setStatus('connecting')
  unsubscribe = useStore.subscribe((s, prev) => {
    if (applying || !s.user || s.user !== user) return
    if (DATA_KEYS.some((k) => s[k] !== prev[k])) schedulePush()
  })
  listen(session.token)
}

export function stopSync() {
  unsubscribe?.()
  unsubscribe = null
  events?.close()
  events = null
  clearTimeout(pushTimer)
  clearTimeout(retryTimer)
  clearTimeout(listenTimer)
  clearInterval(watchTimer)
  pushTimer = null
  user = null
  base = null
  setStatus('local', { ready: false })
}
