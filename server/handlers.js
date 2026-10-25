// HTTP handlers shared by the local server (server/index.js) and the Vercel
// functions in /api. Plain Node (req, res), no framework.
import { aiStatus, chat } from './llm.js'
import { login, readToken } from './auth.js'
import * as db from './db.js'
import * as connections from './connections.js'
import * as ent from './entitlements.js'
import * as planner from './planner.js'
import { makeQuiz } from './quiz.js'
import { runMcpTool, toolsFor } from './mcpTools.js'

export const VERSION = '1.0.0'

export function send(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

export async function readBody(req, limit = 4 * 1024 * 1024) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body || 'null') : req.body
  const chunks = []
  let size = 0
  for await (const c of req) {
    size += c.length
    if (size > limit) throw Object.assign(new Error('Request too large.'), { status: 413 })
    chunks.push(c)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    throw Object.assign(new Error('Body must be JSON.'), { status: 400 })
  }
}

function tokenFrom(req) {
  const h = req.headers.authorization || ''
  if (h.startsWith('Bearer ')) return h.slice(7)
  const q = new URL(req.url, 'http://x').searchParams.get('token')
  return q || null
}

export const authUser = (req) => readToken(tokenFrom(req))

// Simple fixed-window limiter (per key) to protect free AI quotas and logins.
const windows = new Map()
function limited(key, max, ms) {
  const now = Date.now()
  const w = windows.get(key)
  if (!w || now - w.start > ms) {
    windows.set(key, { start: now, n: 1 })
    return false
  }
  w.n++
  return w.n > max
}

// Yuuki's tool rounds for one student message share one allowance. A turn
// only covers a few rounds for a few minutes, so reusing a turn id can't turn
// one message into unlimited free model calls.
const turns = new Map() // user -> Map(turn -> { rounds, at })
const TURN_ROUNDS = 6
const TURN_TTL = 10 * 60 * 1000
function continuesTurn(user, turn) {
  const t = turn && turns.get(user)?.get(turn)
  if (!t || Date.now() - t.at > TURN_TTL || t.rounds >= TURN_ROUNDS) return false
  t.rounds++
  return true
}
function startTurn(user, turn) {
  if (!turn) return
  const m = turns.get(user) || new Map()
  turns.set(user, m)
  m.set(turn, { rounds: 1, at: Date.now() })
  if (m.size > 200) m.delete(m.keys().next().value)
}

/* ---------- handlers ---------- */

export function health(req, res, { sync, mcp = null }) {
  const ai = aiStatus()
  send(res, 200, {
    name: 'studysync',
    ok: true,
    version: VERSION,
    sync,
    mcp,
    // Only whether Yuuki's AI is on. Which providers and models are used stays on the server.
    ai: Object.values(ai).some((v) => v.configured),
  })
}

export async function loginHandler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only.' })
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'local'
  if (limited(`login:${ip}`, 10, 60000)) return send(res, 429, { error: 'Too many attempts. Wait a minute.' })
  const body = (await readBody(req)) || {}
  const result = await login(body.username, body.password)
  if (!result) {
    await new Promise((r) => setTimeout(r, 300))
    return send(res, 401, { error: 'That username and password do not match.' })
  }
  db.touch?.(result.username)
  send(res, 200, result)
}

export async function stateHandler(req, res) {
  const user = authUser(req)
  if (!user) return send(res, 401, { error: 'Log in again.' })
  if (req.method === 'GET') return send(res, 200, db.getState(user))
  if (req.method === 'PUT') {
    const body = await readBody(req)
    if (!body || typeof body.data !== 'object') return send(res, 400, { error: 'Send { baseRev, base, data }.' })
    return send(res, 200, db.putState(user, body))
  }
  send(res, 405, { error: 'GET or PUT.' })
}

export function eventsHandler(req, res, { onOpen, onClose } = {}) {
  const user = authUser(req)
  if (!user) return send(res, 401, { error: 'Log in again.' })
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' })
  res.write('retry: 3000\n\n')
  const off = db.subscribe(user, (msg) => res.write(`event: state\ndata: ${JSON.stringify(msg)}\n\n`))
  // A real event (not a comment) so the app can tell a live stream from a stalled one.
  const ping = setInterval(() => res.write('event: ping\ndata: {}\n\n'), 20000)
  onOpen?.()
  req.on('close', () => {
    clearInterval(ping)
    off()
    onClose?.()
  })
}

/* ---------- MCP: everything is decided by the connection key ---------- */

export const NO_KEY = "This StudySync connection has no valid connection key. In StudySync open Connect AI, create a key, and put it in this app's config."

export function mcpAuth(req) {
  const auth = connections.authenticate(connections.keyFrom(req))
  if (auth) connections.touchConnection(auth.id, req.headers['x-studysync-client'] || null)
  return auth
}

// Used by the stdio bridge (server/stdio.js): who am I, and what may I do.
export async function mcpHelloHandler(req, res) {
  const auth = mcpAuth(req)
  if (!auth) return send(res, 401, { error: NO_KEY })
  send(res, 200, { scope: auth.scope, plan: ent.getPlan(auth.user), tools: toolsFor(auth.scope) })
}

// Used by the stdio bridge: run one tool.
export async function toolHandler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only.' })
  const auth = mcpAuth(req)
  if (!auth) return send(res, 401, { error: NO_KEY })
  const body = (await readBody(req)) || {}
  send(res, 200, { output: runMcpTool(auth, body.name, body.args || {}) })
}

/* ---------- the app: connections, plan and usage, Mission Planner ---------- */

export async function connectionsHandler(req, res, id) {
  const user = authUser(req)
  if (!user) return send(res, 401, { error: 'Log in again.' })
  if (req.method === 'GET') return send(res, 200, { connections: connections.listConnections(user), scopes: connections.SCOPES })
  if (req.method === 'POST' && !id) {
    const body = (await readBody(req)) || {}
    return send(res, 201, connections.createConnection(user, body))
  }
  if (req.method === 'DELETE' && id) return send(res, connections.revokeConnection(user, id) ? 200 : 404, { ok: true })
  send(res, 405, { error: 'Not allowed.' })
}

export async function accountHandler(req, res, sub) {
  const user = authUser(req)
  if (!user) return send(res, 401, { error: 'Log in again.' })
  if (req.method === 'GET' && !sub) return send(res, 200, ent.accountSummary(user))
  if (req.method === 'POST' && sub === 'plan') {
    // Demo only: there is no payment provider. See docs/monetization.md.
    if (!ent.demoPlansEnabled()) return send(res, 403, { error: 'Plan changes are not available: payments are not set up yet.' })
    const body = (await readBody(req)) || {}
    ent.setPlan(user, body.plan, 'demo')
    return send(res, 200, ent.accountSummary(user))
  }
  send(res, 405, { error: 'Not allowed.' })
}

// /api/planner/<action> and /api/plans[/<id>[/<action>]]
// POST /api/quiz { topicIds, count }: a short practice quiz on those topics.
export async function quizHandler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only.' })
  const user = authUser(req)
  if (!user) return send(res, 401, { error: 'Log in again.' })
  if (limited(`quiz:${user}`, 8, 60000)) return send(res, 429, { error: 'Too many quizzes at once. Give it a minute.' })
  const body = (await readBody(req)) || {}
  try {
    send(res, 200, await makeQuiz(user, { topicIds: Array.isArray(body.topicIds) ? body.topicIds.slice(0, 3) : [], count: body.count }))
  } catch (e) {
    if (e instanceof ent.EntitlementError) return send(res, 402, { error: e.message, entitlement: e.result })
    send(res, e.status || 500, { error: e.message })
  }
}

export async function plannerHandler(req, res, parts) {
  const user = authUser(req)
  if (!user) return send(res, 401, { error: 'Log in again.' })
  const body = req.method === 'POST' ? (await readBody(req)) || {} : {}
  const [kind, id, action] = parts
  try {
    if (kind === 'planner') {
      if (id === 'risks' && req.method === 'GET') return send(res, 200, { risks: planner.risks(user) })
      if (id === 'context' && req.method === 'POST') return send(res, 200, planner.context(user, body.goal, body.options))
      if (id === 'draft' && req.method === 'POST') return send(res, 200, planner.draft(user, { goal: body.goal, options: body.options, createdBy: 'app' }))
      if (id === 'scenarios' && req.method === 'POST') {
        const out = planner.scenarios(user, body)
        return send(res, 200, { scenarios: out.rows, replaces: out.replaces })
      }
      if (id === 'review' && req.method === 'GET') return send(res, 200, planner.review(user))
      if (id === 'outcomes' && req.method === 'GET') return send(res, 200, { outcomes: planner.outcomes(user) })
    }
    if (kind === 'plans') {
      if (!id && req.method === 'GET') return send(res, 200, { plans: planner.list(user) })
      if (id && !action && req.method === 'GET') return send(res, 200, { plan: planner.get(user, id), progress: planner.progress(user, id) })
      if (action === 'approve' && req.method === 'POST') return send(res, 200, planner.approve(user, id, body.revision, { via: 'app' }))
      if (action === 'repair' && req.method === 'POST') return send(res, 200, planner.repair(user, id, { changes: body.changes, reason: body.reason }))
      if (action === 'validate' && req.method === 'GET') return send(res, 200, planner.validate(user, { planId: id }))
      if (action === 'status' && req.method === 'POST') return send(res, 200, { plan: planner.setStatus(user, id, body.status) })
    }
    send(res, 404, { error: 'No such planner endpoint.' })
  } catch (e) {
    if (e instanceof ent.EntitlementError) return send(res, 402, { error: e.message, entitlement: e.result })
    if (e.status) return send(res, e.status, { error: e.message, errors: e.errors })
    throw e
  }
}

export async function yuukiHandler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only.' })
  const user = authUser(req)
  if (!user) return send(res, 401, { error: 'Log in again to talk to Yuuki.' })
  if (limited(`yuuki:${user}`, 20, 60000)) return send(res, 429, { error: 'Yuuki needs a breather. Try again in a minute.' })
  const body = (await readBody(req, 512 * 1024)) || {}
  const messages = Array.isArray(body.messages) ? body.messages.slice(-40) : null
  if (!messages?.length) return send(res, 400, { error: 'Send { messages }.' })
  // One allowance per message the student sends; the model's follow-up
  // rounds for that message (tool calls) share it.
  const turn = typeof body.turn === 'string' ? body.turn.slice(0, 64) : null
  const firstRound = !continuesTurn(user, turn)
  if (firstRound) {
    const allowed = ent.check(user, 'yuuki.chat')
    if (!allowed.allowed) return send(res, 402, { error: allowed.reason, entitlement: allowed })
  }
  try {
    const out = await chat({ messages, tools: Array.isArray(body.tools) ? body.tools.slice(0, 64) : undefined, prefer: body.prefer })
    if (firstRound) {
      ent.consume(user, 'yuuki.chat')
      startTurn(user, turn)
    }
    // Only the answer: which provider and model replied stays on the server.
    send(res, 200, { message: out.message })
  } catch (e) {
    send(res, e.status || 500, { error: e.message })
  }
}
