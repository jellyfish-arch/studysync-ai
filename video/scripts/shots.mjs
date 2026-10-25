// Screenshots of StudySync for the intro video, taken from the SANDBOX server
// (npm run dev -- --sandbox: app on 5174, API on 8788) with your installed Chrome.
// It refuses to run against the normal server, so real data is never touched.
//
//   SHOT_USER=<sandbox user> SHOT_PASS=<password> npm run shots
//
// Writes public/shots/*.png plus public/shots/shots.json: the size of each
// screenshot and where its important parts are, so the video can point at them.
import puppeteer from 'puppeteer-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const OUT = path.resolve(HERE, '../public/shots')
const APP = process.env.APP_URL || 'http://localhost:5174'
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const { SHOT_USER: USER, SHOT_PASS: PASS } = process.env
if (!USER || !PASS) throw new Error('Set SHOT_USER and SHOT_PASS (a sandbox account).')
mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let token = null
async function api(p, { method = 'GET', body } = {}) {
  const res = await fetch(`${APP}/api${p}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`${method} ${p}: ${res.status} ${json?.error || ''}`)
  return json
}

/* ---------- sandbox only ---------- */
const health = await api('/health')
if (health?.mcp?.port !== 8788) throw new Error('This is not the sandbox server (expected API port 8788). Start it with: npm run dev -- --sandbox')
token = (await api('/login', { method: 'POST', body: { username: USER, password: PASS } })).token

/* ---------- fresh demo semester, dated from today ---------- */
const { demoSemester } = await import(pathToFileURL(path.join(ROOT, 'tests/fixtures/semester.js')).href)
const today = new Date().toLocaleDateString('en-CA')
const demo = demoSemester(today)
const current = await api('/state')
const data = {
  ...demo,
  profile: { ...demo.profile, name: 'Aarav' },
  prefs: { ...demo.prefs, yuukiTips: false, cursor: false, celebrations: false, sounds: false, dailyGoal: 180 },
  guide: { ...(current.data.guide || {}), introduced: true, tourDone: true, tour: 0, seen: [] },
}
await api('/state', { method: 'PUT', body: { baseRev: current.rev, base: null, data } })
for (const p of (await api('/plans')).plans) await api(`/plans/${p.id}/status`, { method: 'POST', body: { status: 'deleted' } })
for (const c of (await api('/connections')).connections) await api(`/connections/${c.id}`, { method: 'DELETE' })
// A fresh draft for the next exam but one, waiting to be approved.
const exam = demo.exams.filter((e) => e.date > today).sort((a, b) => a.date.localeCompare(b.date))[1] || demo.exams[0]
await api('/planner/draft', { method: 'POST', body: { goal: { type: 'exam', exam: exam.id }, options: { dailyMinutes: 180 } } })
console.log('seeded sandbox for', today)

/* ---------- browser ---------- */
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none'] })
const meta = {}

async function signIn(page) {
  await page.goto(`${APP}/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(
    (u, t) => {
      localStorage.setItem('studysync:session', JSON.stringify({ username: u, token: t, at: Date.now() }))
      localStorage.removeItem(`studysync:chat:${u}`)
    },
    USER.toLowerCase(),
    token,
  )
}

// Boxes in CSS pixels of the full page: [x, y, w, h].
async function boxes(page, specs) {
  return page.evaluate((specs) => {
    const rect = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return [Math.round(r.x + scrollX), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)]
    }
    const out = {}
    for (const [key, s] of Object.entries(specs)) {
      let el = null
      if (s.sel && !s.text) el = document.querySelector(s.sel)
      else {
        // The most specific element whose text matches (not a big wrapper).
        const re = new RegExp(s.text, 'i')
        const hits = [...document.querySelectorAll(s.sel || 'h1,h2,h3,p,span,button,a,div,li')].filter((e) => re.test((e.innerText || e.getAttribute('aria-label') || '').trim()))
        el = hits.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)[0] || null
      }
      if (el && s.up) el = el.closest(s.up)
      out[key] = rect(el)
    }
    return out
  }, specs)
}

// Vite reloads a page the first time it meets new code; just try again.
async function shot(page, name, url, opts = {}) {
  for (let i = 0; ; i++) {
    try {
      return await shotOnce(page, name, url, opts)
    } catch (e) {
      if (i >= 2 || !/context was destroyed|navigation/i.test(e.message)) throw e
      console.log('retry', name)
      await sleep(2000)
    }
  }
}

async function shotOnce(page, name, url, { specs = {}, full = false, wait = 2600, before, keepScroll = false } = {}) {
  if (url) await page.goto(`${APP}${url}`, { waitUntil: 'networkidle2' }).catch(() => {})
  await sleep(wait)
  if (before) await before(page)
  if (!keepScroll) await page.evaluate(() => window.scrollTo(0, 0))
  await sleep(300)
  const size = await page.evaluate(() => ({ w: document.documentElement.clientWidth, h: document.documentElement.scrollHeight, vh: innerHeight }))
  const box = await boxes(page, specs)
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full })
  meta[name] = { w: size.w, h: full ? size.h : size.vh, boxes: box }
  console.log('shot', name, JSON.stringify(Object.fromEntries(Object.entries(box).map(([k, v]) => [k, v ? 'ok' : 'MISSING']))))
}

const CARD = '.rounded-2xl'
const NAV = Object.fromEntries(['', '/today', '/planner', '/missions', '/calendar', '/subjects', '/assignments', '/exams', '/analytics', '/connect', '/profile', '/settings'].map((p) => [`nav${p.replace('/', '_') || '_overview'}`, { sel: `aside a[href="/app${p}"]` }]))

/* ---------- logged out: landing and login ---------- */
{
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })
  await shot(page, 'landing', '/', { wait: 6000, specs: { headline: { sel: 'h1' }, login: { sel: 'a[href="/login"]' } } })
  await shot(page, 'login', '/login', { wait: 2500, specs: { form: { sel: 'form' } } })
  await ctx.close()
}

/* ---------- desktop app ---------- */
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })
await signIn(page)

await shot(page, 'overview', '/app', {
  full: true,
  wait: 3500,
  specs: {
    ...NAV,
    hero: { text: '^Good[\\s\\u00a0]', sel: 'h1', up: CARD },
    ring: { text: '^Today.s study goal$', sel: 'p,span,div', up: CARD },
    headsup: { text: '^Heads up', sel: 'p', up: CARD },
    exam: { text: '^Next exam', sel: 'span,p,div', up: CARD },
    coming: { text: '^Coming up', sel: 'h2,h3', up: CARD },
    syllabus: { text: '^Syllabus progress', sel: 'h2,h3', up: CARD },
    yuuki: { sel: '[data-tour="yuuki-dock"]' },
  },
})
await shot(page, 'today', '/app/today', {
  full: true,
  specs: { queue: { text: '^Focus queue', sel: 'h2,h3', up: CARD }, revise: { text: '^Revise today', sel: 'h2,h3', up: CARD }, due: { text: '^Due soon', sel: 'h2,h3', up: CARD }, spotlight: { sel: 'main .lg\\:col-span-4 > *' } },
})
await shot(page, 'planner', '/app/planner', { specs: { board: { sel: 'main .grid' } } })
await shot(page, 'calendar', '/app/calendar', { specs: { month: { sel: 'main .grid' } } })
const os = demo.subjects[0]
await shot(page, 'subject', `/app/subjects/${os.id}`, {
  full: true,
  specs: { header: { sel: 'main > div > *' }, unit: { sel: 'main [data-tour="syllabus"] > div' }, confidence: { sel: 'main [role="radiogroup"][aria-label^="How sure"]' }, paste: { text: '^Paste syllabus$', sel: 'button' } },
})
await shot(page, 'exams', '/app/exams', { specs: { next: { text: '^Next exam$', sel: 'span,div', up: CARD } } })
await shot(page, 'missions', '/app/missions', {
  full: true,
  wait: 4000,
  specs: {
    composer: { text: '^New mission', sel: 'h2,h3', up: CARD },
    goals: { sel: '[role="radiogroup"][aria-label="Goal"]' },
    radar: { text: '^Risk radar', sel: 'h2,h3', up: CARD },
    verdict: { text: '^(Fits|Tight|Doesn.t fit)$', sel: 'p', up: '.rounded-2xl' },
    plan: { text: 'revision 1', sel: 'p,span', up: CARD },
    approve: { text: '^Approve and add', sel: 'button' },
    days: { text: '^Day by day', sel: 'p' },
  },
})
await shot(page, 'analytics', '/app/analytics', { specs: { main: { sel: 'main' } } })
await shot(page, 'connect', '/app/connect', {
  wait: 2500,
  before: async (p) => {
    await p.evaluate(() => [...document.querySelectorAll('#connect-wizard button')].find((b) => /Claude Desktop/.test(b.innerText))?.click())
    await sleep(900)
  },
  specs: { wizard: { sel: '#connect-wizard' }, claude: { text: '^Claude Desktop', sel: '#connect-wizard button' }, chatgpt: { text: '^ChatGPT', sel: '#connect-wizard div[aria-disabled]' }, scope: { sel: '#connect-wizard [role="radiogroup"]' }, create: { text: 'Create my connection', sel: 'button' } },
})
await shot(page, 'settings', '/app/settings', { full: true, specs: { plan: { sel: '#plan' } } })

// Yuuki's chat, for real (two messages through the AI).
async function chat(p, messages) {
  await p.evaluate(() => document.querySelector('[aria-label="Talk to Yuuki"]')?.click())
  await sleep(1200)
  for (const m of messages) {
    await p.type('textarea[aria-label="Message to Yuuki"], input[aria-label="Message to Yuuki"]', m, { delay: 8 })
    await p.keyboard.press('Enter')
    const before = Date.now()
    await sleep(2500)
    // wait until the last bubble is Yuuki's answer
    while (Date.now() - before < 60000) {
      const done = await p.evaluate((m) => {
        const c = document.querySelector('[aria-label="Chat with Yuuki"]')
        const lines = (c?.innerText || '').split('\n').filter(Boolean)
        const i = lines.lastIndexOf(m)
        return i >= 0 && lines.length > i + 1 && !c.querySelector('[aria-busy="true"], .typing')
      }, m)
      if (done) break
      await sleep(1000)
    }
    await sleep(1500)
  }
}
await page.goto(`${APP}/app`, { waitUntil: 'networkidle2' }).catch(() => {})
await sleep(3000)
await chat(page, ['what should I study tonight?', 'add 1 hour of DBMS revision tomorrow at 6pm'])
await shot(page, 'chat', null, { wait: 500, specs: { panel: { sel: '[aria-label="Chat with Yuuki"]' } } })

/* ---------- phone ---------- */
const phone = await browser.newPage()
await phone.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36' })
await shot(phone, 'm-overview', '/app', { wait: 3500 })
await shot(phone, 'm-today', '/app/today', { keepScroll: true, before: async (p) => p.evaluate(() => [...document.querySelectorAll('main h2, main h3')].find((h) => /Revise today/.test(h.innerText))?.scrollIntoView({ block: 'start' })) })
await shot(phone, 'm-missions', '/app/missions', { wait: 3500 })
await phone.goto(`${APP}/app`, { waitUntil: 'networkidle2' }).catch(() => {})
await sleep(2500)
await phone.evaluate(() => document.querySelector('[aria-label="Talk to Yuuki"]')?.click())
await sleep(1500)
await shot(phone, 'm-chat', null, { wait: 300 })

writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify({ taken: new Date().toISOString(), shots: meta }, null, 2))
await browser.close()
console.log('done:', Object.keys(meta).length, 'screenshots')
