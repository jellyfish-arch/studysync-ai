// Pure functions that turn stored data into what the screens show.
// Everything is computed from the student's own entries; nothing is guessed.
import { addDays, daysBetween, lastNDays, nowHHMM, todayISO, weekDays, weekStart } from './dates.js'

export const pct = (done, total) => (total ? Math.round((done / total) * 100) : 0)

export function subjectProgress(data, subjectId) {
  const list = data.topics.filter((t) => t.subjectId === subjectId)
  const done = list.filter((t) => t.done).length
  return { done, total: list.length, pct: pct(done, list.length) }
}

export function unitProgress(data, unitId) {
  const list = data.topics.filter((t) => t.unitId === unitId)
  const done = list.filter((t) => t.done).length
  return { done, total: list.length, pct: pct(done, list.length) }
}

export function overallProgress(data) {
  const done = data.topics.filter((t) => t.done).length
  return { done, total: data.topics.length, pct: pct(done, data.topics.length) }
}

// Readiness = share of the exam's syllabus (its units, or the whole subject
// when no units are picked) that is ticked off.
export function examTopics(data, exam) {
  return exam.unitIds?.length
    ? data.topics.filter((t) => exam.unitIds.includes(t.unitId))
    : data.topics.filter((t) => t.subjectId === exam.subjectId)
}

export function examReadiness(data, exam) {
  const list = examTopics(data, exam)
  const done = list.filter((t) => t.done).length
  return { done, total: list.length, pct: pct(done, list.length), left: list.filter((t) => !t.done) }
}

export function upcomingExams(data, today = todayISO()) {
  return data.exams.filter((e) => e.date >= today).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
}

export function pastExams(data, today = todayISO()) {
  return data.exams.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date))
}

export function openAssignments(data) {
  return data.assignments
    .filter((a) => a.status !== 'done')
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || prioRank(b.priority) - prioRank(a.priority))
}

export const prioRank = (p) => ({ low: 0, medium: 1, high: 2 })[p] ?? 1

export function overdue(data, today = todayISO()) {
  return data.assignments.filter((a) => a.status !== 'done' && a.due && a.due < today)
}

export function blocksOn(data, date) {
  return data.blocks.filter((b) => b.date === date).sort((a, b) => a.start.localeCompare(b.start))
}

export function minutesOn(data, date) {
  return data.sessions.filter((s) => s.date === date).reduce((sum, s) => sum + s.minutes, 0)
}

export function minutesByDay(data, days, today = todayISO()) {
  return lastNDays(days, today).map((date) => ({ date, minutes: minutesOn(data, date) }))
}

export function minutesBySubject(data, days, today = todayISO()) {
  const window = new Set(lastNDays(days, today))
  const totals = Object.fromEntries(data.subjects.map((s) => [s.id, 0]))
  for (const s of data.sessions) if (window.has(s.date) && s.subjectId in totals) totals[s.subjectId] += s.minutes
  return totals
}

export function totalMinutes(data, subjectId) {
  return data.sessions.filter((s) => !subjectId || s.subjectId === subjectId).reduce((sum, s) => sum + s.minutes, 0)
}

// Consecutive days with any study, ending today (or yesterday if today has
// nothing logged yet, so the streak does not "break" in the morning).
export function streak(data, today = todayISO()) {
  const days = new Set(data.sessions.map((s) => s.date))
  let cursor = days.has(today) ? today : addDays(today, -1)
  let count = 0
  while (days.has(cursor)) {
    count++
    cursor = addDays(cursor, -1)
  }
  return count
}

export function longestStreak(data) {
  const days = [...new Set(data.sessions.map((s) => s.date))].sort()
  let best = 0
  let run = 0
  let prev = null
  for (const d of days) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

export function weekMinutes(data, today = todayISO()) {
  return weekDays(weekStart(today)).map((date) => ({ date, minutes: minutesOn(data, date), planned: plannedOn(data, date) }))
}

export function plannedOn(data, date) {
  return data.blocks.filter((b) => b.date === date).reduce((sum, b) => sum + b.minutes, 0)
}

// The single most useful thing to do now, with the reason.
export function nextPriority(data, today = todayISO(), now = nowHHMM()) {
  const todays = blocksOn(data, today).filter((b) => !b.done)
  if (todays.length) {
    const block = todays.find((b) => b.start >= now) || todays[0]
    return { kind: 'block', block, subjectId: block.subjectId, title: block.title }
  }
  const late = overdue(data, today)[0]
  if (late) return { kind: 'assignment', assignment: late, subjectId: late.subjectId, title: late.title }
  const exam = upcomingExams(data, today)[0]
  if (exam) {
    const r = examReadiness(data, exam)
    if (r.left.length) return { kind: 'topic', exam, topic: r.left[0], subjectId: exam.subjectId, title: r.left[0].title }
  }
  const next = openAssignments(data)[0]
  if (next) return { kind: 'assignment', assignment: next, subjectId: next.subjectId, title: next.title }
  return null
}

// Exams and assignments in the next `days` days, merged by date.
export function agenda(data, days = 14, today = todayISO()) {
  const end = addDays(today, days)
  const items = [
    ...data.exams.filter((e) => e.date >= today && e.date <= end).map((e) => ({ kind: 'exam', id: e.id, date: e.date, time: e.time, title: e.title, subjectId: e.subjectId, ref: e })),
    ...data.assignments
      .filter((a) => a.status !== 'done' && a.due && a.due >= today && a.due <= end)
      .map((a) => ({ kind: 'assignment', id: a.id, date: a.due, title: a.title, subjectId: a.subjectId, ref: a })),
  ]
  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'exam' ? -1 : 1))
}

export function subjectStatus(data, subjectId, today = todayISO()) {
  const nextExam = upcomingExams(data, today).find((e) => e.subjectId === subjectId)
  if (!nextExam) return { tone: 'neutral', label: 'No exam scheduled' }
  const r = examReadiness(data, nextExam)
  const days = daysBetween(today, nextExam.date)
  if (r.pct >= 80) return { tone: 'good', label: 'On track', exam: nextExam, days, readiness: r.pct }
  if (days <= 7 && r.pct < 60) return { tone: 'bad', label: 'Needs attention', exam: nextExam, days, readiness: r.pct }
  return { tone: 'warn', label: 'Keep going', exam: nextExam, days, readiness: r.pct }
}

export function topicsDoneInRange(data, days, today = todayISO()) {
  const window = new Set(lastNDays(days, today))
  return data.topics.filter((t) => t.done && t.doneOn && window.has(t.doneOn)).length
}
