// "Quiz me": a short practice quiz written by Yuuki's AI on the student's own
// topics. The score is evidence of readiness: it sets each topic's confidence
// and when it comes back for revision.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Check, Refresh, X } from './icons.jsx'
import { Button, Drawer, cn } from './ui.jsx'
import { UpgradeNote } from './plan.jsx'
import { useUI } from '../lib/ui.js'
import { useStore } from '../lib/store.js'
import { api } from '../lib/api.js'
import { loadAccount } from '../lib/account.js'
import { nextGap } from '../lib/planner/revision.js'
import { YuukiPose } from '../yuuki/Yuuki.jsx'
import { celebrate } from './ui.jsx'

const LETTERS = ['A', 'B', 'C', 'D']

export function QuizDrawer() {
  const quiz = useUI((s) => s.quiz)
  const close = useUI((s) => s.closeQuiz)
  const recordQuiz = useStore((s) => s.recordQuiz)
  const celebrations = useStore((s) => s.prefs.celebrations)
  const [state, setState] = useState({ phase: 'idle' })
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState([])
  const [showResult, setShowResult] = useState(false)
  const recorded = useRef(false)
  const request = useRef(0) // only the newest quiz request may update the screen

  const start = async () => {
    const id = ++request.current
    setState({ phase: 'loading' })
    setI(0)
    setAnswers([])
    setShowResult(false)
    recorded.current = false
    try {
      const out = await api('/quiz', { method: 'POST', body: { topicIds: quiz.topicIds, count: 3 }, timeout: 60000 })
      if (id === request.current) setState({ phase: 'asking', ...out })
    } catch (e) {
      if (id === request.current) setState({ phase: 'error', error: e })
    } finally {
      loadAccount()
    }
  }

  useEffect(() => {
    if (quiz) start()
    else {
      request.current++ // closed: ignore anything still on its way
      setState({ phase: 'idle' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz])

  const questions = state.questions || []
  const q = questions[i]
  const done = state.phase === 'asking' && questions.length > 0 && answers.length === questions.length && (i === questions.length - 1 ? showResult : false)

  // Save the result once: score per topic -> confidence and next revision.
  useEffect(() => {
    if (!done || recorded.current) return
    recorded.current = true
    const byTopic = new Map()
    questions.forEach((x, k) => {
      const r = byTopic.get(x.topicId) || { correct: 0, total: 0 }
      r.total++
      if (answers[k] === x.answer) r.correct++
      byTopic.set(x.topicId, r)
    })
    for (const [id, r] of byTopic) recordQuiz(id, r.correct, r.total)
    const score = answers.filter((a, k) => a === questions[k].answer).length
    if (score === questions.length && celebrations) celebrate()
  }, [done, answers, questions, recordQuiz, celebrations])

  // Both are safe to click twice (or on a card that's animating out): answering
  // only counts once per question, and Next always goes to the first unanswered one.
  // The first answer to a question is the one that counts, and the one shown.
  const picked = answers[i] ?? null
  const choose = (k) => setAnswers((a) => (a.length > i ? a : [...a, k]))
  const next = () => {
    if (answers.length >= questions.length) return setShowResult(true)
    setI(Math.min(answers.length, questions.length - 1))
  }

  const score = answers.filter((a, k) => a === questions[k]?.answer).length
  const pct = questions.length ? Math.round((score / questions.length) * 100) : 0
  const level = pct >= 80 ? 'solid' : pct >= 50 ? 'ok' : 'shaky'
  const gap = nextGap(level, 1)

  return (
    <Drawer open={Boolean(quiz)} onClose={close} title="Quiz me" sub={quiz?.title} accent="var(--teal)">
      <AnimatePresence mode="wait">
        {state.phase === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-10 text-center">
            <YuukiPose name="think" className="w-32" />
            <p className="mt-4 font-semibold text-ink">Writing your questions…</p>
            <p className="mt-1 text-sm text-muted">From your syllabus topics, then double-checked. About 10 to 15 seconds.</p>
          </motion.div>
        )}

        {state.phase === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-6">
            {state.error?.status === 402 ? (
              <UpgradeNote message={state.error.message} upgradeTo={state.error.data?.entitlement?.upgradeTo} />
            ) : (
              <div className="flex flex-col items-center text-center">
                <YuukiPose name="oops" className="w-28" />
                <p className="mt-3 font-semibold text-ink">{state.error?.status === 503 ? 'Quizzes need Yuuki’s AI, which isn’t switched on here.' : state.error?.status === 0 ? 'Can’t reach StudySync’s server right now.' : 'Yuuki couldn’t write this quiz.'}</p>
                <p className="mt-1 text-sm text-muted">{state.error?.status === 503 || state.error?.status === 0 ? 'Everything else still works.' : 'Her free AI models are busy or unsure. Try again in a moment.'}</p>
                {state.error?.status !== 503 && (
                  <Button variant="outline" className="mt-4" onClick={start}>
                    <Refresh /> Try again
                  </Button>
                )}
              </div>
            )}
          </motion.div>
        )}

        {state.phase === 'asking' && !done && q && (
          <motion.div key={`q${i}`} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
            <div className="mb-4 flex items-center gap-2">
              {questions.map((_, k) => (
                <span key={k} className={cn('h-1.5 flex-1 rounded-full', k < answers.length ? (answers[k] === questions[k].answer ? 'bg-mint' : 'bg-coral') : k === i ? 'bg-[var(--accent)]' : 'bg-surface-3')} />
              ))}
            </div>
            <p className="text-[0.78rem] font-semibold text-muted">
              Question {i + 1} of {questions.length} · {state.topics.find((t) => t.id === q.topicId)?.title}
            </p>
            <h3 className="mt-2 text-[1.05rem] leading-snug font-semibold text-ink">{q.q}</h3>
            <ul className="mt-4 space-y-2">
              {q.options.map((o, k) => {
                const right = picked != null && k === q.answer
                const wrong = picked === k && k !== q.answer
                return (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => choose(k)}
                      disabled={picked != null}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition-colors',
                        right ? 'border-mint bg-[color-mix(in_srgb,var(--mint)_10%,transparent)] text-ink' : wrong ? 'border-coral bg-[color-mix(in_srgb,var(--coral)_10%,transparent)] text-ink' : picked != null ? 'border-line text-muted' : 'border-line text-ink-2 hover:border-line-strong hover:text-ink',
                      )}
                    >
                      <span className={cn('grid size-6 shrink-0 place-items-center rounded-md border text-[0.75rem] font-bold', right ? 'border-mint bg-mint text-black' : wrong ? 'border-coral bg-coral text-black' : 'border-line-strong')}>
                        {right ? <Check className="size-3.5" /> : wrong ? <X className="size-3.5" /> : LETTERS[k]}
                      </span>
                      <span className="pt-0.5">{o}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
            {picked != null && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl border border-line p-3 text-sm text-ink-2">
                <span className={cn('font-semibold', picked === q.answer ? 'text-mint' : 'text-coral')}>{picked === q.answer ? 'Correct. ' : 'Not quite. '}</span>
                {q.why}
              </motion.div>
            )}
            <div className="mt-5 flex justify-end">
              <Button variant="primary" onClick={next} disabled={picked == null}>
                {i + 1 < questions.length ? 'Next' : 'See result'} <ArrowRight />
              </Button>
            </div>
          </motion.div>
        )}

        {done && (
          <motion.div key="done" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center py-4 text-center">
            <YuukiPose name={pct >= 80 ? 'cheer' : pct >= 50 ? 'thumbs' : 'worried'} className="w-32" />
            <p className="mt-3 font-display text-4xl font-bold text-ink">
              {score}/{questions.length}
            </p>
            <p className="mt-2 max-w-sm text-sm text-ink-2">
              {pct >= 80 ? 'You know this. ' : pct >= 50 ? 'Getting there. ' : 'Good that we caught it now. '}
              Marked <b className={level === 'solid' ? 'text-mint' : level === 'ok' ? 'text-gold' : 'text-coral'}>{level === 'ok' ? 'okay' : level}</b>, and it comes back for revision in {gap} day{gap === 1 ? '' : 's'}.
            </p>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" onClick={start}>
                <Refresh /> Another quiz
              </Button>
              <Button variant="primary" onClick={close}>
                Done
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {state.phase === 'asking' && <p className="mt-6 text-[0.72rem] text-muted">Questions are written by AI from your syllabus and checked by a second AI model. If one looks wrong, trust your textbook.</p>}
    </Drawer>
  )
}

// Pick the topics an exam quiz should cover: ticked ones you're least sure of.
export function quizTopicsForExam(data, exam, examTopics) {
  const rank = (t) => (t.confidence === 'shaky' ? 0 : !t.confidence ? 1 : t.confidence === 'ok' ? 2 : 3) * 1000 + (t.quiz?.attempts || 0)
  const ticked = examTopics(data, exam).filter((t) => t.done)
  const pool = ticked.length ? ticked : examTopics(data, exam)
  return [...pool].sort((a, b) => rank(a) - rank(b)).slice(0, 2).map((t) => t.id)
}
