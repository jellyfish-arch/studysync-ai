// Stage check for the demo app (sandbox): every page on desktop and phone, plus
// the actions shown live. Reports page errors, console errors and failures.
//   node scripts/smoke.mjs
import puppeteer from 'puppeteer-core'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

process.env.STUDYSYNC_DATA_DIR = 'data-sandbox'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const { issueToken } = await import(pathToFileURL(path.join(ROOT, 'server/auth.js')).href)
const USER = 'jelly'
const token = issueToken(USER)
const APP = process.env.APP_URL || 'http://localhost:8788'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const note = (ok, what, detail = '') => {
  results.push({ ok, what, detail })
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${what}${detail ? ` (${detail})` : ''}`)
}

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const errors = []
async function newPage(phone) {
  const page = await browser.newPage()
  if (phone) await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36' })
  else await page.setViewport({ width: 1440, height: 900 })
  page.on('pageerror', (e) => errors.push(`${phone ? '[phone] ' : ''}${page.url()}: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(`${phone ? '[phone] ' : ''}${page.url()}: ${m.text()}`))
  await page.goto(`${APP}/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate((u, t) => localStorage.setItem('studysync:session', JSON.stringify({ username: u, token: t, at: Date.now() })), USER, token)
  return page
}
const go = async (page, p) => {
  await page.goto(`${APP}${p}`, { waitUntil: 'networkidle2' }).catch(() => {})
  await sleep(1500)
}
async function text(page) {
  for (let i = 0; ; i++) {
    try {
      return await page.evaluate(() => document.querySelector('main')?.innerText || document.body.innerText)
    } catch (e) {
      if (i >= 3) throw e
      console.log('  (page navigated by itself:', page.url() + ')')
      await sleep(1500)
    }
  }
}
const click = (page, sel, re) => page.evaluate((sel, re) => {
  const el = [...document.querySelectorAll(sel)].find((e) => new RegExp(re, 'i').test(e.innerText || e.getAttribute('aria-label') || ''))
  el?.click()
  return Boolean(el)
}, sel, re)

const state = await fetch(`${APP}/api/state`, { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json())
const subjectId = state.data.subjects[0]?.id
const PAGES = ['/', '/app', '/app/today', '/app/planner', '/app/missions', '/app/calendar', '/app/subjects', `/app/subjects/${subjectId}`, '/app/assignments', '/app/exams', '/app/analytics', '/app/connect', '/app/profile', '/app/settings']

for (const phone of [false, true]) {
  const page = await newPage(phone)
  for (const p of PAGES) {
    const before = errors.length
    await go(page, p)
    const t = await text(page)
    const wide = phone ? await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1) : false
    note(t.length > 80 && errors.length === before && !wide && !/Something went wrong/i.test(t), `${phone ? 'phone' : 'desktop'} ${p}`, [errors.length > before ? 'errors' : '', wide ? 'scrolls sideways' : '', t.length <= 80 ? 'empty' : ''].filter(Boolean).join(', '))
  }
  await page.close()
}

/* ---------- live actions (desktop) ---------- */
const page = await newPage(false)
await go(page, '/app')

// Quick jump
await page.keyboard.down('Control')
await page.keyboard.press('KeyK')
await page.keyboard.up('Control')
await sleep(500)
await page.keyboard.type('mission')
await sleep(300)
await page.keyboard.press('Enter')
await sleep(1500)
note(page.url().includes('/app/missions'), 'quick jump (Ctrl+K) to Mission Planner', page.url())

// Mission: draft, then approve
await click(page, 'button', '^Draft my plan')
await page.waitForFunction(() => /Approve and add|Apply these changes|Doesn.t fit|Fits|Tight/.test(document.querySelector('main').innerText), { timeout: 30000 }).catch(() => {})
await sleep(800)
const drafted = /Approve and add (\d+)/.exec(await text(page))
note(Boolean(drafted), 'Mission Planner drafts a plan', drafted ? `${drafted[1]} blocks` : 'no approve button')
if (drafted) {
  await click(page, 'button', '^Approve and add')
  await sleep(2500)
  const t = await page.evaluate(() => document.body.innerText)
  note(/Added \d+ study blocks|Plan versus reality/.test(t), 'approving adds the blocks to the planner')
}

// Add sheets open and close
for (const [p, btn] of [['/app/exams', '^New exam'], ['/app/assignments', 'New assignment|Add assignment'], ['/app/subjects', 'Add subject|New subject'], ['/app/today', '^Add block']]) {
  await go(page, p)
  const found = await click(page, 'main button', btn)
  await sleep(700)
  const open = await page.evaluate(() => Boolean(document.querySelector('[role=dialog]')))
  await page.keyboard.press('Escape')
  await sleep(500)
  note(found && open, `add sheet opens on ${p}`)
}

// Focus timer sheet
await go(page, '/app')
await click(page, 'header button', '^Focus')
await sleep(800)
note(await page.evaluate(() => Boolean(document.querySelector('[role=dialog]'))), 'Focus opens')
await page.keyboard.press('Escape')
await sleep(500)

// Yuuki chat
await page.evaluate(() => document.querySelector('[aria-label="Talk to Yuuki"]')?.click())
await sleep(1000)
await page.type('[aria-label="Message to Yuuki"]', 'what is my next exam?', { delay: 5 })
await page.keyboard.press('Enter')
const t0 = Date.now()
await page.waitForFunction(() => {
  const lines = (document.querySelector('[aria-label="Chat with Yuuki"]')?.innerText || '').split('\n').filter(Boolean)
  const i = lines.lastIndexOf('what is my next exam?')
  return i >= 0 && lines.length > i + 1
}, { timeout: 45000 }).catch(() => {})
const reply = await page.evaluate(() => {
  const lines = (document.querySelector('[aria-label="Chat with Yuuki"]')?.innerText || '').split('\n').filter(Boolean)
  return lines[lines.lastIndexOf('what is my next exam?') + 1] || ''
})
note(reply.length > 10 && !/snag|asleep/i.test(reply), 'Yuuki answers in chat', `${((Date.now() - t0) / 1000).toFixed(1)}s: ${reply.slice(0, 90)}`)

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`)
if (errors.length) console.log('Errors:\n' + [...new Set(errors)].slice(0, 15).join('\n'))
