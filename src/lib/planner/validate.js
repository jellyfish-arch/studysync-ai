// Mission Planner, step 5: check a plan against the real data before anything
// is saved. Used for plans made by our engine AND for plans an AI app proposes
// through MCP: a plan that fits the schema can still be wrong.
import { daysBetween, todayISO } from '../dates.js'
import { findSubject } from '../ops.js'
import { toMin } from './engine.js'

const ISO = /^\d{4}-\d{2}-\d{2}$/
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

// Accept a plan written by an AI: subjects/exams/assignments/topics by id or
// name. Returns a plan in our own shape plus the problems found on the way.
export function normalizeExternalPlan(input, data) {
  const errors = []
  const days = []
  if (!input || !Array.isArray(input.days)) return { plan: null, errors: ['A plan needs a "days" list.'] }
  if (input.days.length > 200) return { plan: null, errors: ['A plan can have at most 200 days.'] }
  let n = 0
  for (const d of input.days) {
    if (!d || !ISO.test(d.date || '')) {
      errors.push(`Day "${d?.date}" is not a YYYY-MM-DD date.`)
      continue
    }
    const tasks = []
    for (const t of (d.tasks || []).slice(0, 30)) {
      const subject = findSubject(data, t.subjectId || t.subject)
      const exam = t.examId || t.exam ? data.exams.find((e) => e.id === (t.examId || t.exam) || e.title.toLowerCase() === String(t.exam || '').toLowerCase()) : null
      const asg = t.assignmentId || t.assignment ? data.assignments.find((a) => a.id === (t.assignmentId || t.assignment) || a.title.toLowerCase() === String(t.assignment || '').toLowerCase()) : null
      const topicRefs = t.topicIds || t.topics || []
      const topicIds = topicRefs
        .map((r) => data.topics.find((x) => x.id === r || x.title.toLowerCase() === String(r).toLowerCase())?.id || `?${r}`)
      tasks.push({
        id: t.id || `x${++n}`,
        kind: t.kind || (asg ? 'assignment' : topicIds.length ? 'topics' : 'study'),
        title: String(t.title || 'Study').slice(0, 120),
        minutes: Number(t.minutes),
        start: t.start || '18:00',
        subjectId: subject?.id || (t.subjectId || t.subject ? `?${t.subjectId || t.subject}` : null),
        examId: exam?.id || (t.exam || t.examId ? `?${t.exam || t.examId}` : null),
        assignmentId: asg?.id || (t.assignment || t.assignmentId ? `?${t.assignment || t.assignmentId}` : null),
        topicIds,
        unitIds: [],
      })
    }
    days.push({ date: d.date, tasks })
  }
  return { plan: { days, options: input.options || {} }, errors }
}

/**
 * validatePlan(plan, data, { today, planId, maxDailyMinutes })
 * -> { valid, errors: [...], warnings: [...], checked }
 */
export function validatePlan(plan, data, { today = todayISO(), planId = null, maxDailyMinutes } = {}) {
  const errors = []
  const warnings = []
  if (!plan || !Array.isArray(plan.days) || !plan.days.length) return { valid: false, errors: ['The plan has no days.'], warnings, checked: { days: 0, tasks: 0 } }
  const dailyCap = maxDailyMinutes || Math.max(240, Math.round((plan.options?.dailyMinutes || data.prefs?.dailyGoal || 180) * 1.25))
  const topicSeen = new Map()
  let tasks = 0
  const examOrder = new Map()

  for (const day of plan.days) {
    if (!ISO.test(day.date)) {
      errors.push(`"${day.date}" is not a date.`)
      continue
    }
    if (day.date < today && (day.tasks || []).length) errors.push(`${day.date} is in the past.`)
    const total = (day.tasks || []).reduce((m, t) => m + (Number(t.minutes) || 0), 0)
    if (total > 12 * 60) errors.push(`${day.date} has ${Math.round(total / 6) / 10} h of study, more than anyone can do in a day.`)
    else if (total > dailyCap) warnings.push(`${day.date} has ${Math.round(total / 6) / 10} h planned, more than your usual ${Math.round(dailyCap / 6) / 10} h.`)

    const intervals = []
    for (const t of day.tasks || []) {
      tasks++
      const where = `"${t.title}" on ${day.date}`
      if (!(t.minutes >= 5 && t.minutes <= 240)) errors.push(`${where} should be between 5 and 240 minutes.`)
      if (!HHMM.test(t.start || '')) errors.push(`${where} needs a 24-hour start time like 18:30.`)
      else intervals.push([toMin(t.start), toMin(t.start) + (Number(t.minutes) || 0), t.title])
      if (!t.subjectId || String(t.subjectId).startsWith('?') || !data.subjects.some((s) => s.id === t.subjectId)) errors.push(`${where} is not linked to one of your subjects.`)
      if (t.examId) {
        const exam = data.exams.find((e) => e.id === t.examId)
        if (!exam) errors.push(`${where} refers to an exam that doesn't exist.`)
        else {
          if (day.date >= exam.date) errors.push(`${where} is on or after ${exam.title} (${exam.date}).`)
          if (t.subjectId && exam.subjectId !== t.subjectId) errors.push(`${where} is for ${exam.title} but a different subject.`)
          if (t.unitIds?.length) {
            const units = data.units.filter((u) => t.unitIds.includes(u.id)).map((u) => u.order)
            const list = examOrder.get(exam.id) || []
            list.push({ date: day.date, order: Math.min(...units), title: t.title })
            examOrder.set(exam.id, list)
          }
        }
      }
      if (t.assignmentId) {
        const a = data.assignments.find((x) => x.id === t.assignmentId)
        if (!a) errors.push(`${where} refers to an assignment that doesn't exist.`)
        // Already overdue: catching up after the deadline is the whole point.
        else if (a.due && day.date > a.due && a.due < today) warnings.push(`${where} catches up on "${a.title}", which was due ${a.due}.`)
        else if (a.due && day.date > a.due) errors.push(`${where} is after "${a.title}" is due (${a.due}).`)
        else if (a.status === 'done') warnings.push(`${where} is for "${a.title}", which is already done.`)
      }
      for (const id of t.topicIds || []) {
        const topic = data.topics.find((x) => x.id === id)
        if (!topic) errors.push(`${where} refers to a topic that doesn't exist (${String(id).replace(/^\?/, '')}).`)
        else {
          if (t.subjectId && topic.subjectId !== t.subjectId) errors.push(`${where} mixes a topic from another subject ("${topic.title}").`)
          if (topic.done) warnings.push(`"${topic.title}" is already ticked; ${where} may be revision.`)
          if (topicSeen.has(id)) warnings.push(`"${topic.title}" is planned twice (${topicSeen.get(id)} and ${day.date}).`)
          topicSeen.set(id, day.date)
        }
      }
    }
    // Overlaps inside the plan and with blocks already on the calendar.
    const theirs = data.blocks
      .filter((b) => b.date === day.date && !b.done && !(planId && b.planId === planId))
      .map((b) => [toMin(b.start), toMin(b.start) + b.minutes, b.title])
    intervals.sort((a, b) => a[0] - b[0])
    for (let i = 1; i < intervals.length; i++) if (intervals[i][0] < intervals[i - 1][1]) errors.push(`On ${day.date}, "${intervals[i][2]}" overlaps "${intervals[i - 1][2]}".`)
    for (const [s, e, title] of intervals) for (const [bs, be, bt] of theirs) if (s < be && e > bs) errors.push(`On ${day.date}, "${title}" clashes with your existing block "${bt}".`)
  }

  // Syllabus order within an exam (only a warning: real links are unknown).
  for (const [examId, list] of examOrder) {
    list.sort((a, b) => a.date.localeCompare(b.date))
    for (let i = 1; i < list.length; i++)
      if (list[i].order < list[i - 1].order) {
        warnings.push(`For ${data.exams.find((e) => e.id === examId)?.title}, "${list[i].title}" comes after a later unit. Check the order makes sense.`)
        break
      }
  }
  const span = plan.days.length > 1 ? daysBetween(plan.days[0].date, plan.days.at(-1).date) : 0
  return { valid: errors.length === 0, errors: [...new Set(errors)].slice(0, 40), warnings: [...new Set(warnings)].slice(0, 40), checked: { days: plan.days.length, tasks, spanDays: span } }
}
