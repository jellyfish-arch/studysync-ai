// The class-demo kit. Works only on the SANDBOX (data-sandbox/, port 8788), so
// your real account is never touched. Start the demo app first:
//
//   npm run demo                        builds the app, then serves it on
//                                       http://localhost:8788 (production build:
//                                       fast, no dev reloads). Ctrl+C to stop.
//   npm run demo:reset                  fresh demo semester for "jelly", on Plus
//   npm run demo:reset -- --intro       ...and Yuuki introduces herself again
//   npm run demo:reset -- --name Priya --plan free --user jelly
//   npm run demo:check                  is everything ready for class?
//
// The script signs in by itself, with a token made from the sandbox's own
// secret on this computer, so no password is needed.
import path from 'node:path'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

process.env.STUDYSYNC_DATA_DIR = 'data-sandbox'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href)
await imp('server/env.js')
const { issueToken } = await imp('server/auth.js')
const { setPlan } = await imp('server/entitlements.js')
const { DATA_DIR } = await imp('server/env.js')

const args = process.argv.slice(2)
const cmd = args[0]
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}
const USER = opt('user', 'jelly').toLowerCase()
const API = 'http://127.0.0.1:8788/api'
const token = issueToken(USER)
const ok = (m) => console.log(`  ✓ ${m}`)
const bad = (m) => console.log(`  ✗ ${m}`)

async function api(p, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${p}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`${method} ${p}: ${res.status} ${json?.error || ''}`)
  return json
}

async function serverUp() {
  try {
    const h = await fetch(`${API}/health`, { signal: AbortSignal.timeout(3000) }).then((r) => r.json())
    return h?.name === 'studysync' ? h : null
  } catch {
    return null
  }
}

async function reset() {
  if (!(await serverUp())) {
    console.log('The demo app is not running. Start it first with: npm run demo')
    process.exit(1)
  }
  const { demoSemester } = await imp('tests/fixtures/semester.js')
  const today = new Date().toLocaleDateString('en-CA')
  const demo = demoSemester(today)
  const current = await api('/state')
  const data = {
    ...demo,
    profile: { ...demo.profile, name: opt('name', demo.profile.name) },
    prefs: { ...demo.prefs, ...current.data.prefs, yuukiTips: true, dailyGoal: 180 },
    guide: { ...(current.data.guide || {}), introduced: !args.includes('--intro'), tourDone: true, tour: 0, seen: [] },
  }
  await api('/state', { method: 'PUT', body: { baseRev: current.rev, base: null, data } })
  for (const p of (await api('/plans')).plans) await api(`/plans/${p.id}/status`, { method: 'POST', body: { status: 'deleted' } })
  for (const c of (await api('/connections')).connections) await api(`/connections/${c.id}`, { method: 'DELETE' })
  const plan = opt('plan', 'plus')
  setPlan(USER, plan, 'demo')
  // Fresh daily allowances for the demo account.
  const usageFile = path.join(DATA_DIR, '.usage.json')
  if (existsSync(usageFile)) {
    const all = JSON.parse(readFileSync(usageFile, 'utf8'))
    delete all[USER]
    writeFileSync(usageFile, JSON.stringify(all, null, 2))
  }
  console.log(`Demo reset for "${USER}" (${data.profile.name}), dated ${today}, on ${plan}:`)
  ok(`${data.subjects.length} subjects, ${data.topics.length} topics, ${data.exams.length} exams, ${data.assignments.length} assignments, ${data.blocks.length} study blocks`)
  ok('no mission plans or AI connections yet, so you can create them live')
  ok(`allowances reset${args.includes('--intro') ? '; Yuuki will introduce herself on the next page load' : ''}`)
  console.log('\nIf the app is open, it updates by itself. To clear old chat messages: Settings > Yuuki > Clear chat and tips.')
}

async function check() {
  console.log('Demo check:')
  let good = true
  const h = await serverUp()
  if (h) ok('demo server is running')
  else {
    bad('demo app is not running. Start it with: npm run demo')
    process.exit(1)
  }
  let appUrl = null
  for (const url of ['http://localhost:8788/', 'http://localhost:5174/']) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(3000) })
      if (r.ok && /<div id="root">/.test(await r.text())) {
        appUrl = url
        break
      }
    } catch {
      /* try the next */
    }
  }
  if (appUrl) ok(`the app opens at ${appUrl}`)
  else {
    good = false
    bad('the app page does not load. Is the build there? Run: npm run demo')
  }
  const s = await api('/state')
  if (s.data.subjects.length >= 3 && s.data.exams.some((e) => e.date >= new Date().toLocaleDateString('en-CA'))) ok(`demo data is there (${s.data.subjects.length} subjects, upcoming exams)`)
  else {
    good = false
    bad('demo data is missing or old. Run: npm run demo:reset')
  }
  const acct = await api('/account')
  ok(`plan: ${acct.plan}${acct.demoSwitch ? ' (demo plan switch is on in Settings)' : ''}`)
  if (h.ai) {
    const { checkProviders } = await imp('server/llm.js')
    const r = await checkProviders()
    const working = Object.entries(r).filter(([, v]) => v.ok)
    if (working.length) ok(`Yuuki's AI works (${working.length} of 3 providers answering)`)
    else {
      good = false
      bad("no AI provider answered: Yuuki will use guide mode and Quiz me won't work. Check the internet connection.")
    }
  } else {
    good = false
    bad('no AI keys in .env: Yuuki chat and Quiz me are off')
  }
  console.log(good ? '\nReady for class.' : '\nFix the items marked ✗ before presenting.')
}

// Build the app and serve it, with the sandbox data and the demo plan switch.
function serve() {
  console.log('Building the app...')
  const b = spawnSync(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--logLevel', 'warn'], { cwd: ROOT, stdio: 'inherit' })
  if (b.status) process.exit(b.status)
  const env = { ...process.env, STUDYSYNC_DATA_DIR: 'data-sandbox', STUDYSYNC_PORT: '8788', STUDYSYNC_DEMO_PLANS: 'true' }
  const child = spawn(process.execPath, [path.join(ROOT, 'server/index.js'), '--serve'], { cwd: ROOT, env, stdio: 'inherit' })
  console.log('\nDemo app: http://localhost:8788   (Ctrl+C to stop)\n')
  const stop = () => {
    child.kill()
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  child.on('exit', (code) => process.exit(code ?? 0))
}

if (cmd === 'serve') serve()
else if (cmd === 'reset') await reset()
else if (cmd === 'check') await check()
else console.log('Use: node scripts/demo.mjs serve | reset | check')
