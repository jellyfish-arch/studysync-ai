// Open one page of the demo app in headless Chrome and print errors and text.
//   node scripts/probe.mjs /app/planner
import puppeteer from 'puppeteer-core'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

process.env.STUDYSYNC_DATA_DIR = 'data-sandbox'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const { issueToken } = await import(pathToFileURL(path.join(ROOT, 'server/auth.js')).href)
const token = issueToken('jelly')
const APP = process.env.APP_URL || 'http://localhost:8788'
const url = process.argv[2] || '/app/planner'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const p = await b.newPage()
await p.setViewport({ width: 1440, height: 900 })
p.on('console', (m) => console.log('console', m.type(), m.text().slice(0, 400)))
p.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 400)))
p.on('requestfailed', (r) => console.log('failed', r.url()))
await p.goto(`${APP}/login`)
await p.evaluate((t) => localStorage.setItem('studysync:session', JSON.stringify({ username: 'jelly', token: t, at: Date.now() })), token)
await p.goto(APP + url, { waitUntil: 'networkidle2', timeout: 20000 }).catch((e) => console.log('goto', e.message))
await new Promise((r) => setTimeout(r, 2500))
console.log('MAIN:', (await p.evaluate(() => document.querySelector('main')?.innerText || `NO MAIN: ${document.body.innerText}`)).slice(0, 400))
await b.close()
