// "Quiz me": reading the model's quiz safely, and what a score does to a topic.
import { describe, expect, it } from 'vitest'
import { parseAnswers, parseQuiz } from '../server/quiz.js'
import { normalize, runOp } from '../src/lib/ops.js'
import { limitsFor } from '../src/lib/plans.js'

const good = { topic: 0, q: 'What is A+ for F = {A→B, B→C}?', options: ['{A}', '{A,B}', '{A,B,C}', '{B,C}'], answer: 2, why: 'A→B then B→C.' }

describe('parsing a quiz from the model', () => {
  it('reads JSON even when wrapped in prose or code fences', () => {
    const text = 'Here you go:\n```json\n' + JSON.stringify({ questions: [good] }) + '\n```'
    expect(parseQuiz(text, 1)).toEqual([{ ...good }])
  })

  it('drops malformed questions instead of trusting them', () => {
    const bad = [
      { ...good, options: ['a', 'b', 'c'] }, // three options
      { ...good, answer: 4 }, // answer out of range
      { ...good, options: ['a', 'a', 'b', 'c'] }, // duplicate options
      { ...good, q: '' }, // no question
    ]
    expect(parseQuiz(JSON.stringify({ questions: [...bad, good] }), 1)).toHaveLength(1)
    expect(parseQuiz('not json at all', 1)).toEqual([])
  })

  it('keeps topic numbers in range', () => {
    expect(parseQuiz(JSON.stringify({ questions: [{ ...good, topic: 7 }] }), 2)[0].topic).toBe(1)
  })

  it('reads the answer key from the checking model', () => {
    expect(parseAnswers('{"answers":[2,0,1]}')).toEqual([2, 0, 1])
    expect(parseAnswers('nope')).toEqual([])
  })
})

describe('recording a quiz', () => {
  const data = normalize({ subjects: [{ id: 'db', name: 'DBMS', code: 'CS502' }], units: [{ id: 'u', subjectId: 'db', title: 'N', order: 0 }], topics: [{ id: 't', subjectId: 'db', unitId: 'u', title: 'BCNF', done: false }] })

  it('turns the score into confidence and counts it as a revision', () => {
    const a = runOp(data, 'recordQuiz', { id: 't', correct: 3, total: 3 }).data.topics[0]
    expect(a).toMatchObject({ done: true, confidence: 'solid', revisions: 1, quiz: { attempts: 1, last: 100, best: 100 } })
    const b = runOp(runOp(data, 'recordQuiz', { id: 't', correct: 3, total: 3 }).data, 'recordQuiz', { id: 't', correct: 1, total: 3 }).data.topics[0]
    expect(b).toMatchObject({ confidence: 'shaky', revisions: 2, quiz: { attempts: 2, last: 33, best: 100 } })
    expect(runOp(data, 'recordQuiz', { id: 't', correct: 2, total: 3 }).data.topics[0].confidence).toBe('ok')
  })

  it('is part of every plan, with bigger allowances on Plus and Pro', () => {
    expect(limitsFor('free', 'practice.quiz').perDay).toBeLessThan(limitsFor('plus', 'practice.quiz').perDay)
    expect(limitsFor('pro', 'practice.quiz').perDay).toBeGreaterThan(limitsFor('plus', 'practice.quiz').perDay)
  })
})
