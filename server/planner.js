// Mission Planner service: the one place where plans are drafted, compared,
// repaired and applied, for the app and for MCP clients alike. It checks the
// student's plan (Free/Plus/Pro) before doing anything that costs a credit.
import * as db from './db.js'
import * as store from './plans.js'
import { consume, getPlan as getBillingPlan, requireEntitlement } from './entitlements.js'
import { buildAcademicContext, resolveGoal, summarizeContext } from '../src/lib/planner/context.js'
import { generatePlan, simulateScenarios } from '../src/lib/planner/engine.js'
import { normalizeExternalPlan, validatePlan } from '../src/lib/planner/validate.js'
import { applyChanges, planChanges, planProgress, proposeRepair } from '../src/lib/planner/progress.js'
import { analyzeRisks } from '../src/lib/planner/risks.js'
import { weeklyReview } from '../src/lib/planner/review.js'
import { limitsFor } from '../src/lib/plans.js'
import { nowHHMM, todayISO } from '../src/lib/dates.js'

const fail = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra })
const dataOf = (user) => db.getState(user).data
const horizonLimit = (user) => limitsFor(getBillingPlan(user), 'planner.generate')?.horizonDays || 7

export function context(user, goal = {}, options = {}) {
  return summarizeContext(buildAcademicContext(dataOf(user), goal, { today: todayISO(), options }))
}

export function risks(user) {
  return analyzeRisks(dataOf(user), { today: todayISO() })
}

export function list(user) {
  return store.listPlans(user)
}

export function get(user, id) {
  const p = store.getPlan(user, id)
  if (!p) throw fail(404, 'No such plan.')
  return p
}

export function draft(user, { goal = {}, options = {}, createdBy = 'app', note } = {}) {
  requireEntitlement(user, 'planner.generate')
  const maxHorizonDays = horizonLimit(user)
  const plan = generatePlan(dataOf(user), goal, options, { today: todayISO(), now: nowHHMM(), maxHorizonDays })
  if (plan.empty) return { empty: true, reason: plan.reason, questions: plan.questions || [] }
  const saved = store.createDraft(user, { plan, inputOptions: options, createdBy, note })
  consume(user, 'planner.generate')
  const clamped = plan.warnings.some((w) => w.code === 'horizon')
  return { plan: saved, upgradeHint: clamped && getBillingPlan(user) === 'free' ? 'Plus plans up to a whole semester ahead.' : null }
}

// Active missions with the same goal are what a comparison would re-plan, so
// their unfinished blocks count as free time. Other missions stay busy time.
function replacing(user, data, goal) {
  const g = resolveGoal(data, goal, todayISO()).goal
  return store
    .allPlans(user)
    .filter((p) => p.status === 'active' && p.goal?.type === g.type && (!['exam', 'exams'].includes(g.type) || (p.goal.examIds || []).some((id) => g.examIds.includes(id))))
    .map((p) => ({ id: p.id, title: p.title }))
}

export function scenarios(user, { goal = {}, options = {}, variants = [] } = {}) {
  const n = variants.length || 3
  requireEntitlement(user, 'planner.scenarios', { variants: n })
  const data = dataOf(user)
  const replaces = replacing(user, data, goal)
  const rows = simulateScenarios(data, goal, options, variants, { today: todayISO(), now: nowHHMM(), maxHorizonDays: horizonLimit(user), excludePlanIds: replaces.map((p) => p.id) })
  consume(user, 'planner.scenarios')
  return { rows, replaces }
}

// Check a stored revision, or a plan written by an AI app.
export function validate(user, { planId, rev, plan } = {}) {
  const data = dataOf(user)
  if (plan) {
    const { plan: normalized, errors } = normalizeExternalPlan(plan, data)
    if (!normalized) return { valid: false, errors, warnings: [] }
    const v = validatePlan(normalized, data, { today: todayISO() })
    return { ...v, errors: [...errors, ...v.errors] }
  }
  const p = get(user, planId)
  const r = p.revisions.find((x) => x.rev === (rev || p.revisions.at(-1).rev))
  if (!r) throw fail(404, 'No such revision.')
  return validatePlan(r.plan, data, { today: todayISO(), planId: p.id })
}

export function repair(user, planId, { changes = {}, reason, createdBy = 'app' } = {}) {
  requireEntitlement(user, 'planner.repair')
  const p = get(user, planId)
  if (p.status !== 'active') throw fail(400, 'Only an approved, active plan can be repaired.')
  const out = proposeRepair(dataOf(user), p, { today: todayISO(), now: nowHHMM(), changes, maxHorizonDays: horizonLimit(user) })
  if (out.empty) return { empty: true, reason: out.reason }
  const updated = store.addRevision(user, planId, { plan: out.plan, inputOptions: { ...(p.revisions.find((r) => r.rev === p.activeRev)?.inputOptions || {}), ...changes }, reason: reason || 'Repair', diff: out.diff, createdBy })
  consume(user, 'planner.repair')
  return { plan: updated, diff: out.diff, progress: out.progress }
}

// Apply an approved revision: validate against today's data, then add its
// study blocks (and remove the plan's own unfinished future blocks from older
// revisions). Applying the same revision twice does nothing.
export function approve(user, planId, rev, { via = 'app' } = {}) {
  const p = get(user, planId)
  const r = p.revisions.find((x) => x.rev === Number(rev))
  if (!r) throw fail(404, 'No such revision.')
  if (r.state === 'applied') return { already: true, plan: p, added: 0, removed: 0 }
  if (r.state === 'superseded') throw fail(409, 'That revision was replaced by a newer one.')
  if (p.status !== 'active') requireEntitlement(user, 'planner.generate', { activePlans: store.activeCount(user, p.id) })

  const data = dataOf(user)
  const v = validatePlan(r.plan, data, { today: todayISO(), planId: p.id })
  // Blocking problems (a clash, a task after an exam) stop the apply; ticked
  // topics or other warnings do not.
  if (!v.valid) throw fail(409, 'The plan no longer fits your calendar. Draft it again.', { errors: v.errors })
  const changes = planChanges(data, p.id, r.rev, r.plan, { today: todayISO() })
  if (via === 'mcp') requireEntitlement(user, 'mcp.apply', { blocks: changes.add.length })
  const result = db.mutate(user, (d) => {
    const out = applyChanges(d, changes)
    return { data: out.data, result: { added: out.added, removed: out.removed } }
  }, via === 'mcp' ? 'mcp' : 'planner')
  const updated = store.markApplied(user, p.id, r.rev, { added: result.added.length, removed: result.removed.length, skipped: changes.skipped, via })
  return { plan: updated, added: result.added.length, removed: result.removed.length, skipped: changes.skipped, warnings: v.warnings }
}

export function progress(user, planId) {
  const p = get(user, planId)
  const r = p.revisions.find((x) => x.rev === p.activeRev)
  if (!r) return { notApplied: true }
  return planProgress(dataOf(user), p.id, r.rev, r.plan, { today: todayISO() })
}

export function setStatus(user, planId, status) {
  if (!['archived', 'deleted', 'active'].includes(status)) throw fail(400, 'Status must be archived, active or deleted.')
  const p = get(user, planId)
  if (status === 'active') {
    if (!p.activeRev) throw fail(400, 'Approve the plan first.')
    requireEntitlement(user, 'planner.generate', { activePlans: store.activeCount(user, p.id) })
  }
  return store.setStatus(user, planId, status)
}

export function review(user) {
  requireEntitlement(user, 'review.weekly')
  const out = weeklyReview(dataOf(user), store.allPlans(user), { today: todayISO() })
  consume(user, 'review.weekly')
  return out
}

// Plan versus reality for every active plan (free: it's your own data).
export function outcomes(user, planId) {
  const plans = planId ? [get(user, planId)] : store.allPlans(user).filter((p) => p.status === 'active')
  return plans.map((p) => ({ id: p.id, title: p.title, ...progress(user, p.id) }))
}
