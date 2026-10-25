import { describe, expect, it } from 'vitest'
import { OpError, emptyData, findSubject, normalize, runOp } from '../src/lib/ops.js'
import { mergeData } from '../src/lib/merge.js'
import { callTool } from '../src/lib/tools.js'
import { accountExists, hashPassword, verifyPassword } from '../src/lib/accounts.js'
import { addDays, todayISO } from '../src/lib/dates.js'

const run = (data, name, args) => runOp(data, name, args)

function withSubject(name = 'Database Management Systems', code = 'CS502') {
  return run(emptyData(), 'addSubject', { name, code }).data
}

describe('ops', () => {
  it('adds a subject with the next free colour and refuses duplicates', () => {
    let d = withSubject()
    expect(d.subjects[0]).toMatchObject({ name: 'Database Management Systems', code: 'CS502', color: 'gold' })
    d = run(d, 'addSubject', { name: 'Operating Systems' }).data
    expect(d.subjects[1].color).toBe('rose')
    expect(() => run(d, 'addSubject', { name: 'operating systems' })).toThrow(OpError)
  })

  it('finds subjects by id, code, name, partial name or acronym', () => {
    let d = withSubject()
    d = run(d, 'addSubject', { name: 'Operating Systems', code: 'CS501' }).data
    expect(findSubject(d, 'cs501').name).toBe('Operating Systems')
    expect(findSubject(d, 'operating').name).toBe('Operating Systems')
    expect(findSubject(d, 'OS').name).toBe('Operating Systems')
    expect(findSubject(d, 'DBMS').name).toBe('Database Management Systems')
    expect(findSubject(d, 'Chemistry')).toBeNull()
  })

  it('imports a pasted syllabus into units and topics', () => {
    const d = withSubject()
    const { data, result } = run(d, 'importSyllabus', {
      subject: 'CS502',
      text: 'Unit 1: Intro\n- Data models\n- ER diagrams\n\nModule 2 - Relational model\n1. Relational algebra\n2. SQL joins, views and triggers',
    })
    expect(result).toEqual({ units: 2, topics: 4 })
    expect(data.units.map((u) => u.title)).toEqual(['Intro', 'Relational model'])
    expect(data.topics.at(-1).title).toBe('SQL joins, views and triggers')
  })

  it('validates dates and understands friendly times', () => {
    const d = withSubject()
    expect(() => run(d, 'addExam', { subject: 'CS502', date: '15/10/2026' })).toThrow(/YYYY-MM-DD|date like/)
    const block = run(d, 'addBlock', { subject: 'CS502', date: 'tomorrow', start: '7:30 pm' }).result
    expect(block).toMatchObject({ start: '19:30', date: addDays(todayISO(), 1), minutes: 45 })
  })

  it('logs time when a block is completed, and removes it when reopened', () => {
    let d = withSubject()
    const { data, result } = run(d, 'addBlock', { subject: 'CS502', date: todayISO(), start: '18:00', minutes: 50 })
    d = run(data, 'completeBlock', { id: result.id }).data
    expect(d.sessions).toHaveLength(1)
    expect(d.sessions[0]).toMatchObject({ minutes: 50, blockId: result.id })
    d = run(d, 'reopenBlock', { id: result.id }).data
    expect(d.sessions).toHaveLength(0)
  })

  it('moves an exam to another subject and clears its units', () => {
    let d = withSubject()
    d = run(d, 'addSubject', { name: 'Operating Systems', code: 'CS501' }).data
    d = run(d, 'addUnit', { subject: 'CS502', title: 'Normalisation' }).data
    const exam = run(d, 'addExam', { subject: 'CS502', date: '2030-01-01', units: ['Normalisation'] })
    expect(exam.result.unitIds).toHaveLength(1)
    const moved = run(exam.data, 'updateExam', { id: exam.result.id, subjectId: d.subjects[1].id }).result
    expect(moved.subjectId).toBe(d.subjects[1].id)
    expect(moved.unitIds).toEqual([])
  })

  it('cascades a subject delete', () => {
    let d = withSubject()
    d = run(d, 'addUnit', { subject: 'CS502', title: 'U1' }).data
    d = run(d, 'addTopics', { unitId: d.units[0].id, titles: ['a', 'b'] }).data
    d = run(d, 'deleteSubject', { subject: 'CS502' }).data
    expect([d.subjects.length, d.units.length, d.topics.length]).toEqual([0, 0, 0])
  })

  it('upgrades old saved data', () => {
    const old = { profile: { name: 'A', dailyGoal: 120, isDemo: true }, subjects: [], units: [], topics: [], exams: [], assignments: [], blocks: [], sessions: [] }
    const d = normalize(old)
    expect(d.prefs.dailyGoal).toBe(120)
    expect(d.profile).not.toHaveProperty('isDemo')
    expect(d.guide.introduced).toBe(false)
  })
})

describe('merge', () => {
  it('keeps both sides when the app and an AI add things at the same time', () => {
    const base = withSubject()
    const mine = run(base, 'addAssignment', { subject: 'CS502', title: 'Lab', due: '2030-01-01' }).data
    const theirs = run(base, 'addExam', { subject: 'CS502', date: '2030-01-02' }).data
    const merged = mergeData(base, mine, theirs)
    expect(merged.assignments).toHaveLength(1)
    expect(merged.exams).toHaveLength(1)
  })

  it('applies my deletes and edits, and keeps their new items', () => {
    let base = withSubject()
    base = run(base, 'addAssignment', { subject: 'CS502', title: 'Old', due: '2030-01-01' }).data
    const id = base.assignments[0].id
    const mine = run(base, 'deleteAssignment', { id }).data
    const theirs = run(base, 'addSubject', { name: 'Maths' }).data
    const merged = mergeData(base, mine, theirs)
    expect(merged.assignments).toHaveLength(0)
    expect(merged.subjects.map((s) => s.name)).toEqual(['Database Management Systems', 'Maths'])

    const edited = run(base, 'updateAssignment', { id, status: 'done' }).data
    const merged2 = mergeData(base, edited, base)
    expect(merged2.assignments[0].status).toBe('done')
  })

  it('combines two copies that never synced instead of deleting either', () => {
    const a = withSubject('Physics')
    const b = withSubject('Chemistry')
    const merged = mergeData(null, a, b)
    expect(merged.subjects.map((s) => s.name).sort()).toEqual(['Chemistry', 'Physics'])
  })

  it('merges profile fields one by one', () => {
    const base = emptyData()
    const mine = run(base, 'updateProfile', { name: 'Kal' }).data
    const theirs = run(base, 'updateProfile', { course: 'B.Tech' }).data
    expect(mergeData(base, mine, theirs).profile).toMatchObject({ name: 'Kal', course: 'B.Tech' })
  })
})

describe('AI tools', () => {
  it('creates a subject with its syllabus in one call', () => {
    const { data, output } = callTool(emptyData(), 'add_subject', { name: 'Operating Systems', code: 'cs501', syllabus: 'Unit 1: Processes\nPCB\nUnit 2: Memory\nPaging' })
    expect(output).toMatchObject({ ok: true, added: { code: 'CS501' }, imported: { units: 2, topics: 2 } })
    expect(data.topics).toHaveLength(2)
  })

  it('returns errors as data so the model can retry', () => {
    const r = callTool(emptyData(), 'add_exam', { subject: 'Maths', date: '2030-01-01' })
    expect(r.data).toBeNull()
    expect(r.output.error).toMatch(/no subjects yet/)
  })

  it('plans several study blocks at once', () => {
    const d = withSubject()
    const { data, output } = callTool(d, 'plan_study_blocks', {
      blocks: [
        { subject: 'DBMS', date: '2030-01-01', start: '18:00' },
        { subject: 'CS502', date: '2030-01-02', start: '6pm', minutes: 90 },
      ],
    })
    expect(output.added).toHaveLength(2)
    expect(data.blocks[1]).toMatchObject({ start: '18:00', minutes: 90 })
  })

  it('reads an overview without changing anything', () => {
    const r = callTool(withSubject(), 'get_overview', {})
    expect(r.data).toBeNull()
    expect(r.output.subjects[0].name).toBe('Database Management Systems')
  })
})

describe('accounts', () => {
  it('only stores hashes and rejects wrong or unknown logins', async () => {
    expect(accountExists('KAL')).toBe(true)
    expect(accountExists('nobody')).toBe(false)
    expect(await verifyPassword('kal', 'not-the-password')).toBe(false)
    expect(await verifyPassword('nobody', 'x')).toBe(false)
    expect(await hashPassword('x', '00')).toBe(await hashPassword('x', '00'))
  })
})
