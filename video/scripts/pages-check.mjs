// Checks the static GitHub Pages build (no StudySync server): the landing
// page, deep links, and every app page on desktop and phone.
//   APP_URL=https://jellyfish-arch.github.io/studysync-ai node video/scripts/pages-check.mjs
import puppeteer from 'puppeteer-core'

const APP = (process.env.APP_URL || 'http://127.0.0.1:8790/studysync-ai').replace(/\/$/, '')
const PAGES = ['/app', '/app/today', '/app/planner', '/app/missions', '/app/calendar', '/app/subjects', '/app/assignments', '/app/exams', '/app/analytics', '/app/connect', '/app/profile', '/app/settings']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = 0
const note = (ok, what, detail = '') => {
  if (!ok) failed++
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${what}${detail ? ` (${detail})` : ''}`)
}

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })

for (const phone of [false, true]) {
  const tag = phone ? 'phone' : 'desktop'
  const page = await browser.newPage()
  if (phone) await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36' })
  else await page.setViewport({ width: 1440, height: 900 })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))
  const body = () => page.evaluate(() => document.body.innerText)

  await page.goto(`${APP}/`, { waitUntil: 'networkidle2' })
  await sleep(800)
  note((await body()).includes('StudySync'), `${tag} landing page`)

  // A deep link without a session goes to the login page (via 404.html).
  await page.evaluate(() => localStorage.clear())
  await page.goto(`${APP}/app/planner`, { waitUntil: 'networkidle2' })
  await sleep(800)
  const u = new URL(page.url())
  note(u.pathname.endsWith('/login') && u.searchParams.get('next') === '/app/planner', `${tag} deep link asks to log in`, page.url())

  // Logged in on this device only (no server, so no token).
  await page.evaluate(() => localStorage.setItem('studysync:session', JSON.stringify({ username: 'jelly', token: null, at: Date.now() })))
  if (process.env.SHOTS) {
    for (const p of ['/app', '/app/missions']) {
      await page.goto(`${APP}${p}`, { waitUntil: 'networkidle2' })
      await sleep(2500)
      await page.screenshot({ path: `${process.env.SHOTS}/${tag}${p.replaceAll('/', '_')}.png` })
    }
  }
  for (const p of PAGES) {
    errors.length = 0
    await page.goto(`${APP}${p}`, { waitUntil: 'networkidle2' }).catch(() => {})
    await sleep(1200)
    const text = await body()
    const path = new URL(page.url()).pathname
    const ok = path.endsWith(p) && text.length > 80 && !/Something went wrong|Unexpected Application Error/.test(text) && !errors.length
    note(ok, `${tag} ${p}`, ok ? '' : `${path} ${errors.join(' | ').slice(0, 200)}`)
  }
  await page.close()
}

const res = await fetch(`${APP}/manifest.webmanifest`)
const manifest = res.ok ? await res.json() : null
const icon = manifest && (await fetch(new URL(manifest.icons[0].src, `${APP}/manifest.webmanifest`)))
note(Boolean(icon?.ok), 'install manifest and icon load')

await browser.close()
console.log(failed ? `\n${failed} check(s) failed.` : '\nAll GitHub Pages checks passed.')
process.exit(failed ? 1 : 0)
