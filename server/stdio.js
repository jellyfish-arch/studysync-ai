#!/usr/bin/env node
// StudySync MCP server over stdio, for apps that launch a command (Claude
// Desktop, Claude Code, Cursor, Windsurf...).
//
// It needs STUDYSYNC_KEY: a connection key the student creates in StudySync >
// Connect AI. The key alone decides which account and what permissions.
// Every call is forwarded to the local StudySync server so the app sees
// changes live; if the server is not running it is started in the background
// (it stops itself after 15 idle minutes).
import { spawn } from 'node:child_process'
import path from 'node:path'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { PORT, ROOT } from './env.js'
import { createMcpServer } from './mcp.js'

const BASE = `http://127.0.0.1:${PORT}`
const KEY = (process.env.STUDYSYNC_KEY || '').trim()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let clientName = null

async function healthy() {
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(1500) })
    return (await r.json()).name === 'studysync'
  } catch {
    return false
  }
}

let starting = null
async function ensureServer() {
  if (await healthy()) return
  starting ||= (async () => {
    const child = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js'), '--idle-exit=900'], { cwd: ROOT, detached: true, stdio: 'ignore', windowsHide: true })
    child.unref()
    for (let i = 0; i < 40; i++) {
      await sleep(250)
      if (await healthy()) return
    }
    throw new Error(`Could not start the StudySync server on port ${PORT}. Run "npm run dev" in the StudySync folder and try again.`)
  })().finally(() => {
    starting = null
  })
  return starting
}

async function call(pathname, body) {
  if (!KEY) throw new Error('No connection key. In StudySync open Connect AI, create a key, and add it to this app\'s config as STUDYSYNC_KEY.')
  await ensureServer()
  const res = await fetch(`${BASE}${pathname}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}`, ...(clientName ? { 'x-studysync-client': clientName } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `StudySync server error ${res.status}`)
  return json
}

let hello = null
const getHello = () => (hello ||= call('/api/mcp/hello').catch((e) => {
  hello = null
  throw e
}))

const server = createMcpServer({
  listTools: async () => {
    try {
      return (await getHello()).tools
    } catch (e) {
      // Still list one tool, so the AI app can show the student what's wrong.
      return [{ name: 'connection_help', title: 'Connection problem', description: `StudySync is not connected: ${e.message}`, inputSchema: { type: 'object', properties: {} } }]
    }
  },
  run: async (name, args) => {
    if (name === 'connection_help') return { error: (await getHello().catch((e) => e)).message || 'Connected.' }
    return (await call('/api/tool', { name, args })).output
  },
  onInitialized: (info) => {
    clientName = info?.name ? `${info.name} ${info.version || ''}`.trim() : null
    hello = null
    getHello().catch(() => {}) // marks the connection as connected right away
  },
})
await server.connect(new StdioServerTransport())
