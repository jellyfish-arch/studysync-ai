// Checks the online-only parts against a server started in hosted mode:
// Connect AI shows the online setup, and an old login goes back to /login.
//   APP_URL=http://127.0.0.1:8799 RENDER_SERVICE_ID=<same as the server> node video/scripts/hosted-check.mjs
import puppeteer from 'puppeteer-core'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const { issueToken } = await import(pathToFileURL(path.join(ROOT, 'server/auth.js')).href)
const APP = process.env.APP_URL || 'http://127.0.0.1:8799'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = 0
const note = (ok, what, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${what}${detail ? ` (${detail})` : ''}`)
}

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })
await page.goto(`${APP}/login`, { waitUntil: 'domcontentloaded' })
const login = (token) => page.evaluate((t) => localStorage.setItem('studysync:session', JSON.stringify({ username: 'jelly', token: t, at: Date.now() })), token)

// 1. Connect AI, online setup
await login(issueToken('jelly'))
await page.goto(`${APP}/app/connect`, { waitUntil: 'networkidle2' })
await sleep(1200)
const clickText = (t) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes(t))
    b?.click()
    return Boolean(b)
  }, t)
const chatgpt = await page.evaluate(() => document.body.innerText.includes('ChatGPT needs its own app sign-in'))
note(chatgpt, 'ChatGPT note for the online version')
note(await clickText('Claude Code'), 'choose Claude Code')
await sleep(400)
note(await clickText('Create my connection'), 'create a connection')
await sleep(1500)
const cmd = await page.evaluate(() => [...document.querySelectorAll('pre')].map((p) => p.innerText).join('\n'))
note(/claude mcp add --transport http studysync https:\/\/\S+\/mcp --header "Authorization: Bearer ssk_/.test(cmd), 'Claude Code gets the online command', cmd.replace(/ssk_\S+/, 'ssk_…'))

// The key from step 2 works over HTTP MCP, as Claude Code would use it.
const key = /ssk_[A-Za-z0-9_-]+/.exec(cmd)?.[0]
const mcp = await fetch(`${APP}/mcp`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${key}` },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'check', version: '1' } } }),
})
note(mcp.ok, 'the key opens an MCP session over HTTP', String(mcp.status))
await sleep(3500)
const connected = await page.evaluate(() => document.body.innerText.includes('Connected!'))
note(connected, 'Connect AI turns green')

// 2. A login the server no longer accepts -> back to the login page
await login('not-a-valid-token')
await page.goto(`${APP}/app/planner`, { waitUntil: 'networkidle2' })
await sleep(2500)
const url = new URL(page.url())
note(url.pathname === '/login' && url.searchParams.get('next') === '/app/planner', 'expired login goes to /login', page.url())

await browser.close()
console.log(failed ? `\n${failed} check(s) failed.` : '\nAll hosted checks passed.')
process.exit(failed ? 1 : 0)
