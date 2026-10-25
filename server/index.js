// StudySync local server. Started for you by `npm run dev` (next to Vite) or
// on its own with `npm start` (which also serves the built app).
//
//   /api/*   the app: login, data sync, live updates, Yuuki's AI
//   /mcp     MCP over Streamable HTTP, for clients that take a URL
//
// It only listens on 127.0.0.1, so nothing outside this computer can reach it.
import http from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { DIST_DIR, HOST, PORT, ROOT, HOSTED, PUBLIC_HOST } from './env.js'
import {
  NO_KEY,
  VERSION,
  accountHandler,
  connectionsHandler,
  eventsHandler,
  health,
  loginHandler,
  mcpAuth,
  mcpHelloHandler,
  plannerHandler,
  readBody,
  send,
  stateHandler,
  toolHandler,
  yuukiHandler,
  quizHandler,
} from './handlers.js'
import { createMcpServer } from './mcp.js'
import { runMcpTool, toolsFor } from './mcpTools.js'
import { touchConnection } from './connections.js'
import { getSecret } from './auth.js'
import * as db from './db.js'
import { anyProvider } from './llm.js'

const args = process.argv.slice(2)
const serveApp = args.includes('--serve')
const idleArg = args.find((a) => a.startsWith('--idle-exit='))
const idleSeconds = idleArg ? Number(idleArg.split('=')[1]) : 0

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', ...(PUBLIC_HOST ? [PUBLIC_HOST] : []), ...(process.env.STUDYSYNC_ALLOWED_HOSTS || '').split(',').filter(Boolean)])
const hostOk = (req) => LOCAL_HOSTS.has(String(req.headers.host || '').replace(/:\d+$/, ''))

let lastActivity = Date.now()

// Shown in Connect AI so the student can copy it into an AI app. No account
// name here: the connection key decides the account.
const MCP_INFO = { command: 'node', script: HOSTED ? null : path.join(ROOT, 'server', 'stdio.js').replaceAll('\\', '/'), url: PUBLIC_HOST ? `https://${PUBLIC_HOST}/mcp` : `http://localhost:${PORT}/mcp`, port: PORT, hosted: HOSTED }

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4', '.webm': 'video/webm' }

function serveStatic(req, res, pathname) {
  let file = path.join(DIST_DIR, decodeURIComponent(pathname))
  if (!file.startsWith(DIST_DIR)) return send(res, 403, { error: 'Nope.' })
  if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(DIST_DIR, 'index.html')
  if (!existsSync(file)) return send(res, 404, { error: 'Run "npm run build" first.' })
  res.writeHead(200, {
    'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
    'cache-control': file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  createReadStream(file).pipe(res)
}

// MCP over HTTP: the connection key in "Authorization: Bearer ssk_..." picks
// the account and the permission level. Nothing in the URL or body can.
async function mcpHttp(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { allow: 'POST' }).end()
    return
  }
  const auth = mcpAuth(req)
  if (!auth) {
    res.setHeader('www-authenticate', 'Bearer')
    return send(res, 401, { error: NO_KEY })
  }
  const body = await readBody(req)
  const init = [].concat(body || []).find((m) => m?.method === 'initialize')
  if (init?.params?.clientInfo?.name) touchConnection(auth.id, `${init.params.clientInfo.name} ${init.params.clientInfo.version || ''}`.trim())
  const server = createMcpServer({ version: VERSION, listTools: () => toolsFor(auth.scope), run: async (name, a) => runMcpTool(auth, name, a) })
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  res.on('close', () => {
    transport.close()
    server.close()
  })
  await server.connect(transport)
  await transport.handleRequest(req, res, body)
}

async function route(req, res) {
  lastActivity = Date.now()
  if (!hostOk(req)) return send(res, 403, { error: 'StudySync only answers on localhost.' })
  const { pathname } = new URL(req.url, 'http://localhost')
  try {
    if (pathname === '/api/health') return health(req, res, { sync: true, mcp: MCP_INFO })
    if (pathname === '/api/login') return await loginHandler(req, res)
    if (pathname === '/api/state') return await stateHandler(req, res)
    if (pathname === '/api/events') return eventsHandler(req, res)
    if (pathname === '/api/tool') return await toolHandler(req, res)
    if (pathname === '/api/mcp/hello') return await mcpHelloHandler(req, res)
    if (pathname === '/api/yuuki') return await yuukiHandler(req, res)
    if (pathname === '/api/quiz') return await quizHandler(req, res)
    // Only /api/... paths: the app's own pages (like /app/planner) must reach the app.
    const parts = pathname.startsWith('/api/') ? pathname.split('/').filter(Boolean).slice(1) : []
    if (parts[0] === 'connections') return await connectionsHandler(req, res, parts[1])
    if (parts[0] === 'account') return await accountHandler(req, res, parts[1])
    if (parts[0] === 'planner' || parts[0] === 'plans') return await plannerHandler(req, res, parts)
    if (pathname === '/mcp') return await mcpHttp(req, res)
    if (pathname.startsWith('/api/')) return send(res, 404, { error: 'No such endpoint.' })
    if (serveApp) return serveStatic(req, res, pathname)
    send(res, 404, { error: 'This is the StudySync API. Open the app on the Vite address (npm run dev) instead.' })
  } catch (e) {
    console.error('[studysync]', e)
    if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : 'Something broke on the server.' })
  }
}

const server = http.createServer(route)
server.on('error', async (e) => {
  if (e.code === 'EADDRINUSE') {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: AbortSignal.timeout(2000) })
      if ((await r.json()).name === 'studysync') {
        console.log(`[studysync] A StudySync server is already running on port ${PORT}; using that one.`)
        process.exit(0)
      }
    } catch {
      /* something else owns the port */
    }
    console.error(`[studysync] Port ${PORT} is taken by another program. Set STUDYSYNC_PORT in .env to use a different one.`)
    process.exit(1)
  }
  throw e
})

// Hosted demo: storage is wiped on restart, so refill the demo accounts
// (STUDYSYNC_SEED_DEMO=jelly) with a semester dated from today.
async function seedDemo() {
  const users = (process.env.STUDYSYNC_SEED_DEMO || '').split(',').map((u) => u.trim()).filter(Boolean)
  if (!users.length) return
  const { demoSemester } = await import('../tests/fixtures/semester.js')
  for (const u of users) {
    try {
      if (db.getState(u).exists) continue
      db.putState(u, { baseRev: 0, base: null, data: { ...demoSemester(), guide: { introduced: true, tourDone: true, tour: 0, seen: [] } } })
      console.log(`[studysync] Demo semester loaded for ${u}.`)
    } catch (e) {
      console.warn(`[studysync] Could not load demo data for ${u}: ${e.message}`)
    }
  }
}

server.listen(PORT, HOST, () => {
  getSecret()
  seedDemo()
  const ai = anyProvider() ? 'Yuuki AI: on' : 'Yuuki AI: off (add a key to .env)'
  console.log(`[studysync] API on http://${HOST}:${PORT}  |  MCP: ${MCP_INFO.url}  |  ${ai}${serveApp ? `  |  app: ${PUBLIC_HOST ? `https://${PUBLIC_HOST}` : `http://localhost:${PORT}`}` : ''}`)
})

if (idleSeconds > 0) {
  setInterval(() => {
    if (db.listenerCount() === 0 && Date.now() - lastActivity > idleSeconds * 1000) {
      console.log('[studysync] Idle, shutting down.')
      process.exit(0)
    }
  }, 30000).unref()
}
