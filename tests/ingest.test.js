// Reading pasted syllabus text the way universities actually print it.
import { describe, expect, it } from 'vitest'
import { parseSyllabus, splitTopics } from '../src/lib/ingest.js'
import { normalize, runOp } from '../src/lib/ops.js'

const UNIVERSITY = `CS501 OPERATING SYSTEMS  L T P C 3 0 0 3
UNIT-I INTRODUCTION (9 hours)
Operating system structure, system calls, process concept, threads.
UNIT - II  CPU Scheduling: FCFS, SJF, Round Robin, Priority scheduling [CO2]
UNIT III
1. Critical section problem
2. Semaphores; mutex locks
Module 4 – Deadlocks – Banker's algorithm, deadlock detection, recovery 9 Hrs
TEXT BOOKS:
1. Silberschatz, Operating System Concepts, Wiley`

describe('syllabus parsing', () => {
  it('reads units, topics and noise the way a university PDF prints them', () => {
    const r = parseSyllabus(UNIVERSITY)
    expect(r.units.map((u) => u.title)).toEqual(['INTRODUCTION', 'CPU Scheduling', 'Unit 3', 'Deadlocks'])
    expect(r.units[0].topics).toEqual(['Operating system structure', 'system calls', 'process concept', 'threads'])
    expect(r.units[1].topics).toContain('Round Robin')
    expect(r.units[2].topics).toEqual(['Critical section problem', 'Semaphores', 'mutex locks'])
    expect(r.units[3].topics).toEqual(["Banker's algorithm", 'deadlock detection', 'recovery'])
    // nothing from the reading list, no hours or outcome codes
    expect(JSON.stringify(r.units)).not.toMatch(/Silberschatz|hours|Hrs|CO2/)
    expect(r.notes.join(' ')).toMatch(/Skipped 1 line/)
    expect(r.notes.join(' ')).toMatch(/TEXT BOOKS/)
  })

  it('keeps short phrases whole and splits real lists', () => {
    expect(splitTopics('SQL joins, views and triggers')).toEqual(['SQL joins, views and triggers'])
    expect(splitTopics('1NF, 2NF, 3NF')).toEqual(['1NF', '2NF', '3NF'])
    expect(splitTopics('Paging (TLB, EAT); segmentation')).toEqual(['Paging (TLB, EAT)', 'segmentation'])
  })

  it('does not mistake a topic like "Unit testing" for a unit', () => {
    const r = parseSyllabus('Unit 1: Testing\nUnit testing, integration testing, system testing')
    expect(r.units).toHaveLength(1)
    expect(r.units[0].topics).toContain('Unit testing')
  })

  it('works without unit headings: the first line names the unit', () => {
    const r = parseSyllabus('Basics\nprocesses\nthreads')
    expect(r.units).toEqual([{ title: 'Basics', topics: ['processes', 'threads'] }])
  })
})

describe('adding a reviewed syllabus', () => {
  const data = normalize({ subjects: [{ id: 'os', name: 'Operating Systems', code: 'CS501', color: 'gold' }] })

  it('writes exactly the units and topics the student kept', () => {
    const { data: d, result } = runOp(data, 'addSyllabus', { subjectId: 'os', units: [{ title: 'Processes', topics: ['PCB', 'Threads'] }, { title: '  ', topics: ['ignored'] }, { title: 'Memory', topics: [] }] })
    expect(result).toEqual({ units: 2, topics: 2 })
    expect(d.units.map((u) => u.title)).toEqual(['Processes', 'Memory'])
    expect(d.topics.map((t) => t.title)).toEqual(['PCB', 'Threads'])
  })

  it('import_syllabus (used by Yuuki and AI apps) uses the same parser', () => {
    const { data: d, result } = runOp(data, 'importSyllabus', { subject: 'CS501', text: UNIVERSITY })
    expect(result.units).toBe(4)
    expect(d.topics.some((t) => /Silberschatz/.test(t.title))).toBe(false)
  })
})
