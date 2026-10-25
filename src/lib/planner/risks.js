// Risk radar: what could go wrong soon, why, and what to do next. Every warning
// is computed from the student's own data and says how it was worked out.
import { addDays, daysBetween, formatMinutes, shortDate, todayISO } from '../dates.js'
import { examReadiness, examTopics, overdue, upcomingExams } from '../selectors.js'
import { DEFAULTS } from './context.js'

const LEVEL = { high: 0, medium: 1, low: 2 }

export function analyzeRisks(data, { today = todayISO() } = {}) {
  const risks = []
  const add = (r) => risks.push(r)
  const exams = upcomingExams(data, today)

  for (const e of exams) {
    const days = daysBetween(today, e.date)
    const r = examReadiness(data, e)
    const subject = data.subjects.find((s) => s.id === e.subjectId)
    if (!r.total && days <= 30) {
      add({ id: `nosyllabus:${e.id}`, level: days <= 7 ? 'high' : 'medium', kind: 'syllabus', title: `${e.title} has no topics to track`, reason: `${subject?.name || 'Its subject'} has no syllabus in StudySync, so readiness can't be measured. The exam is ${days === 0 ? 'today' : `in ${days} days`}.`, next: { label: 'Add the syllabus', to: `/app/subjects/${e.subjectId}` }, refs: { examId: e.id } })
      continue
    }
    const left = r.total - r.done
    const needMin = left * DEFAULTS.minutesPerTopic
    const haveMin = Math.max(0, days - 1) * (data.prefs.dailyGoal || 180) * 0.85
    if ((days <= 7 && r.pct < 60) || (days <= 14 && r.pct < 35)) {
      add({ id: `exam:${e.id}`, level: days <= 3 || r.pct < 30 ? 'high' : 'medium', kind: 'exam', title: `${e.title} is ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`} at ${r.pct}% ready`, reason: `${left} of ${r.total} topics aren't ticked yet (about ${formatMinutes(needMin)} at ${DEFAULTS.minutesPerTopic} min each).`, next: { label: 'Plan for this exam', plan: { type: 'exam', exam: e.id } }, refs: { examId: e.id } })
    } else if (days <= 21 && needMin > haveMin && left > 0) {
      add({ id: `time:${e.id}`, level: 'medium', kind: 'workload', title: `Tight on time for ${e.title}`, reason: `About ${formatMinutes(needMin)} of topics remain and your daily goal leaves roughly ${formatMinutes(Math.round(haveMin))} before ${shortDate(e.date)}.`, next: { label: 'Compare study budgets', plan: { type: 'exam', exam: e.id }, scenarios: true }, refs: { examId: e.id } })
    }
    // A later unit is in the exam while an earlier one is barely started.
    if (days <= 21 && e.unitIds?.length) {
      const inExam = data.units.filter((u) => e.unitIds.includes(u.id))
      const first = Math.min(...inExam.map((u) => u.order))
      const earlier = data.units.filter((u) => u.subjectId === e.subjectId && u.order < first)
      for (const u of earlier) {
        const ts = data.topics.filter((t) => t.unitId === u.id)
        if (ts.length && ts.filter((t) => t.done).length / ts.length < 0.3) {
          add({ id: `prereq:${e.id}:${u.id}`, level: 'low', kind: 'prerequisite', title: `"${u.title}" may matter for ${e.title}`, reason: `It comes before the units in this exam and is under 30% done. StudySync doesn't know whether later units depend on it; you do.`, next: { label: 'Open the subject', to: `/app/subjects/${e.subjectId}` }, refs: { examId: e.id, unitId: u.id } })
          break
        }
      }
    }
  }

  for (const a of overdue(data, today))
    add({ id: `overdue:${a.id}`, level: 'high', kind: 'overdue', title: `"${a.title}" is overdue`, reason: `It was due ${shortDate(a.due)} and is still marked ${a.status === 'doing' ? 'in progress' : 'to do'}.`, next: { label: 'Open assignments', to: '/app/assignments' }, refs: { assignmentId: a.id } })
  for (const a of data.assignments.filter((x) => x.status === 'todo' && x.due >= today && daysBetween(today, x.due) <= 2))
    add({ id: `duesoon:${a.id}`, level: 'medium', kind: 'deadline', title: `"${a.title}" is due ${daysBetween(today, a.due) === 0 ? 'today' : shortDate(a.due)} and not started`, reason: `Estimated at ${formatMinutes(a.estimate || 60)}.`, next: { label: 'Plan this week', plan: { type: 'week' } }, refs: { assignmentId: a.id } })

  // Busy stretches: three or more deadlines within three days.
  const deadlines = [...exams.map((e) => ({ date: e.date, title: e.title })), ...data.assignments.filter((a) => a.status !== 'done' && a.due >= today).map((a) => ({ date: a.due, title: a.title }))]
    .filter((d) => daysBetween(today, d.date) <= 21)
    .sort((a, b) => a.date.localeCompare(b.date))
  for (let i = 0; i < deadlines.length; i++) {
    const near = deadlines.filter((d) => d.date >= deadlines[i].date && daysBetween(deadlines[i].date, d.date) <= 2)
    if (near.length >= 3) {
      add({ id: `crunch:${near[0].date}`, level: 'medium', kind: 'crunch', title: `${near.length} deadlines between ${shortDate(near[0].date)} and ${shortDate(near.at(-1).date)}`, reason: near.map((d) => d.title).join(', '), next: { label: 'Plan these together', plan: { type: 'exams', targetDate: near.at(-1).date } }, refs: {} })
      break
    }
  }

  // Missed study blocks lately.
  const missed = data.blocks.filter((b) => !b.done && b.date < today && b.date >= addDays(today, -7))
  if (missed.length >= 3)
    add({ id: 'missed', level: 'medium', kind: 'missed', title: `${missed.length} study blocks missed this week`, reason: `About ${formatMinutes(missed.reduce((m, b) => m + b.minutes, 0))} of planned study didn't happen. That's normal; the plan just needs to move.`, next: { label: 'Make a catch-up plan', plan: { type: 'recovery' } }, refs: {} })

  // Units with nothing done whose exam is close.
  for (const e of exams.filter((x) => daysBetween(today, x.date) <= 10)) {
    const units = data.units.filter((u) => examTopics(data, e).some((t) => t.unitId === u.id))
    const untouched = units.filter((u) => data.topics.filter((t) => t.unitId === u.id).every((t) => !t.done))
    if (untouched.length && untouched.length < units.length)
      add({ id: `untouched:${e.id}`, level: 'low', kind: 'syllabus', title: `${untouched.length} unit${untouched.length === 1 ? '' : 's'} of ${e.title} not started`, reason: untouched.map((u) => u.title).join(', '), next: { label: 'Plan for this exam', plan: { type: 'exam', exam: e.id } }, refs: { examId: e.id } })
  }

  const seen = new Set()
  return risks.filter((r) => !seen.has(r.id) && seen.add(r.id)).sort((a, b) => LEVEL[a.level] - LEVEL[b.level])
}
