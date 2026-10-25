// Mission Planner: context, generation, feasibility, validation, applying,
// repair and the risk radar, all against a realistic semester.
import { describe, expect, it } from 'vitest'
import { demoSemester } from './fixtures/semester.js'
import { emptyData, normalize, runOp } from '../src/lib/ops.js'
import { addDays } from '../src/lib/dates.js'
import { buildAcademicContext } from '../src/lib/planner/context.js'
import { generatePlan, simulateScenarios } from '../src/lib/planner/engine.js'
import { normalizeExternalPlan, validatePlan } from '../src/lib/planner/validate.js'
import { applyChanges, planChanges, planProgress, proposeRepair, taskKey } from '../src/lib/planner/progress.js'
import { analyzeRisks } from '../src/lib/planner/risks.js'
import { weeklyReview } from '../src/lib/planner/review.js'

const today = '2026-10-10'
const env = { today, now: '09:00' }
const base = () => normalize(demoSemester(today))
const allTasks = (plan) => plan.days.flatMap((d) => d.tasks.map((t) => ({ ...t, date: d.date })))

function stored(plan, id = 'plan1', rev = 1, inputOptions = {}) {
  return { id, goal: plan.goal, title: plan.title, status: 'active', activeRev: rev, revisions: [{ rev, plan, inputOptions }] }
}

describe('academic context', () => {
  it('scopes to the chosen exam and lists what it does not know', () => {
    const ctx = buildAcademicContext(base(), { type: 'exam', exam: 'e1' }, { today })
    expect(ctx.exams.map((e) => e.id)).toEqual(['e1'])
    expect(ctx.horizon.end).toBe(ctx.exams[0].date)
    expect(ctx.exams[0].units.every((u) => u.id === 'dbms-u3')).toBe(true)
    expect(ctx.questions.map((q) => q.id)).toEqual(expect.arrayContaining(['dailyMinutes', 'minutesPerTopic']))
  })

  it('picks the next exam when none is named, and says so', () => {
    const ctx = buildAcademicContext(base(), { type: 'exam' }, { today })
    expect(ctx.exams).toHaveLength(1)
    expect(ctx.notes[0]).toMatch(/used your next one/)
  })
})

describe('plan generation', () => {
  it('builds a feasible exam plan that finishes before the exam', () => {
    const data = base()
    // This semester already has ~2 h of blocks a day, so give the plan room.
    const plan = generatePlan(data, { type: 'exam', exam: 'e1' }, { dailyMinutes: 300 }, env)
    const exam = data.exams.find((e) => e.id === 'e1')
    expect(plan.warnings.some((w) => w.code === 'assignments')).toBe(true)
    const tasks = allTasks(plan)
    expect(tasks.length).toBeGreaterThan(0)
    expect(tasks.every((t) => t.date < exam.date)).toBe(true)
    expect(tasks.some((t) => t.kind === 'revision' && t.date === addDays(exam.date, -1))).toBe(true)
    // the two topics left in Unit 3 are both planned
    expect(new Set(tasks.flatMap((t) => t.topicIds)).size).toBe(2)
    expect(plan.milestones.at(-1)).toMatchObject({ kind: 'exam', date: exam.date })
    expect(plan.feasibility.verdict).toBe('feasible')
    expect(plan.assumptions.join(' ')).toMatch(/not that you have mastered/)
    expect(validatePlan(plan, data, { today }).valid).toBe(true)
  })

  it('says when a schedule is impossible instead of pretending', () => {
    const data = base()
    const plan = generatePlan(data, { type: 'exams', withinDays: 14 }, { dailyMinutes: 20, minutesPerTopic: 90 }, env)
    expect(plan.feasibility.verdict).toBe('infeasible')
    expect(plan.deferred.length).toBeGreaterThan(0)
    expect(plan.feasibility.shortfallMinutes).toBeGreaterThan(0)
    expect(plan.priorities.deferred.some((r) => /(don't|doesn't) fit before/.test(r))).toBe(true)
  })

  it('never leaves a sliver of a topic for the next day when planning late at night', () => {
    // Regression: 41 free minutes tonight made a 41-minute block today and a
    // 4-minute block tomorrow, which then failed validation on approve.
    const data = normalize({
      subjects: [{ id: 'os', name: 'Operating Systems', code: 'CS501', color: 'gold' }],
      units: [{ id: 'u1', subjectId: 'os', title: 'Processes', order: 0 }],
      topics: ['Process states', 'PCB', 'FCFS', 'Round Robin'].map((title, i) => ({ id: `t${i}`, subjectId: 'os', unitId: 'u1', title, done: false })),
      exams: [],
      assignments: [],
      blocks: [],
      sessions: [],
    })
    for (const now of ['21:30', '22:16', '22:40']) {
      const plan = generatePlan(data, { type: 'week' }, { dailyMinutes: 120 }, { today: '2026-10-13', now })
      for (const t of allTasks(plan)) expect(t.minutes).toBeGreaterThanOrEqual(20)
      expect(validatePlan(plan, data, { today: '2026-10-13' }).valid).toBe(true)
    }
  })

  it('lets a plan catch up on overdue work instead of refusing it', () => {
    // Regression: overdue assignments were scheduled today, then rejected on approve.
    const data = base()
    const plan = generatePlan(data, { type: 'week' }, { dailyMinutes: 180 }, env)
    const overdue = data.assignments.find((a) => a.due < today && a.status !== 'done')
    expect(allTasks(plan).some((t) => t.assignmentId === overdue.id)).toBe(true)
    const v = validatePlan(plan, data, { today })
    expect(v.errors).toEqual([])
    expect(v.warnings.join(' ')).toMatch(/catches up/)
  })

  it('covers topics before booking revision when time is short', () => {
    const data = base()
    const plan = generatePlan(data, { type: 'exams', withinDays: 14 }, { dailyMinutes: 120 }, env)
    const tasks = allTasks(plan)
    const short = plan.deferred.filter((d) => d.kind === 'exam' && d.topics > 0)
    expect(short.length).toBeGreaterThan(0)
    for (const d of short) {
      const examId = d.streamKey.replace(/^exam:/, '')
      // An exam whose topics don't all fit gets no revision, practice or checkpoint time.
      expect(tasks.filter((t) => t.examId === examId && ['revision', 'practice', 'checkpoint'].includes(t.kind))).toEqual([])
    }
    expect(plan.warnings.some((w) => w.code === 'no-revision')).toBe(true)
    expect(validatePlan(plan, data, { today }).valid).toBe(true)
  })

  it('handles several exams close together, earliest first', () => {
    const plan = generatePlan(base(), { type: 'exams', withinDays: 21 }, { dailyMinutes: 240 }, env)
    const firstExamTask = allTasks(plan).find((t) => t.examId)
    const exams = plan.startingState.exams.slice().sort((a, b) => a.date.localeCompare(b.date))
    expect(firstExamTask.examId).toBe(exams[0].id)
    expect(plan.feasibility.perDeadline.length).toBeGreaterThan(1)
  })

  it('fits around existing study blocks without clashing', () => {
    const data = base()
    const plan = generatePlan(data, { type: 'week' }, { dailyMinutes: 300 }, env)
    const v = validatePlan(plan, data, { today })
    expect(v.errors.filter((e) => /clashes|overlaps/.test(e))).toEqual([])
  })

  it('folds missed blocks into a catch-up plan', () => {
    const data = base()
    // Pretend the last two days' blocks were skipped.
    data.blocks = data.blocks.map((b) => (b.date < today && b.date >= addDays(today, -2) ? { ...b, done: false } : b))
    data.sessions = data.sessions.filter((s) => !s.blockId || data.blocks.find((b) => b.id === s.blockId)?.done)
    expect(data.blocks.filter((b) => !b.done && b.date < today).length).toBeGreaterThan(0)
    const plan = generatePlan(data, { type: 'recovery' }, { dailyMinutes: 240 }, env)
    expect(allTasks(plan).some((t) => t.kind === 'catchup')).toBe(true)
  })

  it('caps the horizon to what the plan allows', () => {
    const plan = generatePlan(base(), { type: 'semester' }, {}, { ...env, maxHorizonDays: 7 })
    expect(plan.end).toBe(addDays(today, 6))
    expect(plan.warnings.some((w) => w.code === 'horizon')).toBe(true)
  })

  it('returns an empty result when there is nothing to plan for', () => {
    const plan = generatePlan(emptyData(), { type: 'exam' }, {}, env)
    expect(plan.empty).toBe(true)
  })

  it('compares scenarios honestly', () => {
    const rows = simulateScenarios(base(), { type: 'exams', withinDays: 14 }, { minutesPerTopic: 60 }, [
      { label: '1 h', options: { dailyMinutes: 60 } },
      { label: '4 h', options: { dailyMinutes: 240 } },
    ], env)
    expect(rows[0].shortfallMinutes).toBeGreaterThanOrEqual(rows[1].shortfallMinutes)
    expect(['infeasible', 'tight']).toContain(rows[0].verdict)
  })
})

describe('validation of plans written by an AI', () => {
  it('rejects tasks after the exam, unknown subjects, past days and clashes', () => {
    const data = base()
    const exam = data.exams.find((e) => e.id === 'e1')
    const existing = data.blocks.find((b) => b.date === today && !b.done)
    const { plan, errors } = normalizeExternalPlan(
      {
        days: [
          { date: addDays(today, -1), tasks: [{ title: 'old', subject: 'DBMS', minutes: 30, start: '10:00' }] },
          { date: exam.date, tasks: [{ title: 'cram', subject: 'CS502', exam: 'e1', minutes: 60, start: '08:00' }] },
          { date: addDays(today, 1), tasks: [{ title: 'mystery', subject: 'Astrology', minutes: 30, start: '10:00' }] },
          { date: today, tasks: [{ title: 'clash', subject: 'DBMS', minutes: 60, start: existing.start }] },
        ],
      },
      data,
    )
    expect(errors).toEqual([])
    const v = validatePlan(plan, data, { today })
    expect(v.valid).toBe(false)
    const all = v.errors.join(' | ')
    expect(all).toMatch(/in the past/)
    expect(all).toMatch(/on or after/)
    expect(all).toMatch(/not linked to one of your subjects/)
    expect(all).toMatch(/clashes with your existing block/)
  })
})

describe('applying and repairing', () => {
  it('applies a plan once, and a second apply adds nothing', () => {
    let data = base()
    const plan = generatePlan(data, { type: 'exam', exam: 'e1' }, {}, env)
    const c1 = planChanges(data, 'plan1', 1, plan, { today })
    data = applyChanges(data, c1).data
    expect(c1.add.length).toBe(plan.stats.tasks)
    const c2 = planChanges(data, 'plan1', 1, plan, { today })
    expect(c2.add).toHaveLength(0)
    expect(c2.skipped).toBe(plan.stats.tasks)
    expect(data.blocks.filter((b) => b.planId === 'plan1')).toHaveLength(plan.stats.tasks)
  })

  it('works around another mission, or re-plans it when asked', () => {
    let data = base()
    const goal = { type: 'week' }
    const first = generatePlan(data, goal, { dailyMinutes: 240 }, env)
    data = applyChanges(data, planChanges(data, 'plan1', 1, first, { today })).data
    // Another plan for the same days sees plan1's blocks as busy, and says so.
    const around = generatePlan(data, goal, { dailyMinutes: 240 }, env)
    expect(around.warnings.some((w) => w.code === 'other-mission')).toBe(true)
    expect(around.feasibility.capacityMinutes).toBeLessThan(first.feasibility.capacityMinutes)
    // Re-planning plan1 treats its own unfinished blocks as free time again.
    const replan = generatePlan(data, goal, { dailyMinutes: 240 }, { ...env, excludePlanIds: ['plan1'] })
    expect(replan.warnings.some((w) => w.code === 'other-mission')).toBe(false)
    expect(replan.feasibility.capacityMinutes).toBe(first.feasibility.capacityMinutes)
  })

  it('repairs after missed blocks without touching finished or unrelated work', () => {
    let data = base()
    const plan = generatePlan(data, { type: 'exams', withinDays: 14 }, { dailyMinutes: 180 }, env)
    data = applyChanges(data, planChanges(data, 'p', 1, plan, { today })).data
    const s = stored(plan, 'p', 1, { dailyMinutes: 180 })
    // Two days pass: the first plan block is done, the rest of day one is missed.
    const later = addDays(today, 2)
    const first = data.blocks.find((b) => b.planId === 'p' && b.date === today)
    data = runOp(data, 'completeBlock', { id: first.id }).data
    const unrelated = data.blocks.filter((b) => !b.planId).map((b) => b.id)

    const before = planProgress(data, 'p', 1, plan, { today: later })
    expect(before.counts.done).toBe(1)
    expect(before.counts.missed).toBeGreaterThan(0)

    const proposal = proposeRepair(data, s, { today: later, now: '09:00' })
    expect(proposal.diff.summary[0]).toMatch(/missed/)
    expect(proposal.diff.removeBlocks.every((b) => b.date >= later)).toBe(true)

    const c = planChanges(data, 'p', 2, proposal.plan, { today: later })
    const next = applyChanges(data, c).data
    expect(next.blocks.find((b) => b.id === first.id)?.done).toBe(true) // finished work kept
    expect(unrelated.every((id) => next.blocks.some((b) => b.id === id))).toBe(true) // others untouched
    expect(next.blocks.some((b) => b.planId === 'p' && b.planRev === 1 && !b.done && b.date >= later)).toBe(false) // old pending replaced
    // a repeated apply of the same revision changes nothing
    const again = planChanges(next, 'p', 2, proposal.plan, { today: later })
    expect(again.add).toHaveLength(0)
    expect(again.remove).toHaveLength(0)
  })

  it('keys tasks by plan, revision and task', () => {
    expect(taskKey('p', 3, 't7')).toBe('p:r3:t7')
  })
})

describe('risk radar and weekly review', () => {
  it('flags the overdue assignment and the unready exam with next steps', () => {
    const risks = analyzeRisks(base(), { today })
    expect(risks[0].level).toBe('high')
    expect(risks.some((r) => r.id === 'overdue:a3')).toBe(true)
    const exam = risks.find((r) => r.id === 'exam:e1')
    expect(exam.next.plan).toEqual({ type: 'exam', exam: 'e1' })
    expect(exam.reason).toMatch(/topics aren't ticked/)
  })

  it('summarises the week with suggestions', () => {
    const r = weeklyReview(base(), [], { today })
    expect(r.studiedMinutes).toBeGreaterThan(0)
    expect(r.blocks.planned).toBeGreaterThan(0)
    expect(typeof r.headline).toBe('string')
  })
})
