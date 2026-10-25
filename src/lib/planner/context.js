// Mission Planner, step 1: collect the academic context a plan needs, and only
// that. Everything here is read from the student's real data; anything we do
// not know is listed as an assumption or a question, never invented.
import { addDays, daysBetween, lastNDays, nowHHMM, todayISO } from '../dates.js'
import { examReadiness, examTopics, minutesOn, upcomingExams } from '../selectors.js'

export const GOAL_TYPES = {
  week: 'Plan this week',
  exam: 'Prepare for one exam',
  exams: 'Several exams close together',
  recovery: 'Catch up after missed days',
  semester: 'Plan the rest of the semester',
}

export const BUFFERS = { relaxed: 0.25, balanced: 0.15, intensive: 0.05 }
export const STRATEGIES = { deadline: 'Earliest deadline first', spread: 'Spread across everything' }

export const DEFAULTS = {
  minutesPerTopic: 45,
  revisionMinutes: 60,
  practiceMinutes: 60,
  assignmentMinutes: 60,
  buffer: 'balanced',
  strategy: 'deadline',
  startTime: '18:00',
}

export const MAX_HORIZON = 180

const subjectLabel = (data, id) => {
  const s = data.subjects.find((x) => x.id === id)
  return s ? s.code || s.name : 'Unknown subject'
}

function findExam(data, ref) {
  if (!ref) return null
  const r = String(ref).trim().toLowerCase()
  return data.exams.find((e) => e.id === ref) || data.exams.find((e) => e.title.toLowerCase() === r) || data.exams.find((e) => e.title.toLowerCase().includes(r)) || null
}

// Turn a loose goal ({ type, exam, exams, targetDate, withinDays }) into a
// precise one with a horizon. Returns { goal, notes } where notes explain any
// choice we had to make.
export function resolveGoal(data, goal = {}, today = todayISO()) {
  const type = GOAL_TYPES[goal.type] ? goal.type : 'week'
  const notes = []
  const upcoming = upcomingExams(data, today)
  let examIds = []
  let end

  if (type === 'exam') {
    const exam = findExam(data, goal.exam || goal.examId || goal.examIds?.[0]) || null
    if (!exam && goal.exam) notes.push(`No exam matches "${goal.exam}".`)
    const chosen = exam && exam.date >= today ? exam : upcoming[0]
    if (!exam && chosen) notes.push(`No exam picked, so I used your next one: ${chosen.title}.`)
    if (chosen) {
      examIds = [chosen.id]
      end = chosen.date
    }
  } else if (type === 'exams') {
    const refs = goal.exams || goal.examIds
    const picked = refs?.length ? refs.map((r) => findExam(data, r)).filter(Boolean) : upcoming.filter((e) => daysBetween(today, e.date) <= (goal.withinDays || 14))
    examIds = picked.filter((e) => e.date >= today).map((e) => e.id)
    end = picked.map((e) => e.date).sort().at(-1)
  } else if (type === 'semester') {
    end = goal.targetDate || upcoming.at(-1)?.date
    if (!goal.targetDate && end) notes.push(`Planning up to your last exam on the calendar (${end}).`)
    examIds = upcoming.filter((e) => !end || e.date <= end).map((e) => e.id)
  } else if (type === 'recovery') {
    end = goal.targetDate || addDays(today, 6)
    examIds = upcoming.filter((e) => e.date <= addDays(end, 7)).map((e) => e.id)
  } else {
    end = addDays(today, 6)
    examIds = upcoming.filter((e) => daysBetween(today, e.date) <= 14).map((e) => e.id)
  }

  // A target date wins (a repair keeps the original end), except for one exam.
  if (goal.targetDate && type !== 'exam') end = goal.targetDate
  if (end && end < today) end = today
  if (end && daysBetween(today, end) > MAX_HORIZON) {
    end = addDays(today, MAX_HORIZON)
    notes.push(`Plans reach at most ${MAX_HORIZON} days ahead.`)
  }
  return { goal: { type, examIds, end: end || null, subjectIds: goal.subjectIds || [] }, notes }
}

// The focused snapshot a plan is built from.
export function buildAcademicContext(data, goal = {}, { today = todayISO(), now = nowHHMM(), options = {} } = {}) {
  const { goal: g, notes } = resolveGoal(data, goal, today)
  const questions = []
  const assumptions = []
  const end = g.end

  const exams = g.examIds
    .map((id) => data.exams.find((e) => e.id === id))
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      const subject = data.subjects.find((s) => s.id === e.subjectId)
      const scoped = examTopics(data, e)
      const unitIds = e.unitIds?.length ? e.unitIds : data.units.filter((u) => u.subjectId === e.subjectId).map((u) => u.id)
      const units = data.units
        .filter((u) => unitIds.includes(u.id))
        .sort((a, b) => a.order - b.order)
        .map((u) => ({
          id: u.id,
          title: u.title,
          order: u.order,
          topicsLeft: data.topics.filter((t) => t.unitId === u.id && !t.done).map((t) => ({ id: t.id, title: t.title })),
          // Ticked, but the student said they're shaky on it: worth a revision slot.
          shaky: data.topics.filter((t) => t.unitId === u.id && t.done && t.confidence === 'shaky').map((t) => ({ id: t.id, title: t.title })),
          topicsTotal: data.topics.filter((t) => t.unitId === u.id).length,
        }))
      const r = examReadiness(data, e)
      if (!e.unitIds?.length) assumptions.push(`${e.title} covers all of ${subject?.name || 'its subject'} (no units were picked).`)
      if (!scoped.length)
        questions.push({ id: `syllabus:${e.subjectId}`, question: `${subject?.name || 'This subject'} has no syllabus topics yet, so I can only plan revision for ${e.title}. Add its units and topics for a real plan.`, material: true, action: { open: `/app/subjects/${e.subjectId}` } })
      return {
        id: e.id,
        title: e.title,
        type: e.type,
        date: e.date,
        time: e.time || null,
        daysLeft: daysBetween(today, e.date),
        subjectId: e.subjectId,
        subject: subject?.name || 'Unknown subject',
        readinessPct: r.pct,
        topicsDone: r.done,
        topicsTotal: r.total,
        units,
      }
    })

  // Prerequisite gaps: earlier units of the same subject that are not in the
  // exam and not finished. Only an assumption: we do not know the real links.
  const gaps = []
  for (const e of exams) {
    if (!e.units.length) continue
    const first = Math.min(...e.units.map((u) => u.order))
    for (const u of data.units.filter((x) => x.subjectId === e.subjectId && x.order < first)) {
      const total = data.topics.filter((t) => t.unitId === u.id).length
      const done = data.topics.filter((t) => t.unitId === u.id && t.done).length
      if (total && done / total < 0.5) gaps.push({ examId: e.id, unitId: u.id, unit: u.title, exam: e.title, donePct: Math.round((done / total) * 100) })
    }
  }

  const assignments = data.assignments
    .filter((a) => a.status !== 'done' && a.due && (!end || a.due <= end))
    .filter((a) => !g.subjectIds.length || g.subjectIds.includes(a.subjectId))
    .sort((a, b) => a.due.localeCompare(b.due))
    .map((a) => {
      if (!a.estimate) assumptions.push(`"${a.title}" takes about ${DEFAULTS.assignmentMinutes} min (no estimate was given).`)
      return { id: a.id, title: a.title, due: a.due, overdue: a.due < today, priority: a.priority, status: a.status, estimateMinutes: a.estimate || DEFAULTS.assignmentMinutes, subjectId: a.subjectId, subject: subjectLabel(data, a.subjectId) }
    })

  const missedBlocks = data.blocks
    .filter((b) => !b.done && b.date < today && b.date >= addDays(today, -14))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((b) => ({ id: b.id, date: b.date, title: b.title, minutes: b.minutes, subjectId: b.subjectId, subject: subjectLabel(data, b.subjectId), planId: b.planId || null }))

  const existingBlocks = data.blocks
    .filter((b) => b.date >= today && (!end || b.date <= end))
    .map((b) => ({ id: b.id, date: b.date, start: b.start, minutes: b.minutes, done: b.done, subjectId: b.subjectId, title: b.title, planId: b.planId || null }))

  const last14 = lastNDays(14, today)
  const studied14 = last14.reduce((n, d) => n + minutesOn(data, d), 0)
  const activeDays = last14.filter((d) => minutesOn(data, d) > 0).length

  // Availability: what the student told us, else their daily goal.
  const daily = Number(options.dailyMinutes) || data.prefs.dailyGoal || 180
  const availability = {
    dailyMinutes: daily,
    weekendMinutes: options.weekendMinutes != null && options.weekendMinutes !== '' ? Number(options.weekendMinutes) : null,
    daysOff: options.daysOff || [],
    source: options.dailyMinutes ? 'you' : 'daily goal',
  }
  if (!options.dailyMinutes)
    questions.push({ id: 'dailyMinutes', question: `I'm using your daily goal (${Math.round(daily / 6) / 10} h) as study time. How much can you really study on a normal day?`, default: daily, choices: [60, 120, 180, 240, 300] })
  if (!options.minutesPerTopic)
    questions.push({ id: 'minutesPerTopic', question: `I'm assuming about ${DEFAULTS.minutesPerTopic} minutes per topic. How long does one topic usually take you?`, default: DEFAULTS.minutesPerTopic, choices: [30, 45, 60, 90] })
  if (g.type === 'semester' && !end) questions.push({ id: 'targetDate', question: 'There are no exams on your calendar. Until when should I plan?', material: true })

  return {
    today,
    now,
    goal: { ...g, label: GOAL_TYPES[g.type] },
    horizon: { start: today, end, days: end ? daysBetween(today, end) + 1 : 0 },
    exams,
    assignments,
    missedBlocks,
    existingBlocks,
    prerequisiteGaps: gaps,
    history: { studiedLast14Minutes: studied14, activeDaysLast14: activeDays, averagePerDayLast14: Math.round(studied14 / 14) },
    prefs: { dailyGoal: data.prefs.dailyGoal, focusLength: data.prefs.focusLength },
    availability,
    notes,
    assumptions,
    questions,
  }
}

// A short version for AI models: ids kept, long lists trimmed.
export function summarizeContext(ctx, { maxTopics = 12 } = {}) {
  return {
    ...ctx,
    exams: ctx.exams.map((e) => ({
      ...e,
      units: e.units.map((u) => ({ id: u.id, title: u.title, topicsLeft: u.topicsLeft.slice(0, maxTopics), moreTopicsLeft: Math.max(0, u.topicsLeft.length - maxTopics), topicsTotal: u.topicsTotal })),
    })),
    existingBlocks: ctx.existingBlocks.slice(0, 40),
    missedBlocks: ctx.missedBlocks.slice(0, 20),
  }
}
