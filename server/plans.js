// Mission plans and their revisions, kept on the server in
// data/<user>.plans.json. Plans live here (not in the browser copy) so plan
// limits are enforced in one place and every revision is preserved.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { DATA_DIR, ensureDataDir } from './env.js'
import { normalizeUsername } from '../src/lib/accounts.js'

const MAX_PLANS = 50
const MAX_REVISIONS = 20
const fileFor = (u) => path.join(ensureDataDir(), `${normalizeUsername(u)}.plans.json`)

function load(user) {
  try {
    const f = fileFor(user)
    const v = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null
    return v && Array.isArray(v.plans) ? v : { plans: [] }
  } catch {
    return { plans: [] }
  }
}
function save(user, store) {
  const f = fileFor(user)
  writeFileSync(`${f}.tmp`, JSON.stringify(store, null, 2))
  renameSync(`${f}.tmp`, f)
}

export function summary(p) {
  const rev = p.revisions.find((r) => r.rev === p.activeRev) || p.revisions.at(-1)
  const latest = p.revisions.at(-1)
  return {
    id: p.id,
    title: p.title,
    goal: p.goal,
    status: p.status,
    createdBy: p.createdBy,
    created: p.created,
    updated: p.updated,
    activeRev: p.activeRev,
    latestRev: latest.rev,
    pendingRev: latest.state === 'proposed' ? latest.rev : null,
    start: rev.plan.start,
    end: rev.plan.end,
    verdict: rev.plan.feasibility?.verdict,
    tasks: rev.plan.stats?.tasks || 0,
  }
}

export function listPlans(user) {
  return load(user).plans.map(summary).sort((a, b) => b.updated.localeCompare(a.updated))
}

export function getPlan(user, id) {
  return load(user).plans.find((p) => p.id === id) || null
}

export function activeCount(user, exceptId) {
  return load(user).plans.filter((p) => p.status === 'active' && p.id !== exceptId).length
}

export function createDraft(user, { plan, inputOptions, createdBy = 'app', note }) {
  const store = load(user)
  // Old drafts that were never approved make way for new ones.
  if (store.plans.length >= MAX_PLANS) {
    const i = store.plans.findIndex((p) => p.status === 'draft')
    if (i >= 0) store.plans.splice(i, 1)
    else throw Object.assign(new Error('Too many saved plans. Archive or delete some first.'), { status: 400 })
  }
  const now = new Date().toISOString()
  const p = {
    id: `m${randomBytes(5).toString('hex')}`,
    title: plan.title,
    goal: plan.goal,
    status: 'draft',
    createdBy,
    note: note ? String(note).slice(0, 200) : null,
    created: now,
    updated: now,
    activeRev: null,
    revisions: [{ rev: 1, created: now, createdBy, reason: 'First draft', inputOptions, plan, state: 'proposed' }],
  }
  store.plans.push(p)
  save(user, store)
  return p
}

export function addRevision(user, id, { plan, inputOptions, reason, diff, createdBy = 'app' }) {
  const store = load(user)
  const p = store.plans.find((x) => x.id === id)
  if (!p) return null
  // Only one open proposal at a time: a newer one replaces it.
  if (p.revisions.at(-1).state === 'proposed' && p.revisions.length > 1) p.revisions.pop()
  const rev = Math.max(...p.revisions.map((r) => r.rev)) + 1
  p.revisions.push({ rev, created: new Date().toISOString(), createdBy, reason: reason || 'Repair', inputOptions, plan, diff, state: 'proposed' })
  while (p.revisions.length > MAX_REVISIONS) p.revisions.splice(1, 1) // keep the first and the newest
  p.updated = new Date().toISOString()
  save(user, store)
  return p
}

export function markApplied(user, id, rev, applied) {
  const store = load(user)
  const p = store.plans.find((x) => x.id === id)
  if (!p) return null
  for (const r of p.revisions) {
    if (r.rev === rev) Object.assign(r, { state: 'applied', appliedAt: new Date().toISOString(), applied })
    else if (r.state === 'applied') r.state = 'superseded'
  }
  Object.assign(p, { status: 'active', activeRev: rev, updated: new Date().toISOString() })
  save(user, store)
  return p
}

export function setStatus(user, id, status) {
  const store = load(user)
  const p = store.plans.find((x) => x.id === id)
  if (!p) return null
  if (status === 'deleted') {
    store.plans = store.plans.filter((x) => x.id !== id)
    save(user, store)
    return { id, deleted: true }
  }
  p.status = status
  p.updated = new Date().toISOString()
  save(user, store)
  return p
}

export function allPlans(user) {
  return load(user).plans
}

export const plansDir = () => DATA_DIR
