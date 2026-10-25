// End-to-end check of "Quiz me" in headless Chrome against the demo (sandbox) app:
// open a quiz from Revise today, answer with double-clicks, check the result is saved.
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

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.goto(`${APP}/login`, { waitUntil: 'domcontentloaded' })
await page.evaluate((u, t) => localStorage.setItem('studysync:session', JSON.stringify({ username: u, token: t, at: Date.now() })), USER, token)
await page.goto(`${APP}/app/today`, { waitUntil: 'networkidle2' }).catch(() => {})
await sleep(2500)

const title = await page.evaluate(() => {
  const card = [...document.querySelectorAll('main h2, main h3')].find((h) => /Revise today/.test(h.innerText)).closest('.rounded-2xl')
  const t = card.querySelector('li p.font-semibold').innerText
  ;[...card.querySelectorAll('button')].find((b) => /Quiz me/.test(b.innerText)).click()
  return t
})
console.log('quiz on:', title)
const t0 = Date.now()
await page.waitForFunction(() => /Question 1 of/.test(document.querySelector('[role=dialog]')?.innerText || ''), { timeout: 90000 })
console.log('questions ready in', ((Date.now() - t0) / 1000).toFixed(1) + 's')

const picks = []
for (let k = 0; k < 6; k++) {
  const st = await page.evaluate(() => {
    const d = document.querySelector('[role=dialog]')
    const t = d.innerText
    if (/Another quiz/.test(t)) return { done: true, text: t.replace(/\n+/g, ' | ') }
    const opts = [...d.querySelectorAll('ul button')]
    return { q: (t.match(/Question \d of \d/) || [''])[0], answered: opts.some((o) => o.disabled) }
  })
  if (st.done) {
    console.log('RESULT:', st.text.slice(0, 220))
    break
  }
  if (!st.answered) {
    // double-click two different options: only the first may count
    const shown = await page.evaluate(() => {
      const opts = [...document.querySelectorAll('[role=dialog] ul button')]
      opts[0].click()
      opts[1].click()
      return null
    })
    await sleep(400)
    const fb = await page.evaluate(() => {
      const d = document.querySelector('[role=dialog]')
      const opts = [...d.querySelectorAll('ul button')]
      const marked = opts.findIndex((o) => /border-coral|border-mint/.test(o.className) && !/border-mint/.test(o.className) ? true : /bg-coral|bg-mint/.test(o.querySelector('span')?.className || ''))
      return { feedback: (d.innerText.match(/(Correct\.|Not quite\.)/) || [''])[0], first: opts[0].className.includes('coral') ? 'wrong' : opts[0].className.includes('mint') ? 'right' : 'none', second: opts[1].className.includes('coral') ? 'wrong (BUG: second click counted)' : 'not marked wrong' }
    })
    picks.push(fb)
    console.log(st.q, JSON.stringify(fb), shown ?? '')
  }
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('[role=dialog] button')].filter((x) => /^(Next|See result)/.test(x.innerText.trim()) && !x.disabled)
    b.forEach((x) => {
      x.click()
      x.click()
    })
  })
  await sleep(900)
}

const saved = await page.evaluate(async (u, t) => {
  const s = await fetch('/api/state', { headers: { authorization: `Bearer ${t}` } }).then((r) => r.json())
  return s.data.topics.filter((x) => x.quiz).map((x) => ({ title: x.title, quiz: x.quiz, confidence: x.confidence }))
}, USER, token)
console.log('saved on server:', JSON.stringify(saved))
console.log('page errors:', errors.length ? errors : 'none')
await browser.close()
