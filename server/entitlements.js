// Server-side plan checks and usage counters. Every paid capability is checked
// here, whether the request comes from the app, Yuuki or an MCP client, so
// hiding a button is never the only barrier.
//
// Plans are stored in data/.billing.json (server only, never synced from the
// browser). There is no payment provider yet: a plan changes only through
// `npm run plan -- <user> <plan>` or, when STUDYSYNC_DEMO_PLANS=true, the demo
// switch in Settings.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { ensureDataDir } from './env.js'
import { ENTITLEMENTS, PLANS, PLAN_IDS, limitsFor, nextPlanWith } from '../src/lib/plans.js'
import { normalizeUsername } from '../src/lib/accounts.js'
import { todayISO } from '../src/lib/dates.js'

const billingFile = () => path.join(ensureDataDir(), '.billing.json')
const usageFile = () => path.join(ensureDataDir(), '.usage.json')

function readJSON(f, fallback) {
  try {
    return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : fallback
  } catch {
    return fallback
  }
}
function writeJSON(f, v) {
  writeFileSync(`${f}.tmp`, JSON.stringify(v, null, 2))
  renameSync(`${f}.tmp`, f)
}

export const demoPlansEnabled = () => process.env.STUDYSYNC_DEMO_PLANS === 'true'

export function getPlan(user) {
  const b = readJSON(billingFile(), {})
  const p = b[normalizeUsername(user)]?.plan
  return PLAN_IDS.includes(p) ? p : 'free'
}

export function setPlan(user, plan, source = 'admin') {
  if (!PLAN_IDS.includes(plan)) throw Object.assign(new Error(`Plan must be one of ${PLAN_IDS.join(', ')}.`), { status: 400 })
  const b = readJSON(billingFile(), {})
  b[normalizeUsername(user)] = { plan, source, since: new Date().toISOString() }
  writeJSON(billingFile(), b)
  return plan
}

/* ---------- usage ---------- */
// The student's own calendar day (the server runs on their computer), so
// "today's" allowance resets at their midnight, not at midnight UTC.
const dayKey = () => todayISO()
const monthKey = () => todayISO().slice(0, 7)

function usageOf(all, user) {
  const u = (all[user] ||= {})
  const day = dayKey()
  const month = monthKey()
  if (u.day !== day) Object.assign(u, { day, daily: {} })
  if (u.month !== month) Object.assign(u, { month, monthly: {} })
  u.daily ||= {}
  u.monthly ||= {}
  return u
}

export function usage(user) {
  const all = readJSON(usageFile(), {})
  const u = usageOf(all, normalizeUsername(user))
  return { day: u.day, month: u.month, daily: { ...u.daily }, monthly: { ...u.monthly } }
}

// Check without counting. `ask` holds request-specific sizes, e.g.
// { horizonDays: 30 } or { variants: 3 } or { blocks: 42 }.
export function check(user, id, ask = {}) {
  const plan = getPlan(user)
  const e = ENTITLEMENTS[id]
  if (!e) return { allowed: false, id, plan, reason: `Unknown capability ${id}.` }
  const lim = limitsFor(plan, id)
  const upgradeTo = nextPlanWith(id, plan)
  const lower = (t) => (/^(Yuuki|AI)\b/.test(t) ? t : t[0].toLowerCase() + t.slice(1))
  const deny = (reason, extra = {}) => ({ allowed: false, id, plan, reason, upgradeTo, limits: lim || null, ...extra })
  if (e.comingSoon) return deny(`${e.label}: not available yet.`)
  if (lim === false) return deny(`${e.label}: ${upgradeTo ? `included from StudySync ${PLANS[upgradeTo].label}` : 'not in your plan'}.`)
  const u = usage(user)
  if (lim.perDay != null && (u.daily[id] || 0) >= lim.perDay) return deny(`You've used today's ${lim.perDay} ${lower(e.label)}. It resets tomorrow.`, { used: u.daily[id] })
  if (lim.perMonth != null && (u.monthly[id] || 0) >= lim.perMonth) return deny(`You've used this month's ${lim.perMonth} ${lower(e.label)}.`, { used: u.monthly[id] })
  if (lim.horizonDays != null && ask.horizonDays > lim.horizonDays)
    return deny(`Your plan covers up to ${lim.horizonDays} days ahead; this needs ${ask.horizonDays}.`, { cap: 'horizonDays' })
  if (lim.maxVariants != null && ask.variants > lim.maxVariants) return deny(`Your plan compares up to ${lim.maxVariants} scenarios at once.`, { cap: 'maxVariants' })
  if (lim.maxBlocks != null && ask.blocks > lim.maxBlocks) return deny(`Your plan can add up to ${lim.maxBlocks} study blocks in one go; this plan has ${ask.blocks}.`, { cap: 'maxBlocks' })
  if (lim.activePlans != null && ask.activePlans != null && ask.activePlans >= lim.activePlans)
    return deny(`Your plan keeps ${lim.activePlans} active mission${lim.activePlans === 1 ? '' : 's'} at a time. Finish or archive one first.`, { cap: 'activePlans' })
  return { allowed: true, id, plan, limits: lim }
}

export function consume(user, id, amount = 1) {
  const all = readJSON(usageFile(), {})
  const u = usageOf(all, normalizeUsername(user))
  const lim = limitsFor(getPlan(user), id) || {}
  if (lim.perDay != null || !('perMonth' in lim)) u.daily[id] = (u.daily[id] || 0) + amount
  if (lim.perMonth != null) u.monthly[id] = (u.monthly[id] || 0) + amount
  writeJSON(usageFile(), all)
}

export class EntitlementError extends Error {
  constructor(result) {
    super(result.reason)
    this.status = 402
    this.result = result
  }
}

// Check, throwing a 402 with an upgrade hint when not allowed.
export function requireEntitlement(user, id, ask) {
  const r = check(user, id, ask)
  if (!r.allowed) throw new EntitlementError(r)
  return r
}

// Everything the app needs to show the plan and remaining allowances.
export function accountSummary(user) {
  const plan = getPlan(user)
  const u = usage(user)
  const items = Object.entries(ENTITLEMENTS).map(([id, e]) => {
    const lim = limitsFor(plan, id)
    return {
      id,
      label: e.label,
      included: lim !== false && !e.comingSoon,
      comingSoon: Boolean(e.comingSoon),
      limits: lim || null,
      usedToday: u.daily[id] || 0,
      usedThisMonth: u.monthly[id] || 0,
      upgradeTo: lim === false ? nextPlanWith(id, plan) : null,
    }
  })
  return { plan, demoSwitch: demoPlansEnabled(), entitlements: items }
}
