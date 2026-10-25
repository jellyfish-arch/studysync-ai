import { describe, expect, it } from 'vitest'
import { demoSemester } from './fixtures/semester.js'
import {
  agenda,
  examReadiness,
  longestStreak,
  minutesByDay,
  nextPriority,
  overallProgress,
  overdue,
  streak,
  subjectProgress,
  subjectStatus,
  upcomingExams,
} from '../src/lib/selectors.js'
import { addDays, daysBetween, formatTime, monthGrid, weekStart } from '../src/lib/dates.js'

const today = '2026-10-10'
const data = demoSemester(today)

describe('dates', () => {
  it('starts weeks on Monday', () => {
    expect(weekStart('2026-10-10')).toBe('2026-10-05')
    expect(weekStart('2026-10-05')).toBe('2026-10-05')
  })
  it('builds a 6-week month grid that covers the whole month', () => {
    const grid = monthGrid('2026-10-01')
    expect(grid).toHaveLength(42)
    expect(grid[0]).toBe('2026-09-28')
    expect(grid).toContain('2026-10-31')
  })
  it('formats 24h times for students', () => {
    expect(formatTime('19:30')).toBe('7:30 pm')
    expect(formatTime('00:05')).toBe('12:05 am')
  })
  it('counts days across month ends', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3)
  })
})

describe('syllabus progress', () => {
  it('counts ticked topics per subject', () => {
    const p = subjectProgress(data, 'dbms')
    expect(p.total).toBe(13)
    expect(p.done).toBe(7)
    expect(p.pct).toBe(54)
  })
  it('sums every subject for the overall figure', () => {
    const o = overallProgress(data)
    expect(o.total).toBe(data.topics.length)
    expect(o.done).toBe(data.topics.filter((t) => t.done).length)
  })
})

describe('exam readiness', () => {
  it('only counts the units the exam covers', () => {
    const quiz = data.exams.find((e) => e.id === 'e1') // DBMS unit 3 only
    const r = examReadiness(data, quiz)
    expect(r.total).toBe(3)
    expect(r.done).toBe(1)
    expect(r.left.map((t) => t.unitId)).toEqual(['dbms-u3', 'dbms-u3'])
  })
  it('falls back to the whole subject when no units are picked', () => {
    const r = examReadiness(data, { subjectId: 'toc', unitIds: [] })
    expect(r.total).toBe(data.topics.filter((t) => t.subjectId === 'toc').length)
  })
  it('lists upcoming exams soonest first and skips past ones', () => {
    const list = upcomingExams(data, today)
    expect(list[0].id).toBe('e1')
    expect(list.some((e) => e.id === 'e6')).toBe(false)
  })
  it('flags a close exam with low readiness', () => {
    expect(subjectStatus(data, 'dbms', today).tone).toBe('bad')
  })
})

describe('deadlines', () => {
  it('finds overdue assignments', () => {
    expect(overdue(data, today).map((a) => a.id)).toEqual(['a3'])
  })
  it('keeps overdue items out of the upcoming agenda (no duplicates)', () => {
    const items = agenda(data, 14, today)
    const keys = items.map((i) => `${i.kind}-${i.id}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(items.every((i) => i.date >= today)).toBe(true)
  })
})

describe('study time', () => {
  it('sums minutes per day', () => {
    const days = minutesByDay(data, 7, today)
    expect(days).toHaveLength(7)
    expect(days.at(-1).date).toBe(today)
    expect(days.at(-1).minutes).toBeGreaterThan(0)
  })
  it('counts the current streak back from today', () => {
    expect(streak(data, today)).toBeGreaterThan(0)
    expect(streak({ sessions: [] }, today)).toBe(0)
  })
  it('does not break the streak before anything is logged today', () => {
    const s = [{ date: addDays(today, -1), minutes: 30 }, { date: addDays(today, -2), minutes: 30 }]
    expect(streak({ sessions: s }, today)).toBe(2)
  })
  it('finds the longest run of study days', () => {
    const s = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-06'].map((date) => ({ date, minutes: 20 }))
    expect(longestStreak({ sessions: s })).toBe(3)
  })
})

describe('next priority', () => {
  it('suggests the next unfinished block today', () => {
    const p = nextPriority(data, today, '12:00')
    expect(p.kind).toBe('block')
    expect(p.block.start).toBe('16:00')
  })
  it('falls back to overdue work when the day is clear', () => {
    const clear = { ...data, blocks: [] }
    expect(nextPriority(clear, today, '12:00').assignment.id).toBe('a3')
  })
})
