// Free / Plus / Pro: what each plan includes. This file only DESCRIBES the
// plans (the app shows it); the limits are ENFORCED on the server in
// server/entitlements.js, which reads the same table.
//
// Prices are first guesses for India, not validated research. Payments are not
// connected yet; see docs/monetization.md.

export const PLAN_IDS = ['free', 'plus', 'pro']

export const PLANS = {
  free: { id: 'free', label: 'Free', price: { monthly: 0, yearly: 0 }, blurb: 'Everything you need to track a semester.' },
  plus: { id: 'plus', label: 'Plus', price: { monthly: 149, yearly: 999 }, blurb: 'Mission Planner, plan repair and weekly reviews.' },
  pro: { id: 'pro', label: 'Pro', price: { monthly: 299, yearly: 1999 }, blurb: 'Bigger allowances and deeper planning.' },
}

// Each capability has a stable id. `false` = not included. Otherwise an object
// of limits (perDay / perMonth counters, plus caps checked on the request).
export const ENTITLEMENTS = {
  // Mission Planner
  'planner.generate': {
    label: 'Mission plans drafted',
    free: { perMonth: 5, horizonDays: 7, activePlans: 1 },
    plus: { perMonth: 60, horizonDays: 120, activePlans: 3 },
    pro: { perMonth: 200, horizonDays: 180, activePlans: 10 },
  },
  'planner.repair': { label: 'Plan repairs', free: false, plus: { perMonth: 60 }, pro: { perMonth: 200 } },
  'planner.scenarios': {
    label: 'Scenario comparisons',
    free: { perMonth: 3, maxVariants: 2 },
    plus: { perMonth: 40, maxVariants: 3 },
    pro: { perMonth: 150, maxVariants: 6 },
  },
  'review.weekly': { label: 'Weekly reviews', free: false, plus: { perMonth: 10 }, pro: { perMonth: 40 } },

  // Yuuki's AI chat (app-paid model calls; guide mode is always free)
  'yuuki.chat': { label: 'Yuuki AI messages', free: { perDay: 15 }, plus: { perDay: 80 }, pro: { perDay: 250 } },
  'practice.quiz': { label: 'Practice quizzes', free: { perDay: 3 }, plus: { perDay: 20 }, pro: { perDay: 60 } },

  // AI apps connected through MCP
  'mcp.read': { label: 'AI apps can read your data', free: {}, plus: {}, pro: {} },
  'mcp.write': { label: 'AI app changes per day', free: { perDay: 30 }, plus: { perDay: 300 }, pro: { perDay: 1000 } },
  'mcp.planning': { label: 'Planning tools in AI apps', free: false, plus: {}, pro: {} },
  'mcp.apply': { label: 'Study blocks an approved plan may add', free: false, plus: { maxBlocks: 80 }, pro: { maxBlocks: 250 } },

  // Not built yet: listed so the limits are decided before the feature ships.
  'ingest.documents': { label: 'Syllabus/assignment documents read', free: false, plus: { perMonth: 10 }, pro: { perMonth: 40 }, comingSoon: true },
  'career.planning': { label: 'Semester-to-career planning', free: false, plus: false, pro: {}, comingSoon: true },
}

// Things that are never paywalled.
export const ALWAYS_FREE = [
  'All tracking: subjects, syllabus, exams, assignments, planner, calendar, focus mode, analytics',
  'Your data: backup, restore, export and delete',
  "Yuuki's guide, tour, tips and remarks",
  'Risk radar',
]

export function limitsFor(plan, id) {
  const e = ENTITLEMENTS[id]
  if (!e) return false
  const v = e[PLAN_IDS.includes(plan) ? plan : 'free']
  return v === false || v === undefined ? false : v
}

export function nextPlanWith(id, from = 'free') {
  const order = PLAN_IDS.slice(PLAN_IDS.indexOf(from) + 1)
  return order.find((p) => limitsFor(p, id) !== false) || null
}
