// Mission Planner, steps 8 and 9: turn an approved plan into study blocks
// (without duplicates), track plan versus reality, and repair a plan when life
// happens. Repairs never touch finished work or blocks that are not the plan's.
import { addDays, formatMinutes, shortDate, todayISO } from '../dates.js'
import { runOp } from '../ops.js'
import { generatePlan } from './engine.js'

export const taskKey = (planId, rev, taskId) => `${planId}:r${rev}:${taskId}`

// What applying revision `rev` would change. Pure: nothing is written.
export function planChanges(data, planId, rev, body, { today = todayISO() } = {}) {
  const ofPlan = data.blocks.filter((b) => b.planId === planId)
  const have = new Set(ofPlan.map((b) => b.taskId))
  // Unfinished future blocks from older revisions are replaced.
  const remove = ofPlan.filter((b) => b.planRev !== rev && !b.done && b.date >= today)
  const add = []
  let skipped = 0
  for (const day of body.days) {
    if (day.date < today) continue
    for (const t of day.tasks) {
      const key = taskKey(planId, rev, t.id)
      if (have.has(key)) {
        skipped++
        continue
      }
      add.push({ subjectId: t.subjectId, title: t.title, date: day.date, start: t.start, minutes: t.minutes, planId, planRev: rev, taskId: key })
    }
  }
  return { remove, add, skipped }
}

// Apply the changes through the normal data rules (ops.js).
export function applyChanges(data, changes) {
  let d = data
  const removed = []
  const added = []
  for (const b of changes.remove) {
    d = runOp(d, 'deleteBlock', { id: b.id }).data
    removed.push(b.id)
  }
  for (const a of changes.add) {
    const r = runOp(d, 'addBlock', a)
    d = r.data
    added.push(r.result.id)
  }
  return { data: d, added, removed }
}

// Plan versus reality for one revision.
export function planProgress(data, planId, rev, body, { today = todayISO() } = {}) {
  const blocks = new Map(data.blocks.filter((b) => b.planId === planId).map((b) => [b.taskId, b]))
  const sessions = new Map()
  for (const s of data.sessions) if (s.blockId) sessions.set(s.blockId, (sessions.get(s.blockId) || 0) + s.minutes)
  const tasks = []
  for (const day of body.days)
    for (const t of day.tasks) {
      const b = blocks.get(taskKey(planId, rev, t.id))
      const status = !b ? 'removed' : b.done ? 'done' : b.date < today ? 'missed' : 'pending'
      tasks.push({ id: t.id, title: t.title, date: b?.date || day.date, minutes: t.minutes, subjectId: t.subjectId, status, loggedMinutes: b ? sessions.get(b.id) || 0 : 0, blockId: b?.id || null })
    }
  const count = (s) => tasks.filter((t) => t.status === s).length
  const due = tasks.filter((t) => t.date < today || t.status === 'done')
  const doneMin = tasks.filter((t) => t.status === 'done').reduce((m, t) => m + t.minutes, 0)
  const logged = tasks.filter((t) => t.status === 'done').reduce((m, t) => m + t.loggedMinutes, 0)
  const missed = tasks.filter((t) => t.status === 'missed')

  // Which subjects keep slipping, and which take longer than planned.
  const bySubject = {}
  for (const t of missed) bySubject[t.subjectId] = (bySubject[t.subjectId] || 0) + 1
  const slipping = Object.entries(bySubject)
    .filter(([, n]) => n >= 2)
    .map(([subjectId, n]) => ({ subjectId, subject: data.subjects.find((s) => s.id === subjectId)?.name || 'A subject', missed: n }))
  const longer = {}
  for (const t of tasks.filter((x) => x.status === 'done' && x.loggedMinutes)) {
    const r = (longer[t.subjectId] ||= { planned: 0, logged: 0, n: 0 })
    r.planned += t.minutes
    r.logged += t.loggedMinutes
    r.n++
  }
  const underestimated = Object.entries(longer)
    .filter(([, r]) => r.n >= 2 && r.logged > r.planned * 1.25)
    .map(([subjectId, r]) => ({ subjectId, subject: data.subjects.find((s) => s.id === subjectId)?.name || 'A subject', ratio: Math.round((r.logged / r.planned) * 100) / 100 }))

  const milestones = (body.milestones || []).map((m) => {
    const relevant = tasks.filter((t) => t.date <= m.date && (m.unitId ? body.days.some((d) => d.tasks.some((x) => x.id === t.id && x.unitIds?.includes(m.unitId))) : true))
    const allDone = m.unitId ? data.topics.filter((t) => t.unitId === m.unitId).every((t) => t.done) : relevant.every((t) => t.status === 'done')
    const state = allDone ? 'met' : m.date < today ? 'missed' : 'upcoming'
    return { ...m, state }
  })

  return {
    counts: { done: count('done'), missed: missed.length, pending: count('pending'), removed: count('removed'), total: tasks.length },
    dueSoFar: due.length,
    onTrack: missed.length === 0,
    plannedMinutesDone: doneMin,
    loggedMinutes: logged,
    missed: missed.map((t) => ({ title: t.title, date: t.date, minutes: t.minutes })),
    slipping,
    underestimated,
    milestones,
    tasks,
  }
}

// Build a repair proposal: a fresh plan from today, using the same goal, with
// what changed spelled out. Completed and past blocks are left alone.
export function proposeRepair(data, stored, { today = todayISO(), now, changes = {}, maxHorizonDays } = {}) {
  const current = stored.revisions.find((r) => r.rev === stored.activeRev) || stored.revisions.at(-1)
  const prev = current.plan
  const progress = planProgress(data, stored.id, current.rev, prev, { today })
  const g = stored.goal
  const goalInput = { type: g.type, exams: g.type === 'exam' || g.type === 'exams' ? g.examIds : undefined, exam: g.type === 'exam' ? g.examIds?.[0] : undefined, targetDate: g.end && g.end > today ? g.end : addDays(today, 6) }
  const options = { ...(current.inputOptions || {}), ...changes }
  const next = generatePlan(data, goalInput, options, { today, now, excludePlanId: stored.id, maxHorizonDays })
  if (next.empty) return { empty: true, reason: next.reason, progress }

  const removeBlocks = data.blocks.filter((b) => b.planId === stored.id && !b.done && b.date >= today)
  const oldMs = new Map((prev.milestones || []).map((m) => [m.key, m]))
  const shifts = []
  for (const m of next.milestones) {
    const o = oldMs.get(m.key)
    if (o && o.date !== m.date) shifts.push({ title: m.title, from: o.date, to: m.date, later: m.date > o.date })
  }
  const dropped = (prev.milestones || []).filter((m) => !next.milestones.some((x) => x.key === m.key) && m.date >= today && m.kind !== 'exam').map((m) => m.title)
  const oldExamIds = new Set((prev.startingState?.exams || []).map((e) => e.id))
  const newDeadlines = next.startingState.exams.filter((e) => !oldExamIds.has(e.id)).map((e) => `${e.title} (${shortDate(e.date)})`)

  const lines = []
  if (progress.counts.missed) lines.push(`${progress.counts.missed} block${progress.counts.missed === 1 ? ' was' : 's were'} missed; that work is folded into the coming days.`)
  if (newDeadlines.length) lines.push(`New on your calendar: ${newDeadlines.join(', ')}.`)
  if (changes.dailyMinutes) lines.push(`Study time changed to ${formatMinutes(Number(changes.dailyMinutes))} a day.`)
  for (const s of shifts.slice(0, 6)) lines.push(`${s.title} moves from ${shortDate(s.from)} to ${shortDate(s.to)}.`)
  if (dropped.length) lines.push(`No longer fits: ${dropped.join(', ')}.`)
  if (next.deferred.length) lines.push(...next.deferred.map((d) => d.reason))
  if (!lines.length) lines.push('Nothing important changed; the plan is refreshed from today.')

  return {
    plan: next,
    progress,
    diff: {
      keepDone: progress.counts.done,
      missed: progress.missed,
      removeBlocks: removeBlocks.map((b) => ({ id: b.id, date: b.date, title: b.title })),
      addTasks: next.stats.tasks,
      milestoneShifts: shifts,
      dropped,
      newDeadlines,
      summary: lines,
    },
  }
}
