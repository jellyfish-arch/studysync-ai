// Compact, readable snapshots of an account for AI models (Yuuki and MCP
// clients). Ids are included so the model can act on what it reads.
import { findSubject } from './ops.js'

// "Tue 27 Oct": models get weekdays wrong when they work them out, so every
// date comes with its weekday spelled out.
const when = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : null)
import {
  blocksOn,
  examReadiness,
  longestStreak,
  minutesOn,
  openAssignments,
  overallProgress,
  streak,
  subjectProgress,
  unitProgress,
  upcomingExams,
} from './selectors.js'
import { addDays, daysBetween, lastNDays, todayISO } from './dates.js'

const subjectName = (data, id) => {
  const s = data.subjects.find((x) => x.id === id)
  return s ? (s.code ? `${s.name} (${s.code})` : s.name) : 'Unknown subject'
}

export function overview(data, today = todayISO()) {
  const week = lastNDays(7, today).reduce((sum, d) => sum + minutesOn(data, d), 0)
  return {
    today,
    student: {
      name: data.profile.name || null,
      course: data.profile.course || null,
      semester: data.profile.semester || null,
      college: data.profile.college || null,
    },
    dailyGoalMinutes: data.prefs.dailyGoal,
    stats: {
      studiedTodayMinutes: minutesOn(data, today),
      last7DaysMinutes: week,
      currentStreakDays: streak(data, today),
      longestStreakDays: longestStreak(data),
      syllabusDonePct: overallProgress(data).pct,
    },
    subjects: data.subjects.map((s) => {
      const p = subjectProgress(data, s.id)
      return { id: s.id, name: s.name, code: s.code || null, units: data.units.filter((u) => u.subjectId === s.id).length, topicsDone: p.done, topicsTotal: p.total, progressPct: p.pct }
    }),
    upcomingExams: upcomingExams(data, today)
      .slice(0, 8)
      .map((e) => {
        const r = examReadiness(data, e)
        return { id: e.id, subject: subjectName(data, e.subjectId), title: e.title, type: e.type, date: e.date, when: when(e.date), time: e.time || null, daysLeft: daysBetween(today, e.date), readinessPct: r.pct, topicsLeft: r.left.length }
      }),
    openAssignments: openAssignments(data)
      .slice(0, 12)
      .map((a) => ({ id: a.id, subject: subjectName(data, a.subjectId), title: a.title, due: a.due, dueWhen: when(a.due), status: a.status, priority: a.priority, overdue: Boolean(a.due && a.due < today) })),
    todayPlan: blocksOn(data, today).map((b) => ({ id: b.id, subject: subjectName(data, b.subjectId), title: b.title, start: b.start, minutes: b.minutes, done: b.done })),
  }
}

export function subjectDetail(data, ref, today = todayISO()) {
  const s = findSubject(data, ref)
  if (!s) return null
  const units = data.units.filter((u) => u.subjectId === s.id).sort((a, b) => a.order - b.order)
  return {
    id: s.id,
    name: s.name,
    code: s.code || null,
    teacher: s.teacher || null,
    progress: subjectProgress(data, s.id),
    units: units.map((u, i) => ({
      id: u.id,
      number: i + 1,
      title: u.title,
      progress: unitProgress(data, u.id),
      topics: data.topics.filter((t) => t.unitId === u.id).map((t) => ({ id: t.id, title: t.title, done: t.done })),
    })),
    exams: data.exams
      .filter((e) => e.subjectId === s.id)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => ({ id: e.id, title: e.title, type: e.type, date: e.date, when: when(e.date), time: e.time || null, venue: e.venue || null, past: e.date < today, readinessPct: examReadiness(data, e).pct })),
    assignments: data.assignments.filter((a) => a.subjectId === s.id).map((a) => ({ id: a.id, title: a.title, due: a.due, dueWhen: when(a.due), status: a.status, priority: a.priority })),
    studiedMinutesTotal: data.sessions.filter((x) => x.subjectId === s.id).reduce((n, x) => n + x.minutes, 0),
  }
}

export function schedule(data, from = todayISO(), to = addDays(from, 6)) {
  const days = []
  for (let d = from; d <= to && days.length < 62; d = addDays(d, 1)) {
    days.push({
      date: d,
      when: when(d),
      studyBlocks: blocksOn(data, d).map((b) => ({ id: b.id, subject: subjectName(data, b.subjectId), title: b.title, start: b.start, minutes: b.minutes, done: b.done })),
      exams: data.exams.filter((e) => e.date === d).map((e) => ({ id: e.id, subject: subjectName(data, e.subjectId), title: e.title, time: e.time || null })),
      assignmentsDue: data.assignments.filter((a) => a.due === d && a.status !== 'done').map((a) => ({ id: a.id, subject: subjectName(data, a.subjectId), title: a.title })),
      studiedMinutes: minutesOn(data, d),
    })
  }
  return { from, to, days }
}

export function studyStats(data, days = 30, today = todayISO()) {
  const window = lastNDays(Math.min(Math.max(days, 1), 365), today)
  const set = new Set(window)
  const bySubject = {}
  for (const x of data.sessions) if (set.has(x.date)) bySubject[subjectName(data, x.subjectId)] = (bySubject[subjectName(data, x.subjectId)] || 0) + x.minutes
  const total = Object.values(bySubject).reduce((a, b) => a + b, 0)
  const active = window.filter((d) => minutesOn(data, d) > 0).length
  return {
    days: window.length,
    totalMinutes: total,
    activeDays: active,
    averagePerActiveDay: active ? Math.round(total / active) : 0,
    minutesBySubject: bySubject,
    currentStreakDays: streak(data, today),
    longestStreakDays: longestStreak(data),
  }
}
