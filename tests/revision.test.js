// Revision planner: confidence, spaced revision, and shaky topics in mission plans.
import { describe, expect, it } from 'vitest'
import { normalize, runOp } from '../src/lib/ops.js'
import { callTool } from '../src/lib/tools.js'
import { examConfidence, nextGap, revisionQueue } from '../src/lib/planner/revision.js'
import { generatePlan } from '../src/lib/planner/engine.js'
import { validatePlan } from '../src/lib/planner/validate.js'

const today = '2026-10-13'

function semester(topics) {
  return normalize({
    subjects: [{ id: 'db', name: 'Database Management Systems', code: 'CS502', color: 'mint' }],
    units: [{ id: 'u1', subjectId: 'db', title: 'Normalisation', order: 0 }],
    topics: topics.map((t, i) => ({ id: `t${i}`, subjectId: 'db', unitId: 'u1', done: false, ...t })),
    exams: [],
    assignments: [],
    blocks: [],
    sessions: [],
  })
}

describe('spaced revision', () => {
  it('brings shaky topics back sooner than solid ones', () => {
    expect(nextGap('shaky', 0)).toBeLessThan(nextGap('ok', 0))
    expect(nextGap('ok', 0)).toBeLessThan(nextGap('solid', 0))
    expect(nextGap('ok', 1)).toBeGreaterThan(nextGap('ok', 0)) // each revision spaces it out
  })

  it('lists what is due, with a reason, and skips what is not', () => {
    const data = semester([
      { title: 'BCNF', done: true, doneOn: '2026-10-11', confidence: 'shaky' }, // 2 days ago, shaky: due
      { title: '1NF', done: true, doneOn: '2026-10-12', confidence: 'solid' }, // yesterday, solid: not due
      { title: '3NF', done: true, doneOn: '2026-10-01' }, // 12 days ago, never revised: due
      { title: 'Closure', done: false }, // not ticked: never due
    ])
    const q = revisionQueue(data, { today })
    expect(q.map((x) => x.title)).toEqual(['BCNF', '3NF'])
    expect(q[0].reason).toMatch(/shaky/)
    expect(q[1].reason).toMatch(/not revised/)
  })

  it('puts topics for an exam this week first, unless they are solid', () => {
    const data = semester([
      { title: 'BCNF', done: true, doneOn: '2026-10-09', confidence: 'ok' },
      { title: '1NF', done: true, doneOn: '2026-10-09', confidence: 'solid' },
    ])
    data.exams = [{ id: 'e1', subjectId: 'db', title: 'Quiz 2', type: 'Quiz', date: '2026-10-16', unitIds: [] }]
    const q = revisionQueue(data, { today })
    expect(q.map((x) => x.title)).toEqual(['BCNF'])
    expect(q[0].reason).toMatch(/Quiz 2 is in 3 days/)
    expect(examConfidence(data, data.exams[0])).toMatchObject({ ticked: 2, solid: 1, shaky: 0 })
  })
})

describe('rating and revising topics', () => {
  it('rates a topic, which also marks it covered', () => {
    const data = semester([{ title: 'BCNF' }])
    const out = runOp(data, 'rateTopic', { topic: 'BCNF', confidence: 'shaky' })
    expect(out.data.topics[0]).toMatchObject({ done: true, confidence: 'shaky' })
    expect(() => runOp(data, 'rateTopic', { topic: 'BCNF', confidence: 'amazing' })).toThrow(/shaky, ok/)
  })

  it('records a revision and moves the next one out', () => {
    let data = semester([{ title: 'BCNF', done: true, doneOn: '2026-10-01', confidence: 'shaky' }])
    data = runOp(data, 'reviseTopic', { topic: 'BCNF', confidence: 'ok' }).data
    expect(data.topics[0]).toMatchObject({ revisions: 1, confidence: 'ok' })
    expect(data.topics[0].revisedOn).toBeTruthy()
  })

  it('is available to Yuuki and AI apps as tools', () => {
    const data = semester([{ title: 'BCNF', done: true, doneOn: '2026-10-01' }])
    const r = callTool(data, 'rate_topic', { topic: 'BCNF', confidence: 'shaky' })
    expect(r.output).toMatchObject({ ok: true, topic: 'BCNF', confidence: 'shaky' })
    const r2 = callTool(r.data, 'mark_topic_revised', { topic: 'BCNF' })
    expect(r2.output).toMatchObject({ ok: true, revisions: 1, confidence: 'shaky' })
  })
})

describe('mission plans use confidence', () => {
  it('gives shaky topics a revision slot before the exam', () => {
    const data = semester([
      { title: 'BCNF', done: true, doneOn: '2026-10-01', confidence: 'shaky' },
      { title: '1NF', done: true, doneOn: '2026-10-01', confidence: 'solid' },
      { title: 'Closure', done: false },
    ])
    data.exams = [{ id: 'e1', subjectId: 'db', title: 'Quiz 2', type: 'Quiz', date: '2026-10-18', unitIds: [] }]
    const plan = generatePlan(data, { type: 'exam', exam: 'e1' }, { dailyMinutes: 120 }, { today, now: '09:00' })
    const tasks = plan.days.flatMap((d) => d.tasks.map((t) => ({ ...t, date: d.date })))
    const revise = tasks.find((t) => t.kind === 'revise')
    expect(revise.topicIds).toEqual(['t0']) // BCNF, not the solid 1NF
    expect(revise.title).toMatch(/revise BCNF/)
    expect(revise.date < '2026-10-18').toBe(true)
    expect(validatePlan(plan, data, { today }).valid).toBe(true)
  })
})
