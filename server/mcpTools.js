// Every tool an MCP client can call, with who may call it:
//   scope        what the connection key allows (read / write / full)
//   entitlement  what the student's plan includes (Free / Plus / Pro)
// Data tools come from src/lib/tools.js (shared with Yuuki); planning tools
// are defined here because they need the server's plan store and limits.
import { TOOLS } from '../src/lib/tools.js'
import { BUFFERS, STRATEGIES, GOAL_TYPES } from '../src/lib/planner/context.js'
import { formatMinutes } from '../src/lib/dates.js'
import * as db from './db.js'
import * as planner from './planner.js'
import { SCOPES } from './connections.js'
import { EntitlementError, check, consume } from './entitlements.js'
import { PLANS } from '../src/lib/plans.js'

const S = (description, extra = {}) => ({ type: 'string', description, ...extra })
const N = (description) => ({ type: 'integer', description })
const B = (description) => ({ type: 'boolean', description })
const obj = (properties, required = []) => ({ type: 'object', properties, required })

const GOAL_PROPS = {
  goal_type: S('What to plan for.', { enum: Object.keys(GOAL_TYPES) }),
  exam: S('For goal_type "exam": exam id or title.'),
  exams: { type: 'array', items: { type: 'string' }, description: 'For goal_type "exams": exam ids or titles. Leave out to take every exam within within_days.' },
  within_days: N('For goal_type "exams": exams in the next N days (default 14).'),
  target_date: S('Last day of the plan, YYYY-MM-DD (semester and recovery plans).'),
}
const OPTION_PROPS = {
  daily_minutes: N('Study minutes available on a normal day. Ask the student; default is their daily goal.'),
  weekend_minutes: N('Study minutes on Saturdays and Sundays, if different.'),
  days_off: { type: 'array', items: { type: 'string' }, description: 'Days with no study at all, YYYY-MM-DD.' },
  minutes_per_topic: N('How long one syllabus topic takes this student (default 45).'),
  strategy: S('deadline = finish the earliest exam first; spread = keep every subject moving.', { enum: Object.keys(STRATEGIES) }),
  buffer: S('How much free time to keep each day.', { enum: Object.keys(BUFFERS) }),
  start_time: S('When study usually starts, HH:MM (default 18:00).'),
  include_assignments: B('Also schedule open assignments (default: yes, except for single-exam plans).'),
}

const goalFrom = (a) => ({ type: a.goal_type, exam: a.exam, exams: a.exams, withinDays: a.within_days, targetDate: a.target_date })
const optionsFrom = (a) => {
  const o = {}
  if (a.daily_minutes != null) o.dailyMinutes = a.daily_minutes
  if (a.weekend_minutes != null) o.weekendMinutes = a.weekend_minutes
  if (a.days_off) o.daysOff = a.days_off
  if (a.minutes_per_topic != null) o.minutesPerTopic = a.minutes_per_topic
  if (a.strategy) o.strategy = a.strategy
  if (a.buffer) o.buffer = a.buffer
  if (a.start_time) o.startTime = a.start_time
  if (a.include_assignments != null) o.includeAssignments = a.include_assignments
  return o
}

// A compact view of a plan for a model: enough to explain it, not the whole file.
function brief(stored, rev, { maxTasks = 60 } = {}) {
  const r = stored.revisions.find((x) => x.rev === rev) || stored.revisions.at(-1)
  const p = r.plan
  let shown = 0
  const days = p.days
    .filter((d) => d.tasks.length)
    .map((d) => {
      const tasks = d.tasks.slice(0, Math.max(0, maxTasks - shown)).map((t) => `${t.start} ${t.title} (${t.minutes} min)`)
      shown += tasks.length
      return { date: d.date, minutes: d.planned, tasks, more: d.tasks.length - tasks.length || undefined }
    })
  return {
    plan_id: stored.id,
    revision: r.rev,
    state: r.state,
    title: p.title,
    from: p.start,
    to: p.end,
    feasibility: { verdict: p.feasibility.verdict, summary: p.feasibility.summary, scheduled: formatMinutes(p.feasibility.scheduledMinutes), shortfall: p.feasibility.shortfallMinutes ? formatMinutes(p.feasibility.shortfallMinutes) : null },
    milestones: p.milestones.slice(0, 20).map((m) => `${m.date}: ${m.title}${m.atRisk ? ' (at risk)' : ''}`),
    days,
    assumptions: p.assumptions,
    questions: p.questions.map((q) => q.question),
    warnings: p.warnings.map((w) => w.message),
    prioritized: p.priorities.prioritized,
    deferred: p.priorities.deferred,
    carried_over: p.priorities.carried,
    completion_criteria: p.completion,
    diff: r.diff ? r.diff.summary : undefined,
    next_step:
      r.state === 'proposed'
        ? 'Show the student this summary (feasibility, milestones, what was deferred, assumptions). Only if they approve, call apply_plan_changes with approved_by_student: true. They can also approve it in StudySync > Mission Planner.'
        : 'This revision is already applied.',
  }
}

const PLANNER_TOOLS = [
  {
    name: 'build_academic_context',
    title: 'Academic context',
    description: 'Read the focused context a plan needs: the exams in scope with remaining topics per unit, assignments, existing study blocks, missed blocks, recent study history, availability, prerequisite gaps, and the questions whose answers would change the plan. Call before planning.',
    input: obj({ ...GOAL_PROPS, daily_minutes: OPTION_PROPS.daily_minutes, minutes_per_topic: OPTION_PROPS.minutes_per_topic }),
    scope: 'read',
    entitlements: ['mcp.read'],
    run: (user, a) => planner.context(user, goalFrom(a), optionsFrom(a)),
  },
  {
    name: 'analyze_academic_risks',
    title: 'Risk radar',
    description: 'List current academic risks (unready exams, overdue or unstarted assignments, busy stretches, missed blocks, prerequisite gaps), each with the reason and a suggested next step.',
    input: obj({}),
    scope: 'read',
    entitlements: ['mcp.read'],
    run: (user) => planner.risks(user),
  },
  {
    name: 'generate_mission_plan',
    title: 'Draft a mission plan',
    description:
      'Draft a study plan from the student\'s real data: milestones, daily tasks with times, buffers, assumptions, a feasibility verdict and what was deferred. It is saved as a DRAFT only; nothing is added to the calendar until the student approves it. Ask about daily study time first if you can.',
    input: obj({ ...GOAL_PROPS, ...OPTION_PROPS, note: S('Optional note to show with the plan.') }, ['goal_type']),
    scope: 'write',
    entitlements: ['mcp.planning'],
    run: (user, a) => {
      const out = planner.draft(user, { goal: goalFrom(a), options: optionsFrom(a), createdBy: 'mcp', note: a.note })
      if (out.empty) return { empty: true, reason: out.reason, questions: out.questions.map((q) => q.question) }
      return { ...brief(out.plan, 1), upgrade_hint: out.upgradeHint || undefined }
    },
  },
  {
    name: 'simulate_schedule_scenarios',
    title: 'Compare scenarios',
    description: 'Compare the same goal under different assumptions (daily study time, strategy, buffer) and report which are feasible, what each defers and how much of each exam gets covered. Nothing is saved.',
    input: obj(
      {
        ...GOAL_PROPS,
        ...OPTION_PROPS,
        variants: {
          type: 'array',
          description: 'Scenarios to compare. Leave out for: current time, 2 h a day, 4 h a day.',
          items: obj({ label: S('Short name, e.g. "4 h a day".'), daily_minutes: OPTION_PROPS.daily_minutes, strategy: OPTION_PROPS.strategy, buffer: OPTION_PROPS.buffer, minutes_per_topic: OPTION_PROPS.minutes_per_topic }, ['label']),
        },
      },
      ['goal_type'],
    ),
    scope: 'read',
    entitlements: ['mcp.planning'],
    run: (user, a) => {
      const out = planner.scenarios(user, { goal: goalFrom(a), options: optionsFrom(a), variants: (a.variants || []).map((v) => ({ label: v.label, options: optionsFrom(v) })) })
      return out.replaces.length ? { scenarios: out.rows, note: `Unfinished blocks of the active mission ${out.replaces.map((p) => `"${p.title}"`).join(', ')} were treated as free time, as if re-planning it. Use propose_plan_repair to change it.` } : out.rows
    },
  },
  {
    name: 'validate_plan_feasibility',
    title: 'Check a plan',
    description:
      'Check a plan against the real calendar: dates in the past, tasks after their exam or due date, unknown subjects or topics, clashes with existing blocks, overloaded days, unit order. Pass plan_id for a saved plan, or "plan" to check one you wrote yourself before suggesting it.',
    input: obj({
      plan_id: S('A saved mission plan.'),
      revision: N('Revision number (default: the newest).'),
      plan: obj(
        {
          days: {
            type: 'array',
            items: obj(
              {
                date: S('YYYY-MM-DD'),
                tasks: { type: 'array', items: obj({ title: S('What to study'), subject: S('Subject name, code or id'), minutes: N('Length'), start: S('HH:MM'), exam: S('Exam id or title, if for an exam'), assignment: S('Assignment id or title, if for one'), topics: { type: 'array', items: { type: 'string' }, description: 'Topic ids or exact titles' } }, ['title', 'subject', 'minutes', 'start']) },
              },
              ['date', 'tasks'],
            ),
          },
        },
        ['days'],
      ),
    }),
    scope: 'read',
    entitlements: ['mcp.read'],
    run: (user, a) => planner.validate(user, { planId: a.plan_id, rev: a.revision, plan: a.plan }),
  },
  {
    name: 'propose_plan_repair',
    title: 'Repair a plan',
    description:
      'After missed study, a new deadline or a change in available time: re-plan an active mission from today. Finished work and blocks that are not part of the plan are never touched. Returns a PROPOSED revision with what changes (missed work, moved milestones, new deadlines); apply it only after the student approves.',
    input: obj({ plan_id: S('The active plan.'), reason: S('What changed, in the student\'s words.'), daily_minutes: OPTION_PROPS.daily_minutes, weekend_minutes: OPTION_PROPS.weekend_minutes, days_off: OPTION_PROPS.days_off }, ['plan_id']),
    scope: 'write',
    entitlements: ['mcp.planning'],
    run: (user, a) => {
      const out = planner.repair(user, a.plan_id, { changes: optionsFrom(a), reason: a.reason, createdBy: 'mcp' })
      if (out.empty) return { empty: true, reason: out.reason }
      return brief(out.plan, out.plan.revisions.at(-1).rev)
    },
  },
  {
    name: 'apply_plan_changes',
    title: 'Apply an approved plan',
    description:
      'Add an approved plan revision to the student\'s calendar as study blocks (and remove the plan\'s own unfinished future blocks from older revisions). ONLY call this after the student has explicitly approved the plan in this conversation. Applying the same revision twice does nothing.',
    input: obj({ plan_id: S('Plan id.'), revision: N('Revision to apply.'), approved_by_student: B('true only if the student said yes to this plan.') }, ['plan_id', 'revision', 'approved_by_student']),
    scope: 'write',
    entitlements: ['mcp.planning'],
    run: (user, a) => {
      if (a.approved_by_student !== true) return { error: 'Show the student the plan and ask them to approve it first. Then call again with approved_by_student: true.' }
      const out = planner.approve(user, a.plan_id, a.revision, { via: 'mcp' })
      return out.already ? { ok: true, already_applied: true } : { ok: true, added_blocks: out.added, removed_blocks: out.removed, warnings: out.warnings }
    },
  },
  {
    name: 'review_plan_outcomes',
    title: 'Plan versus reality',
    description: 'Compare active plans with what actually happened: tasks done, missed and pending, milestones met or missed, subjects that keep slipping, work that takes longer than planned. Set weekly_review for a full weekly review with suggestions (Plus).',
    input: obj({ plan_id: S('One plan, or leave out for all active plans.'), weekly_review: B('Include the weekly review.') }),
    scope: 'read',
    entitlements: ['mcp.read'],
    run: (user, a) => {
      const outcomes = planner.outcomes(user, a.plan_id).map((o) => ({ ...o, tasks: undefined }))
      if (!a.weekly_review) return { outcomes }
      const allowed = check(user, 'review.weekly')
      return allowed.allowed ? { outcomes, weekly_review: planner.review(user) } : { outcomes, weekly_review: null, note: allowed.reason }
    },
  },
  {
    name: 'list_mission_plans',
    title: 'List mission plans',
    description: 'List saved mission plans with status (draft, active, archived), dates, feasibility and any revision waiting for approval.',
    input: obj({}),
    scope: 'read',
    entitlements: ['mcp.read'],
    run: (user) => planner.list(user),
  },
]

// Shared data tools, with scope and plan rules added.
const DATA_TOOLS = TOOLS.map((t) => ({
  name: t.name,
  title: t.title,
  description: t.description,
  input: t.input,
  scope: t.read ? 'read' : t.destructive ? 'full' : 'write',
  entitlements: [t.read ? 'mcp.read' : 'mcp.write'],
  counts: t.read ? null : 'mcp.write',
  destructive: Boolean(t.destructive),
  run: (user, a) => db.runTool(user, t.name, a, 'mcp'),
}))

export const ALL_TOOLS = [...DATA_TOOLS, ...PLANNER_TOOLS]
const BY_NAME = new Map(ALL_TOOLS.map((t) => [t.name, t]))
const RANK = { read: 0, write: 1, full: 2 }

export const scopeAllows = (scope, needs) => (RANK[scope] ?? -1) >= RANK[needs]

// What a connection with this scope may see.
export function toolsFor(scope) {
  return ALL_TOOLS.filter((t) => scopeAllows(scope, t.scope)).map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.input,
    annotations: { title: t.title, readOnlyHint: t.scope === 'read', destructiveHint: Boolean(t.destructive), idempotentHint: t.scope === 'read' || t.name === 'apply_plan_changes', openWorldHint: false },
  }))
}

// Run a tool for an authenticated connection. Never throws for expected
// problems: they come back as { error } so the model can explain or retry.
export function runMcpTool(auth, name, args = {}) {
  const tool = BY_NAME.get(name)
  if (!tool) return { error: `Unknown tool "${name}".` }
  if (!scopeAllows(auth.scope, tool.scope)) {
    return { error: `This connection is "${SCOPES[auth.scope]?.label}", so it can't ${tool.scope === 'full' ? 'delete things' : 'make changes'}. The student can change that in StudySync > Connect AI.` }
  }
  for (const id of tool.entitlements) {
    const r = check(auth.user, id)
    if (!r.allowed) return { error: r.reason, upgrade: r.upgradeTo ? { plan: PLANS[r.upgradeTo].label, price_inr_per_month: PLANS[r.upgradeTo].price.monthly } : undefined }
  }
  try {
    const output = tool.run(auth.user, args || {})
    if (tool.counts && !output?.error) consume(auth.user, tool.counts)
    return output
  } catch (e) {
    if (e instanceof EntitlementError) return { error: e.message, upgrade: e.result.upgradeTo ? { plan: PLANS[e.result.upgradeTo].label, price_inr_per_month: PLANS[e.result.upgradeTo].price.monthly } : undefined }
    if (e.status && e.status < 500) return { error: e.message, details: e.errors }
    throw e
  }
}
