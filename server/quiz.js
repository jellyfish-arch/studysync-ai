// "Quiz me": short multiple-choice practice on the student's own syllabus
// topics, written by Yuuki's AI. The model's output is untrusted: it is parsed
// and checked here, and anything malformed is dropped.
import * as db from './db.js'
import { chat } from './llm.js'
import { consume, requireEntitlement } from './entitlements.js'

const fail = (status, message) => Object.assign(new Error(message), { status })

// Pull the JSON object out of a model reply (it may wrap it in prose or fences).
export function parseQuiz(text, topicCount) {
  const s = String(text || '')
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start < 0 || end <= start) return []
  let json
  try {
    json = JSON.parse(s.slice(start, end + 1))
  } catch {
    return []
  }
  const list = Array.isArray(json?.questions) ? json.questions : []
  return list
    .map((q) => ({
      q: String(q?.q || q?.question || '').trim().slice(0, 400),
      options: Array.isArray(q?.options) ? q.options.map((o) => String(o).trim().slice(0, 200)) : [],
      answer: Number(q?.answer),
      why: String(q?.why || q?.explanation || '').trim().slice(0, 400),
      topic: Math.min(Math.max(0, Number(q?.topic) || 0), Math.max(0, topicCount - 1)),
    }))
    .filter((q) => q.q && q.options.length === 4 && q.options.every(Boolean) && new Set(q.options).size === 4 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3)
    .slice(0, 5)
}

// Independent answer check: a second call solves each question without seeing
// the answer. Only questions where both agree are kept, because a wrong answer
// key is worse than a shorter quiz.
export function parseAnswers(text) {
  const s = String(text || '')
  try {
    const j = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1))
    return Array.isArray(j?.answers) ? j.answers.map(Number) : []
  } catch {
    return []
  }
}

async function verify(questions, writer) {
  const list = questions.map((q, i) => `${i}. ${q.q}\n${q.options.map((o, k) => `   ${k}) ${o}`).join('\n')}`).join('\n\n')
  // A different model family from the writer, so they don't share mistakes,
  // and quick: a slow checker would stall the quiz (Groq ~1 s, Gemini ~3 s).
  const prefer = writer === 'groq' ? 'gemini' : 'groq'
  const out = await chat({
    prefer,
    effort: 'medium',
    maxTokens: 2500,
    timeout: 8000,
    messages: [
      { role: 'system', content: 'You are a careful exam answer key. Solve each question yourself, step by step in your head, then reply with JSON only: {"answers":[index,...]} giving the index (0-3) of the correct option for each question, in order.' },
      { role: 'user', content: list },
    ],
  })
  const answers = parseAnswers(out.message.content)
  return questions.filter((q, i) => answers[i] === q.answer)
}

export async function makeQuiz(user, { topicIds = [], count = 3 } = {}) {
  const data = db.getState(user).data
  const topics = [...new Set(topicIds)]
    .map((id) => data.topics.find((t) => t.id === id))
    .filter(Boolean)
    .slice(0, 3)
  if (!topics.length) throw fail(400, 'Pick at least one topic to be quizzed on.')
  requireEntitlement(user, 'practice.quiz')
  // Ask for one extra: the answer check may drop one.
  const want = Math.min(5, Math.max(2, Number(count) || 3))
  const n = want + 1
  const lines = topics.map((t, i) => {
    const subject = data.subjects.find((s) => s.id === t.subjectId)
    const unit = data.units.find((u) => u.id === t.unitId)
    return `${i}. ${t.title} (subject: ${subject?.name || '?'}${subject?.code ? `, ${subject.code}` : ''}; unit: ${unit?.title || '?'})`
  })
  const messages = [
    {
      role: 'system',
      content:
        'You write short practice quizzes for Indian university students (B.Tech level). Reply with JSON only, no prose, in exactly this shape: {"questions":[{"topic":0,"q":"...","options":["...","...","...","..."],"answer":0,"why":"..."}]}. "answer" is the index (0-3) of the one correct option. "why" is one short sentence explaining the right answer. Questions test understanding and application, at the level of a university exam. All four options must be plausible and different. Prefer questions about concepts, reasons and comparisons; use a calculation only if it is simple, and work it out carefully. No "all of the above", no trick wording. Plain text, no markdown.',
    },
    { role: 'user', content: `Write ${n} questions, spread across these topics (use each topic's number in "topic"):\n${lines.join('\n')}` },
  ]
  // Two tries: free models occasionally return broken JSON.
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await chat({ messages, effort: 'medium', maxTokens: 3000 })
    const questions = await verify(parseQuiz(out.message.content, topics.length), out.provider)
    if (questions.length >= 2) {
      consume(user, 'practice.quiz')
      return {
        topics: topics.map((t) => ({ id: t.id, title: t.title, subjectId: t.subjectId })),
        questions: questions.slice(0, want).map((q) => ({ ...q, topicId: topics[q.topic].id })),
      }
    }
  }
  throw fail(502, 'Yuuki couldn’t write a good quiz this time. Try again in a moment.')
}
