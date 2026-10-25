// End-to-end checks for the StudySync server: login, sync, connection keys,
// MCP over stdio and HTTP, permissions, plan limits and Mission Planner.
// Starts a real server on a spare port with a throwaway data folder.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawn } from 'node:child_process'
import http from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const ROOT = path.resolve(import.meta.dirname, '..')
const PORT = String(8900 + Math.floor(Math.random() * 90))
const DATA = mkdtempSync(path.join(tmpdir(), 'studysync-test-'))
const BASE = `http://127.0.0.1:${PORT}`
const env = { ...process.env, STUDYSYNC_PORT: PORT, STUDYSYNC_DATA_DIR: DATA, GROQ_API_KEY: '', GEMINI_API_KEY: '', OPENROUTER_API_KEY: '', STUDYSYNC_DEMO_PLANS: 'false' }

let server
let kalToken
let jellyToken
let auth
let ent

async function waitForHealth() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`)
      if (r.ok) return r.json()
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error('server did not start')
}

const call = (p, opts = {}, token = kalToken) =>
  fetch(`${BASE}${p}`, { ...opts, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) } })
const json = async (p, opts, token) => (await call(p, opts, token)).json()

async function newKey(scope, token = kalToken, client = 'claude-desktop') {
  const r = await call('/api/connections', { method: 'POST', body: JSON.stringify({ name: `Test ${scope}`, client, scope }) }, token)
  expect(r.status).toBe(201)
  return r.json()
}

async function httpClient(key, url = `${BASE.replace('127.0.0.1', 'localhost')}/mcp`) {
  const client = new Client({ name: 'http-test', version: '1.0.0' })
  await client.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { authorization: `Bearer ${key}` } } }))
  return client
}
const out = (r) => JSON.parse(r.content[0].text)

beforeAll(async () => {
  process.env.STUDYSYNC_PORT = PORT
  process.env.STUDYSYNC_DATA_DIR = DATA
  server = spawn(process.execPath, [path.join(ROOT, 'server/index.js')], { cwd: ROOT, env, stdio: 'ignore' })
  await waitForHealth()
  auth = await import('../server/auth.js')
  ent = await import('../server/entitlements.js')
  kalToken = auth.issueToken('kal')
  jellyToken = auth.issueToken('jelly')
}, 20000)

afterAll(() => {
  server?.kill()
  try {
    rmSync(DATA, { recursive: true, force: true })
  } catch {
    /* Windows may still hold a file */
  }
})

describe('api', () => {
  it('reports health with sync on, no AI keys and no account name', async () => {
    const h = await (await fetch(`${BASE}/api/health`)).json()
    expect(h).toMatchObject({ name: 'studysync', sync: true, ai: false })
    // No account names, and nothing about which AI providers or models are used.
    expect(JSON.stringify(h)).not.toMatch(/kal|jelly|groq|gemini|openrouter|gpt|nemotron/i)
  })

  it('leaves app pages to the app, even when their name matches an API (regression)', async () => {
    // /app/planner used to be routed to the planner API and answer "Log in again."
    const r = await fetch(`${BASE}/app/planner`)
    expect(JSON.stringify(await r.json().catch(() => ({})))).not.toMatch(/Log in again/)
  })

  it('rejects a wrong password and other hosts', async () => {
    const r = await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'kal', password: 'wrong' }) })
    expect(r.status).toBe(401)
    // fetch() will not let us change Host, so use a raw request (DNS-rebinding check).
    const status = await new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port: PORT, path: '/api/health', headers: { host: 'evil.example' } }, (res) => resolve(res.statusCode)).on('error', reject)
    })
    expect(status).toBe(403)
  })

  it.runIf(process.env.STUDYSYNC_TEST_PASSWORD)('logs in with the real password', async () => {
    const r = await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'KAL', password: process.env.STUDYSYNC_TEST_PASSWORD }) })
    expect(r.status).toBe(200)
    expect((await r.json()).username).toBe('kal')
  })

  it('needs a login token for data, connections and plans', async () => {
    for (const p of ['/api/state', '/api/connections', '/api/plans', '/api/account']) expect((await fetch(`${BASE}${p}`)).status).toBe(401)
  })

  it('merges an AI edit with an app edit made at the same time', async () => {
    const subject = { id: 's1', name: 'Database Systems', code: 'CS502', color: 'mint' }
    const v1 = { subjects: [subject], units: [], topics: [], exams: [], assignments: [], blocks: [], sessions: [] }
    const put1 = await json('/api/state', { method: 'PUT', body: JSON.stringify({ baseRev: 0, base: null, data: v1 }) })
    expect(put1.rev).toBe(1)

    const { key } = await newKey('write')
    const client = await httpClient(key)
    const r = await client.callTool({ name: 'add_exam', arguments: { subject: 'CS502', type: 'Quiz', date: '2030-01-10' } })
    expect(out(r).ok).toBe(true)
    await client.close()

    const mine = { ...put1.data, assignments: [{ id: 'a1', subjectId: 's1', title: 'Lab record', due: '2030-01-05', status: 'todo', priority: 'high', estimate: 60, notes: '' }] }
    const put2 = await json('/api/state', { method: 'PUT', body: JSON.stringify({ baseRev: 1, base: put1.data, data: mine }) })
    expect(put2.data.exams).toHaveLength(1)
    expect(put2.data.assignments).toHaveLength(1)
  })
})

describe('connection keys', () => {
  it('creates a key shown once, lists it without the secret, and revokes it', async () => {
    const { key, connection } = await newKey('read')
    expect(key).toMatch(/^ssk_[0-9a-f]{12}_/)
    expect(connection.status).toBe('waiting')
    const list = await json('/api/connections')
    expect(JSON.stringify(list)).not.toContain(key.slice(key.indexOf('_', 4) + 1)) // the secret part (it may contain _ itself)
    const del = await call(`/api/connections/${connection.id}`, { method: 'DELETE' })
    expect(del.status).toBe(200)
    const after = await fetch(`${BASE}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${key}` }, body: '{}' })
    expect(after.status).toBe(401)
  })

  it('refuses MCP without a key', async () => {
    const r = await fetch(`${BASE}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: '{}' })
    expect(r.status).toBe(401)
    expect((await fetch(`${BASE}/api/tool`, { method: 'POST', body: '{}' })).status).toBe(401)
  })

  it("can't be used to reach another account, whatever the URL or headers say", async () => {
    // jelly has a subject; kal's key must never see it
    await json('/api/state', { method: 'PUT', body: JSON.stringify({ baseRev: 0, base: null, data: { subjects: [{ id: 'j1', name: 'Jelly Physics', color: 'gold' }], units: [], topics: [], exams: [], assignments: [], blocks: [], sessions: [] } }) }, jellyToken)
    const { key } = await newKey('full')
    const client = await httpClient(key, `${BASE.replace('127.0.0.1', 'localhost')}/mcp?user=jelly`)
    const o = out(await client.callTool({ name: 'get_overview', arguments: {} }))
    expect(o.subjects.map((s) => s.name)).not.toContain('Jelly Physics')
    expect(out(await client.callTool({ name: 'delete_subject', arguments: { subject: 'Jelly Physics' } })).error).toMatch(/No subject matches/)
    await client.close()
  })

  it('a read-only key cannot see or call write tools', async () => {
    const { key } = await newKey('read')
    const client = await httpClient(key)
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name)
    expect(names).toContain('get_overview')
    expect(names).not.toContain('add_subject')
    const r = await client.callTool({ name: 'add_subject', arguments: { name: 'Sneaky' } })
    expect(r.isError).toBe(true)
    expect(out(r).error).toMatch(/Read only/)
    await client.close()
  })

  it('a read-and-add key cannot delete', async () => {
    const { key } = await newKey('write')
    const client = await httpClient(key)
    const r = await client.callTool({ name: 'delete_exam', arguments: { exam: 'Quiz' } })
    expect(out(r).error).toMatch(/delete/)
    await client.close()
  })

  it('shows connected with the app name once the AI app starts', async () => {
    const { key, connection } = await newKey('write')
    const client = await httpClient(key)
    await client.listTools()
    await client.close()
    const c = (await json('/api/connections')).connections.find((x) => x.id === connection.id)
    expect(c.status).toBe('connected')
    expect(c.lastClient).toMatch(/http-test/)
  })
})

describe('mcp over stdio', () => {
  let client
  let connectionId
  beforeAll(async () => {
    const { key, connection } = await newKey('write')
    connectionId = connection.id
    client = new Client({ name: 'stdio-test', version: '2.0.0' })
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(ROOT, 'server/stdio.js')], cwd: ROOT, env: { ...env, STUDYSYNC_KEY: key } }))
  }, 20000)
  afterAll(() => client?.close())

  it('lists the tools and prompts for its scope', async () => {
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name)
    expect(names).toEqual(expect.arrayContaining(['get_overview', 'add_subject', 'plan_study_blocks', 'generate_mission_plan', 'apply_plan_changes', 'build_academic_context']))
    expect(names).not.toContain('delete_subject')
    const { prompts } = await client.listPrompts()
    expect(prompts.map((p) => p.name)).toEqual(expect.arrayContaining(['plan_my_week', 'exam_prep', 'recover_missed_schedule', 'review_progress']))
  })

  it('creates a subject with its syllabus and plans a block', async () => {
    const add = await client.callTool({ name: 'add_subject', arguments: { name: 'Operating Systems', code: 'CS501', syllabus: 'Unit 1: Processes\nProcess states\nPCB\nUnit 2: Scheduling\nFCFS\nRound Robin' } })
    expect(add.isError).toBe(false)
    expect(out(add).imported).toEqual({ units: 2, topics: 4 })
    const plan = await client.callTool({ name: 'plan_study_blocks', arguments: { blocks: [{ subject: 'os', date: '2030-01-02', start: '6pm', minutes: 50 }] } })
    expect(out(plan).added[0]).toMatchObject({ start: '18:00', date: '2030-01-02' })
  })

  it('reports bad input as a tool error the model can fix', async () => {
    const r = await client.callTool({ name: 'add_exam', arguments: { subject: 'Chemistry', date: '2030-01-01' } })
    expect(r.isError).toBe(true)
    expect(out(r).error).toMatch(/No subject matches "Chemistry"/)
  })

  it('records the app name for the Connect AI page', async () => {
    const c = (await json('/api/connections')).connections.find((x) => x.id === connectionId)
    expect(c.lastClient).toMatch(/stdio-test/)
  })

  it('shows the AI changes to the app', async () => {
    const state = await json('/api/state')
    expect(state.data.subjects.map((s) => s.code)).toEqual(expect.arrayContaining(['CS502', 'CS501']))
    expect(state.data.blocks.length).toBeGreaterThan(0)
  })

  it('explains a missing key instead of failing silently', async () => {
    const lonely = new Client({ name: 'no-key', version: '1' })
    await lonely.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(ROOT, 'server/stdio.js')], cwd: ROOT, env: { ...env, STUDYSYNC_KEY: '' } }))
    const { tools } = await lonely.listTools()
    expect(tools[0].name).toBe('connection_help')
    expect(tools[0].description).toMatch(/connection key/)
    await lonely.close()
  })
})

describe('plans and limits', () => {
  it('checks entitlements on the server', () => {
    ent.setPlan('jelly', 'free')
    expect(ent.check('jelly', 'planner.repair').allowed).toBe(false)
    expect(ent.check('jelly', 'planner.repair').upgradeTo).toBe('plus')
    expect(ent.check('jelly', 'planner.generate', { horizonDays: 30 }).allowed).toBe(false)
    expect(ent.check('jelly', 'planner.generate', { horizonDays: 7 }).allowed).toBe(true)
    ent.setPlan('jelly', 'plus')
    expect(ent.check('jelly', 'planner.repair').allowed).toBe(true)
    expect(ent.check('jelly', 'planner.scenarios', { variants: 4 }).allowed).toBe(false)
    expect(ent.check('jelly', 'ingest.documents').reason).toMatch(/not available yet/)
  })

  it('stops at a monthly allowance', () => {
    ent.setPlan('jelly', 'free')
    for (let i = 0; i < 5; i++) ent.consume('jelly', 'planner.generate')
    const r = ent.check('jelly', 'planner.generate')
    expect(r.allowed).toBe(false)
    expect(r.reason).toMatch(/this month's 5/)
  })

  it('will not change plans from the app when demo plans are off', async () => {
    const r = await call('/api/account/plan', { method: 'POST', body: JSON.stringify({ plan: 'pro' }) })
    expect(r.status).toBe(403)
    expect((await json('/api/account')).plan).toBe('free')
  })

  it('keeps planning tools behind Plus, even when called directly', async () => {
    ent.setPlan('kal', 'free')
    const { key } = await newKey('write')
    const client = await httpClient(key)
    const r = await client.callTool({ name: 'generate_mission_plan', arguments: { goal_type: 'week' } })
    expect(out(r).error).toMatch(/included from StudySync Plus/)
    expect(out(r).upgrade.plan).toBe('Plus')
    const ctx = out(await client.callTool({ name: 'build_academic_context', arguments: { goal_type: 'week' } }))
    expect(ctx.goal.type).toBe('week')
    await client.close()
  })

  it('drafts, needs approval, applies once, and the app can see it', async () => {
    ent.setPlan('kal', 'plus')
    const { key } = await newKey('write')
    const client = await httpClient(key)
    const draft = out(await client.callTool({ name: 'generate_mission_plan', arguments: { goal_type: 'week', daily_minutes: 120 } }))
    expect(draft.state).toBe('proposed')
    expect(draft.feasibility.verdict).toBeTruthy()
    expect(draft.next_step).toMatch(/approve/)

    const refused = out(await client.callTool({ name: 'apply_plan_changes', arguments: { plan_id: draft.plan_id, revision: 1, approved_by_student: false } }))
    expect(refused.error).toMatch(/approve/)
    const applied = out(await client.callTool({ name: 'apply_plan_changes', arguments: { plan_id: draft.plan_id, revision: 1, approved_by_student: true } }))
    expect(applied, JSON.stringify(applied)).toMatchObject({ ok: true })
    expect(applied.added_blocks).toBeGreaterThan(0)
    const again = out(await client.callTool({ name: 'apply_plan_changes', arguments: { plan_id: draft.plan_id, revision: 1, approved_by_student: true } }))
    expect(again.already_applied).toBe(true)

    const { plans } = await json('/api/plans')
    expect(plans.find((p) => p.id === draft.plan_id)).toMatchObject({ status: 'active', createdBy: 'mcp' })
    const state = await json('/api/state')
    expect(state.data.blocks.filter((b) => b.planId === draft.plan_id)).toHaveLength(applied.added_blocks)

    const outcomes = out(await client.callTool({ name: 'review_plan_outcomes', arguments: {} }))
    expect(outcomes.outcomes[0].counts.total).toBe(applied.added_blocks)
    await client.close()
  })

  it('validates a plan an AI wrote itself', async () => {
    const { key } = await newKey('read')
    const client = await httpClient(key)
    const v = out(await client.callTool({ name: 'validate_plan_feasibility', arguments: { plan: { days: [{ date: '2020-01-01', tasks: [{ title: 'x', subject: 'Nope', minutes: 500, start: '25:00' }] }] } } }))
    expect(v.valid).toBe(false)
    expect(v.errors.length).toBeGreaterThanOrEqual(3)
    await client.close()
  })
})
