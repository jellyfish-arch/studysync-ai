// Mission Planner, steps 3 to 6: turn the academic context into a plan with
// milestones and daily tasks, then say honestly whether it fits.
//
// This is ordinary, deterministic code (no AI model), so the same inputs give
// the same plan, it works offline in tests, and an AI app can ask for a plan
// through MCP without being trusted to do the arithmetic itself.
import { addDays, daysBetween, formatMinutes, nowHHMM, shortDate, todayISO } from '../dates.js'
import { BUFFERS, DEFAULTS, STRATEGIES, buildAcademicContext } from './context.js'

const pad = (n) => String(n).padStart(2, '0')
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const isISO = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
export const toMin = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number)
  return h * 60 + (m || 0)
}
export const toHHMM = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`
const weekday = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

const MIN_PIECE = 20 // never schedule less than this
const LATEST = 23 * 60 + 30 // nothing should end later than 23:30
const EARLIEST = 7 * 60
const BREAK = 10

export function resolveOptions(data, o = {}) {
  const num = (v) => (v === '' || v == null ? null : Number(v))
  return {
    dailyMinutes: clamp(num(o.dailyMinutes) || data.prefs?.dailyGoal || 180, 15, 900),
    weekendMinutes: num(o.weekendMinutes) == null || Number.isNaN(num(o.weekendMinutes)) ? null : clamp(num(o.weekendMinutes), 0, 900),
    daysOff: Array.isArray(o.daysOff) ? o.daysOff.filter(isISO) : [],
    minutesPerTopic: clamp(num(o.minutesPerTopic) || DEFAULTS.minutesPerTopic, 10, 240),
    revisionMinutes: clamp(num(o.revisionMinutes) || DEFAULTS.revisionMinutes, 15, 240),
    practiceMinutes: clamp(num(o.practiceMinutes) || DEFAULTS.practiceMinutes, 15, 240),
    buffer: BUFFERS[o.buffer] != null ? o.buffer : DEFAULTS.buffer,
    strategy: STRATEGIES[o.strategy] ? o.strategy : DEFAULTS.strategy,
    startTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(o.startTime || '') ? o.startTime : DEFAULTS.startTime,
    maxBlock: clamp(num(o.maxBlock) || Math.max(45, data.prefs?.focusLength || 45), 20, 180),
    // A one-exam mission focuses on that exam unless asked to include assignments.
    includeAssignments: o.includeAssignments ?? o.goalType !== 'exam',
    includeRevision: o.includeRevision !== false,
  }
}

function split(total, size) {
  const n = Math.max(1, Math.ceil(total / size))
  const base = Math.floor(total / n)
  return Array.from({ length: n }, (_, i) => base + (i < total - base * n ? 1 : 0))
}

const short = (data, subjectId) => {
  const s = data.subjects.find((x) => x.id === subjectId)
  return s ? s.code || s.name : 'Study'
}
const clip = (s, n = 110) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

function planTitle(ctx, end) {
  const g = ctx.goal
  if (g.type === 'exam' && ctx.exams[0]) return `Prepare for ${ctx.exams[0].title}`
  if (g.type === 'exams') return `${ctx.exams.length} exam${ctx.exams.length === 1 ? '' : 's'} by ${shortDate(end)}`
  if (g.type === 'recovery') return `Catch-up plan to ${shortDate(end)}`
  if (g.type === 'semester') return `Semester plan to ${shortDate(end)}`
  return `Week of ${shortDate(ctx.today)}`
}

/**
 * generatePlan(data, goal, options, env)
 *   goal:    { type: week|exam|exams|recovery|semester, exam, exams, targetDate, withinDays }
 *   options: { dailyMinutes, weekendMinutes, daysOff, minutesPerTopic, buffer, strategy, startTime, ... }
 *   env:     { today, now, excludePlanId, excludePlanIds, maxHorizonDays }
 *            (blocks of excluded plans count as free time: they are being re-planned)
 */
export function generatePlan(data, goal = {}, rawOptions = {}, env = {}) {
  const today = env.today || todayISO()
  const now = env.now || nowHHMM()
  const ctx = buildAcademicContext(data, goal, { today, now, options: rawOptions })
  const opts = resolveOptions(data, { ...rawOptions, goalType: ctx.goal.type })
  const warnings = ctx.notes.map((message) => ({ level: 'info', code: 'note', message }))
  let end = ctx.horizon.end
  if (!end) {
    return { empty: true, reason: ctx.goal.type === 'exam' ? 'There are no upcoming exams to prepare for. Add one first.' : 'Pick an end date: there are no exams on your calendar.', context: ctx, questions: ctx.questions }
  }
  if (env.maxHorizonDays && daysBetween(today, end) + 1 > env.maxHorizonDays) {
    end = addDays(today, env.maxHorizonDays - 1)
    warnings.push({ level: 'info', code: 'horizon', message: `Your plan reaches ${env.maxHorizonDays} days ahead, so this one stops on ${shortDate(end)}. Work after that is carried over.` })
  }

  /* ---------- days and how much time each has ---------- */
  const excluded = new Set([env.excludePlanId, ...(env.excludePlanIds || [])].filter(Boolean))
  const existing = data.blocks.filter((b) => !b.done && b.date >= today && b.date <= end && !excluded.has(b.planId))
  const otherMission = existing.filter((b) => b.planId).reduce((n, b) => n + (b.minutes || 0), 0)
  if (otherMission >= 60)
    warnings.push({ level: 'info', code: 'other-mission', message: `${formatMinutes(otherMission)} of these days is already booked by another mission plan, so this one works around it. To change that plan, repair it instead.` })
  const examDays = new Set(data.exams.map((e) => e.date))
  const days = []
  for (let date = today; date <= end; date = addDays(date, 1)) {
    const dow = weekday(date)
    let base = (dow === 0 || dow === 6) && opts.weekendMinutes != null ? opts.weekendMinutes : opts.dailyMinutes
    if (opts.daysOff.includes(date)) base = 0
    if (date === today) base = Math.min(base, Math.max(0, LATEST - Math.max(toMin(now) + 10, EARLIEST) - 15))
    const busy = existing.filter((b) => b.date === date)
    const existingMinutes = busy.reduce((n, b) => n + b.minutes, 0)
    let cap = Math.max(0, base - existingMinutes)
    if (examDays.has(date)) cap = Math.round(cap * 0.5)
    const usable = Math.round(cap * (1 - BUFFERS[opts.buffer]))
    days.push({ date, base, existingMinutes, exam: examDays.has(date), off: opts.daysOff.includes(date), capacity: usable, left: usable, blocks: [], busy })
  }
  const byDate = new Map(days.map((d) => [d.date, d]))

  /* ---------- the work: one stream per exam / assignment ---------- */
  const streams = []
  const fixed = []
  let order = 0
  for (const e of ctx.exams) {
    const items = []
    for (const u of e.units) for (const t of u.topicsLeft) items.push({ kind: 'topics', minutes: opts.minutesPerTopic, left: opts.minutesPerTopic, topicId: t.id, unitId: u.id, title: t.title })
    // Topics they marked shaky get a shorter revision slot after the new ones.
    const reviseMin = Math.max(MIN_PIECE, Math.round(opts.minutesPerTopic / 2))
    for (const u of e.units) for (const t of u.shaky || []) items.push({ kind: 'revise', minutes: reviseMin, left: reviseMin, topicId: t.id, unitId: u.id, title: t.title })
    const s = {
      key: `exam:${e.id}`,
      kind: 'exam',
      examId: e.id,
      subjectId: e.subjectId,
      // Several subjects often have a "Mid-semester exam": say whose.
      label: `${short(data, e.subjectId)} ${e.title}`,
      deadline: addDays(e.date, -1),
      hardDate: e.date,
      readiness: e.readinessPct,
      order: order++,
      items,
      demand: items.reduce((n, i) => n + i.minutes, 0),
      unitTitles: Object.fromEntries(e.units.map((u) => [u.id, u.title])),
      unitOrder: Object.fromEntries(e.units.map((u, i) => [u.id, i])),
    }
    streams.push(s)
    if (opts.includeRevision && e.date <= end) {
      const sub = short(data, e.subjectId)
      if (e.date > today) fixed.push({ stream: s, kind: 'revision', date: addDays(e.date, -1), minutes: opts.revisionMinutes, title: `${sub}: final revision for ${e.title}` })
      if (e.daysLeft >= 3 && e.topicsTotal >= 4) fixed.push({ stream: s, kind: 'practice', date: addDays(e.date, -2), minutes: opts.practiceMinutes, title: `${sub}: practice questions for ${e.title}` })
      if (e.daysLeft >= 10 && items.length >= 6)
        fixed.push({ stream: s, kind: 'checkpoint', date: addDays(today, Math.floor(e.daysLeft * 0.55)), minutes: 30, title: `${sub}: checkpoint, revise what you've covered` })
    }
  }
  for (const a of opts.includeAssignments ? ctx.assignments : []) {
    const deadline = a.overdue || a.due <= today ? today : addDays(a.due, -1)
    const parts = split(a.estimateMinutes, opts.maxBlock)
    streams.push({
      key: `asg:${a.id}`,
      kind: 'assignment',
      assignmentId: a.id,
      subjectId: a.subjectId,
      label: a.title,
      deadline,
      hardDate: a.due,
      boost: a.overdue ? 3 : a.priority === 'high' ? 2 : a.priority === 'medium' ? 1 : 0,
      order: order++,
      items: parts.map((m, i) => ({ kind: 'assignment', minutes: m, left: m, title: parts.length > 1 ? `${a.title} (part ${i + 1} of ${parts.length})` : a.title })),
      demand: a.estimateMinutes,
      overdue: a.overdue,
    })
  }
  if (ctx.goal.type === 'recovery') {
    for (const b of ctx.missedBlocks) {
      streams.push({
        key: `missed:${b.id}`,
        kind: 'catchup',
        subjectId: b.subjectId,
        label: b.title,
        deadline: end,
        hardDate: end,
        order: order++,
        items: [{ kind: 'catchup', minutes: b.minutes, left: b.minutes, title: `Catch up: ${b.title}`, fromBlockId: b.id }],
        demand: b.minutes,
      })
    }
  }
  // A week with nothing due still moves forward: continue the syllabus of
  // subjects that have topics left (soft work, never counted as "infeasible").
  if (ctx.goal.type === 'week' || ctx.goal.type === 'recovery') {
    const covered = new Set(streams.filter((s) => s.kind === 'exam').map((s) => s.subjectId))
    for (const subj of data.subjects) {
      if (covered.has(subj.id)) continue
      const units = data.units.filter((u) => u.subjectId === subj.id).sort((a, b) => a.order - b.order)
      const items = units.flatMap((u) => data.topics.filter((t) => t.unitId === u.id && !t.done).map((t) => ({ kind: 'topics', minutes: opts.minutesPerTopic, left: opts.minutesPerTopic, topicId: t.id, unitId: u.id, title: t.title })))
      if (items.length)
        streams.push({ key: `subject:${subj.id}`, kind: 'subject', subjectId: subj.id, label: subj.name, deadline: addDays(end, 365), hardDate: null, soft: true, order: order++, items, demand: 0, unitTitles: Object.fromEntries(units.map((u) => [u.id, u.title])) })
    }
  }

  /* ---------- place fixed sessions (revision, practice, checkpoints) ---------- */
  const deferred = []
  fixed.sort((a, b) => a.date.localeCompare(b.date))
  for (const f of fixed) {
    let placed = false
    for (let d = f.date; d >= today; d = addDays(d, -1)) {
      const day = byDate.get(d)
      if (!day || day.left < Math.min(f.minutes, MIN_PIECE + 10)) continue
      const minutes = Math.min(f.minutes, day.left)
      day.blocks.push({ stream: f.stream, kind: f.kind, minutes, title: f.title, topicIds: [], unitIds: [] })
      day.left -= minutes
      placed = true
      break
    }
    if (!placed) deferred.push({ kind: f.kind, title: f.title, minutes: f.minutes, streamKey: f.stream.key, reason: `No free time left before ${shortDate(f.stream.hardDate)}.` })
  }

  /* ---------- fill each day with the most urgent work ---------- */
  const remaining = (s) => s.items.reduce((n, i) => n + i.left, 0)
  const lastDayIdx = days.length - 1
  function slack(s, fromIdx) {
    let cap = 0
    for (let i = fromIdx; i <= lastDayIdx && days[i].date <= s.deadline; i++) cap += days[i].left
    if (s.deadline > end) cap += daysBetween(end, s.deadline) * opts.dailyMinutes * 0.85
    return cap - remaining(s)
  }
  const cmp = (a, b) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
    return 0
  }
  // Put the next piece of stream s into day. False when it doesn't fit.
  function place(day, s) {
    const item = s.items[0]
    let take = Math.min(item.left, day.left)
    // Don't leave a sliver for later (a 41-of-45-minute topic today would
    // leave a 4-minute block tomorrow): keep at least MIN_PIECE for the rest.
    const rest = item.left - take
    if (rest > 0 && rest < MIN_PIECE) take = item.left - MIN_PIECE
    if (take < MIN_PIECE && item.left > take) return false
    const last = day.blocks.at(-1)
    const sameUnit = last && last.stream === s && last.kind === item.kind && last.minutes + take <= opts.maxBlock
    if (sameUnit) {
      last.minutes += take
      if (item.topicId && !last.topicIds.includes(item.topicId)) last.topicIds.push(item.topicId)
      if (item.unitId && !last.unitIds.includes(item.unitId)) last.unitIds.push(item.unitId)
      if (!last.titles.includes(item.title)) last.titles.push(item.title)
    } else {
      day.blocks.push({ stream: s, kind: item.kind, minutes: take, titles: [item.title], topicIds: item.topicId ? [item.topicId] : [], unitIds: item.unitId ? [item.unitId] : [], fromBlockId: item.fromBlockId })
    }
    item.left -= take
    day.left -= take
    if (item.left <= 0) s.items.shift()
    return true
  }
  days.forEach((day, idx) => {
    while (day.left >= MIN_PIECE) {
      const open = streams.filter((s) => s.items.length && s.deadline >= day.date)
      if (!open.length) break
      const keyOf = (s) =>
        opts.strategy === 'spread' && !s.soft ? [s.soft ? 1 : 0, slack(s, idx), s.deadline, s.order] : [s.soft ? 1 : 0, s.deadline, -(s.boost || 0), s.order]
      const s = open.slice().sort((a, b) => cmp(keyOf(a), keyOf(b)))[0]
      if (!place(day, s)) break
    }
  })

  // Topics before polish: when an exam's topics don't all fit, the time set
  // aside for its checkpoint, practice and final revision goes to covering
  // topics first. Revising what was never studied doesn't help.
  const gaveUp = new Map()
  for (const s of streams) {
    if (s.kind !== 'exam' || !s.items.length || s.deadline > end) continue
    for (const kind of ['checkpoint', 'practice', 'revision']) {
      for (const day of days) {
        if (!s.items.length) break
        const i = day.blocks.findIndex((b) => b.stream === s && b.kind === kind)
        if (i < 0) continue
        const b = day.blocks[i]
        const give = Math.min(b.minutes, remaining(s))
        b.minutes -= give
        day.left += give
        if (b.minutes < MIN_PIECE) {
          day.left += b.minutes
          day.blocks.splice(i, 1)
        }
        while (day.left >= MIN_PIECE && s.items.length && place(day, s));
        gaveUp.set(s, [...new Set([...(gaveUp.get(s) || []), kind])])
      }
    }
  }

  const carried = []
  for (const s of streams) {
    if (!s.items.length) continue
    const minutes = remaining(s)
    const topics = s.items.filter((i) => i.topicId && i.kind === 'topics').length
    const what = topics ? `${topics} topic${topics === 1 ? '' : 's'}` : formatMinutes(minutes)
    const many = topics > 1 // "2 topics ... don't fit", "1 topic / 40 min ... doesn't fit"
    if (s.soft || s.deadline > end) carried.push({ streamKey: s.key, label: s.label, minutes, topics, reason: `${what} of ${s.label} ${many ? 'continue' : 'continues'} after ${shortDate(end)}.` })
    else deferred.push({ kind: s.kind, streamKey: s.key, title: s.label, minutes, topics, reason: `${what} of ${s.label} ${many ? "don't" : "doesn't"} fit ${s.overdue ? "in today (it's overdue)" : `before ${shortDate(s.hardDate)}`}.` })
  }

  /* ---------- start times around existing blocks ---------- */
  const lateNights = new Set()
  let n = 0
  const outDays = days.map((day) => {
    const busy = day.busy.map((b) => [toMin(b.start), toMin(b.start) + b.minutes]).sort((a, b) => a[0] - b[0])
    const need = day.blocks.reduce((m, b) => m + b.minutes + BREAK, 0)
    const busyMin = busy.reduce((m, [s, e]) => m + (e - s) + BREAK, 0)
    let cursor = day.date === today ? Math.max(toMin(opts.startTime), Math.ceil((toMin(now) + 10) / 5) * 5) : toMin(opts.startTime)
    if (day.date !== today && cursor + need + busyMin > LATEST) cursor = Math.max(EARLIEST, LATEST - need - busyMin)
    // Revision and practice go last in the day, after new topics.
    const ordered = day.blocks.slice().sort((a, b) => (a.kind === 'revision') - (b.kind === 'revision'))
    const tasks = ordered.map((b) => {
      let t = cursor
      for (let moved = true; moved; ) {
        moved = false
        for (const [s, e] of busy) {
          if (t < e + BREAK && t + b.minutes > s - BREAK) {
            t = e + BREAK
            moved = true
          }
        }
      }
      cursor = t + b.minutes + BREAK
      if (t + b.minutes > LATEST) lateNights.add(day.date)
      const sub = short(data, b.stream.subjectId)
      const title =
        b.kind === 'topics' ? clip(`${sub}: ${b.titles.join(', ')}`) : b.kind === 'revise' ? clip(`${sub}: revise ${b.titles.join(', ')}`) : b.kind === 'assignment' ? clip(b.titles[0]) : b.kind === 'catchup' ? clip(b.titles[0]) : clip(b.title)
      return {
        id: `t${++n}`,
        kind: b.kind,
        title,
        minutes: b.minutes,
        start: toHHMM(Math.min(t, 23 * 60 + 55)),
        subjectId: b.stream.subjectId,
        streamKey: b.stream.key,
        examId: b.stream.examId || null,
        assignmentId: b.stream.assignmentId || null,
        unitIds: b.unitIds,
        topicIds: b.topicIds,
        fromBlockId: b.fromBlockId || null,
      }
    })
    return { date: day.date, capacity: day.capacity, existingMinutes: day.existingMinutes, exam: day.exam, off: day.off, planned: tasks.reduce((m, t) => m + t.minutes, 0), tasks }
  })

  /* ---------- milestones ---------- */
  const milestones = []
  const lastDateOf = (pred) => outDays.filter((d) => d.tasks.some(pred)).map((d) => d.date).at(-1)
  for (const s of streams.filter((x) => x.kind === 'exam')) {
    const e = ctx.exams.find((x) => x.id === s.examId)
    for (const u of e.units) {
      if (!u.topicsLeft.length) continue
      const date = lastDateOf((t) => t.streamKey === s.key && t.unitIds.includes(u.id) && t.kind === 'topics')
      const atRisk = deferred.some((d) => d.streamKey === s.key)
      if (date) milestones.push({ key: `${s.key}:unit:${u.id}`, kind: 'unit', date, title: `${short(data, s.subjectId)}: ${u.title} covered`, criteria: `All ${u.topicsLeft.length} remaining topics in ${u.title} ticked`, examId: e.id, unitId: u.id, atRisk })
    }
    for (const k of ['practice', 'revision']) {
      const date = lastDateOf((t) => t.streamKey === s.key && t.kind === k)
      if (date) milestones.push({ key: `${s.key}:${k}`, kind: k, date, title: k === 'practice' ? `Practice questions for ${e.title}` : `Final revision for ${e.title}`, examId: e.id })
    }
    if (e.date <= end) milestones.push({ key: `${s.key}:exam`, kind: 'exam', date: e.date, title: e.title, examId: e.id, criteria: 'Sit the exam' })
  }
  for (const s of streams.filter((x) => x.kind === 'assignment')) {
    const date = lastDateOf((t) => t.streamKey === s.key)
    if (date) milestones.push({ key: `${s.key}:done`, kind: 'assignment', date, title: `Finish ${s.label}`, criteria: `Marked done by ${shortDate(s.hardDate)}`, assignmentId: s.assignmentId, due: s.hardDate, atRisk: deferred.some((d) => d.streamKey === s.key) })
  }
  milestones.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'exam') - (b.kind === 'exam'))

  /* ---------- feasibility ---------- */
  const capacity = outDays.reduce((m, d) => m + d.capacity, 0)
  const scheduled = outDays.reduce((m, d) => m + d.planned, 0)
  const hard = streams.filter((s) => !s.soft && s.deadline <= end)
  const fixedDemand = fixed.reduce((m, f) => m + f.minutes, 0)
  const demand = hard.reduce((m, s) => m + s.demand, 0) + fixedDemand
  const shortfall = deferred.reduce((m, d) => m + d.minutes, 0)
  const perDeadline = hard
    .slice()
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .map((s) => {
      const need = hard.filter((x) => x.deadline <= s.deadline).reduce((m, x) => m + x.demand, 0) + fixed.filter((f) => f.date <= s.deadline).reduce((m, f) => m + f.minutes, 0)
      const have = outDays.filter((d) => d.date <= s.deadline).reduce((m, d) => m + d.capacity, 0)
      return { title: s.label, date: s.hardDate, demandMinutes: need, capacityMinutes: have, ratio: have ? Math.round((need / have) * 100) / 100 : need ? 99 : 0 }
    })
  const worst = Math.max(0, ...perDeadline.map((p) => p.ratio))
  const utilization = capacity ? Math.round((scheduled / capacity) * 100) / 100 : 0
  const verdict = deferred.length ? 'infeasible' : worst > 0.9 || utilization > 0.92 ? 'tight' : 'feasible'
  const feasibility = {
    verdict,
    demandMinutes: demand,
    capacityMinutes: capacity,
    scheduledMinutes: scheduled,
    shortfallMinutes: shortfall,
    utilization,
    perDeadline,
    summary:
      verdict === 'infeasible'
        ? `Not everything fits: about ${formatMinutes(shortfall)} of work is left over. See what was deferred, or try more study time.`
        : verdict === 'tight'
          ? `It fits, but only just (${Math.round(Math.max(worst, utilization) * 100)}% of your time before the busiest deadline). One missed day will hurt.`
          : `It fits with room to spare: ${formatMinutes(capacity - scheduled)} of your study time is still free.`,
  }

  /* ---------- warnings ---------- */
  const deadlines = [...ctx.exams.map((e) => ({ date: e.date, title: e.title })), ...ctx.assignments.map((a) => ({ date: a.due, title: a.title }))].sort((a, b) => a.date.localeCompare(b.date))
  for (let i = 0; i < deadlines.length; i++) {
    const near = deadlines.filter((d) => d.date >= deadlines[i].date && daysBetween(deadlines[i].date, d.date) <= 2)
    if (near.length >= 3) {
      warnings.push({ level: 'warn', code: 'crunch', message: `Busy stretch: ${near.length} deadlines between ${shortDate(near[0].date)} and ${shortDate(near.at(-1).date)} (${near.map((d) => d.title).join(', ')}).` })
      break
    }
  }
  for (const gap of ctx.prerequisiteGaps)
    warnings.push({ level: 'info', code: 'prerequisite', message: `${gap.exam} starts at a later unit, but "${gap.unit}" is only ${gap.donePct}% done. If later units build on it, plan a quick review. (StudySync doesn't know the real links between units.)` })
  const avg = ctx.history.averagePerDayLast14
  if (ctx.history.activeDaysLast14 >= 3 && avg < opts.dailyMinutes * 0.6)
    warnings.push({ level: 'warn', code: 'reality', message: `Over the last two weeks you studied about ${formatMinutes(avg)} a day on average. This plan expects ${formatMinutes(opts.dailyMinutes)}. If that feels like a stretch, compare a lighter scenario.` })
  for (const [st, kinds] of gaveUp)
    warnings.push({ level: 'warn', code: 'no-revision', message: `Not all topics for ${st.label} fit, so the time for its ${kinds.map((k) => (k === 'checkpoint' ? 'checkpoint' : k === 'practice' ? 'practice questions' : 'final revision')).join(' and ')} went to new topics instead. More study time would bring it back.` })
  if (lateNights.size) warnings.push({ level: 'warn', code: 'late', message: `Some days run past 11:30 pm (${[...lateNights].map(shortDate).join(', ')}). Start earlier or study less those days.` })
  if (!opts.includeAssignments && ctx.assignments.length)
    warnings.push({ level: 'info', code: 'assignments', message: `${ctx.assignments.length} assignment${ctx.assignments.length === 1 ? ' is' : 's are'} also due by ${shortDate(end)} and not in this plan: ${ctx.assignments.map((a) => a.title).join(', ')}.` })
  if (ctx.missedBlocks.length >= 3 && ctx.goal.type !== 'recovery')
    warnings.push({ level: 'info', code: 'missed', message: `${ctx.missedBlocks.length} study blocks were missed in the last two weeks. A catch-up plan can fold them in.` })

  /* ---------- explanation ---------- */
  const prioritized = streams
    .filter((s) => !s.soft && s.demand > 0)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .map((s) =>
      s.kind === 'exam'
        ? `${s.label}: ${daysBetween(today, s.hardDate)} days away, ${s.readiness}% ready, ${plural(Math.round(s.demand / opts.minutesPerTopic), 'topic')} to cover.`
        : s.kind === 'assignment'
          ? `${s.label}: ${s.overdue ? 'overdue' : `due ${shortDate(s.hardDate)}`}, about ${formatMinutes(s.demand)}.`
          : `${s.label}: missed earlier, about ${formatMinutes(s.demand)}.`,
    )

  const assumptions = [
    `Each topic takes about ${opts.minutesPerTopic} min${rawOptions.minutesPerTopic ? '' : ' (a default; tell me if yours differ)'}.`,
    `You can study ${formatMinutes(opts.dailyMinutes)} a day${opts.weekendMinutes != null ? ` and ${formatMinutes(opts.weekendMinutes)} on weekends` : ''}${rawOptions.dailyMinutes ? '' : ' (your daily goal)'}.`,
    `${Math.round(BUFFERS[opts.buffer] * 100)}% of each day is kept free as a buffer; exam days count as half days.`,
    `Study starts around ${opts.startTime}, in blocks of up to ${opts.maxBlock} min with 10 min breaks.`,
    'Units are covered in syllabus order; existing study blocks stay where they are.',
    'Ticking every topic means you covered it, not that you have mastered it.',
    ...ctx.assumptions,
  ]

  const completion = [
    ...ctx.exams.filter((e) => e.date <= end).map((e) => `Every topic for ${e.title} ticked before ${shortDate(e.date)}, plus practice and final revision done`),
    ...ctx.assignments.filter((a) => a.due <= end).map((a) => `"${a.title}" marked done by ${shortDate(a.due)}`),
    ...(ctx.goal.type === 'recovery' && ctx.missedBlocks.length ? [`The ${ctx.missedBlocks.length} missed blocks are made up`] : []),
  ]

  const taskCount = outDays.reduce((m, d) => m + d.tasks.length, 0)
  return {
    version: 1,
    title: planTitle(ctx, end),
    goal: ctx.goal,
    start: today,
    end,
    generatedAt: new Date().toISOString(),
    options: opts,
    startingState: {
      exams: ctx.exams.map((e) => ({ id: e.id, title: e.title, date: e.date, readinessPct: e.readinessPct, topicsLeft: e.topicsTotal - e.topicsDone })),
      assignmentsOpen: ctx.assignments.length,
      missedBlocks: ctx.missedBlocks.length,
      averagePerDayLast14: ctx.history.averagePerDayLast14,
    },
    assumptions,
    questions: ctx.questions,
    milestones,
    days: outDays,
    deferred,
    carried,
    warnings,
    feasibility,
    priorities: { prioritized, deferred: deferred.map((d) => d.reason), carried: carried.map((c) => c.reason) },
    completion,
    stats: { tasks: taskCount, minutes: scheduled, studyDays: outDays.filter((d) => d.tasks.length).length },
  }
}

// Compare the same goal under different assumptions (time budget, strategy,
// buffer). Nothing is saved.
export function simulateScenarios(data, goal, baseOptions = {}, variants = [], env = {}) {
  const list = variants.length
    ? variants
    : [
        { label: `${Math.round((baseOptions.dailyMinutes || data.prefs.dailyGoal || 180) / 60)} h a day`, options: {} },
        { label: 'Lighter: 2 h a day', options: { dailyMinutes: 120 } },
        { label: 'More: 4 h a day', options: { dailyMinutes: 240 } },
      ]
  return list.map((v) => {
    const p = generatePlan(data, goal, { ...baseOptions, ...(v.options || {}) }, env)
    if (p.empty) return { label: v.label, empty: true, reason: p.reason }
    const examCoverage = p.startingState.exams.map((e) => {
      const topicIds = new Set(p.days.flatMap((d) => d.tasks.filter((t) => t.examId === e.id).flatMap((t) => t.topicIds)))
      const exam = data.exams.find((x) => x.id === e.id)
      return { exam: `${short(data, exam?.subjectId)} ${e.title}`, date: e.date, topicsLeft: e.topicsLeft, topicsPlanned: topicIds.size }
    })
    return {
      label: v.label,
      options: p.options,
      verdict: p.feasibility.verdict,
      summary: p.feasibility.summary,
      scheduledMinutes: p.feasibility.scheduledMinutes,
      shortfallMinutes: p.feasibility.shortfallMinutes,
      utilization: p.feasibility.utilization,
      studyDays: p.stats.studyDays,
      deferred: p.deferred.map((d) => d.reason),
      examCoverage,
      lastTopicDay: p.days.filter((d) => d.tasks.some((t) => t.kind === 'topics')).map((d) => d.date).at(-1) || null,
    }
  })
}
