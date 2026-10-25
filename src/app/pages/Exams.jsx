import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarClock, ChevronDown, GraduationCap, MapPin, Pencil, Plus, Target, Trophy } from '../../components/icons.jsx'
import SplitFlapText from '../../components/rb/SplitFlapText/SplitFlapText.jsx'
import SpringCheck from '../../components/rb/SpringCheck/SpringCheck.jsx'
import { Badge, Button, Card, Count, Empty, PageHeader, ProgressBar, Ring, SubjectTag, useToast } from '../../components/ui.jsx'
import { checkProps, sparkFromFocus } from '../../components/blocks.jsx'
import { YuukiPose } from '../../yuuki/Yuuki.jsx'
import { colorOf, useStore } from '../../lib/store.js'
import { useUI } from '../../lib/ui.js'
import { examReadiness, pastExams, upcomingExams } from '../../lib/selectors.js'
import { examConfidence } from '../../lib/planner/revision.js'
import { examTopics } from '../../lib/selectors.js'
import { openQuiz } from '../../lib/ui.js'
import { quizTopicsForExam } from '../../components/quiz.jsx'
import { daysBetween, formatTime, fullDate, shortDate, todayISO } from '../../lib/dates.js'

function readinessTone(pct, days) {
  if (pct >= 80) return { tone: 'good', label: 'Well prepared' }
  if (days <= 3 && pct < 50) return { tone: 'bad', label: 'Needs urgent revision' }
  if (pct < 50) return { tone: 'warn', label: 'Keep going' }
  return { tone: 'primary', label: 'Getting there' }
}

function Hero({ exam, data }) {
  const today = todayISO()
  const toggle = useStore((s) => s.toggleTopic)
  const openEditor = useUI((s) => s.openEditor)
  const toast = useToast()
  const subject = data.subjects.find((s) => s.id === exam.subjectId)
  const color = colorOf(subject?.color)
  const days = daysBetween(today, exam.date)
  const r = examReadiness(data, exam)
  const conf = examConfidence(data, exam)
  const quizzed = examTopics(data, exam).filter((t) => t.quiz)
  const quizAvg = quizzed.length ? Math.round(quizzed.reduce((n, t) => n + t.quiz.last, 0) / quizzed.length) : null
  const units = data.units.filter((u) => exam.unitIds?.includes(u.id))
  const flap = days === 0 ? 'TODAY' : `${String(days).padStart(2, '0')} DAY${days === 1 ? '' : 'S'}`
  const status = readinessTone(r.pct, days)
  return (
    <Card accent={color} className="dots relative mb-6 overflow-hidden">
      <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="bad" dot>
              Next exam
            </Badge>
            <SubjectTag subjectId={exam.subjectId} />
            <Badge>{exam.type}</Badge>
          </div>
          <h2 className="mt-4 text-3xl font-bold text-ink sm:text-4xl">{exam.title}</h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <CalendarClock className="size-4" /> {fullDate(exam.date)}
              {exam.time && `, ${formatTime(exam.time)}`}
            </span>
            {exam.venue && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" /> {exam.venue}
              </span>
            )}
          </p>
          <div className="mt-6">
            <SplitFlapText text={flap} padTo={flap.length} loop={false} fontSize={54} tileColor="#161616" textColor="#fff4e6" tileRadius={9} gap={5} flipsPerChar={7} />
          </div>
          <div className="mt-6 flex items-center gap-5">
            <Ring value={r.pct} size={96} stroke={10} color={color}>
              <span className="num font-display text-xl font-bold text-ink">
                <Count value={r.pct} />%
              </span>
            </Ring>
            <div>
              <Badge tone={status.tone}>{status.label}</Badge>
              <p className="mt-2 text-sm text-ink-2">
                <b className="text-ink">{r.done}</b> of {r.total} topics covered
                {units.length > 0 && ` across ${units.length} unit${units.length === 1 ? '' : 's'}`}.
              </p>
              {quizAvg != null && (
                <p className="mt-1 text-[0.8rem] text-ink-2">
                  Quizzed on {quizzed.length} topic{quizzed.length === 1 ? '' : 's'}, averaging <b className={quizAvg >= 80 ? 'text-mint' : quizAvg >= 50 ? 'text-gold' : 'text-coral'}>{quizAvg}%</b>.
                </p>
              )}
              {conf.shaky > 0 && (
                <p className="mt-1 text-[0.8rem] text-coral">
                  {conf.shaky} of them marked shaky: they'll come up in Revise today.
                </p>
              )}
              <div className="mt-1 -ml-3 flex flex-wrap gap-1">
                <Button variant="ghost" size="sm" onClick={() => openQuiz(quizTopicsForExam(data, exam, examTopics), exam.title)} disabled={!r.total}>
                  <Target /> Quiz me
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openEditor('exam', exam)}>
                  <Pencil /> Edit exam
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h3 className="flex items-center justify-between text-sm font-bold text-ink">
            Still to cover
            <span className="num text-[0.78rem] font-semibold text-muted">{r.left.length} left</span>
          </h3>
          {r.total === 0 ? (
            <p className="mt-3 text-sm text-muted">
              This exam has no topics yet. <Link to={`/app/subjects/${exam.subjectId}`} className="font-semibold text-primary underline-offset-2 hover:underline">Add the syllabus</Link> to track readiness.
            </p>
          ) : r.left.length === 0 ? (
            <div className="mt-4 flex flex-col items-center text-center">
              <YuukiPose name="jump" className="w-24" />
              <p className="mt-2 font-semibold text-ink">Every topic covered.</p>
              <p className="text-sm text-muted">Spend the remaining days on past papers and revision.</p>
            </div>
          ) : (
            <ul className="mt-3 max-h-80 space-y-0.5 overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {r.left.map((t) => (
                  <motion.li key={t.id} layout exit={{ opacity: 0, height: 0 }} className="rounded-lg px-1 hover:bg-surface-2">
                    <SpringCheck
                      label={t.title}
                      defaultChecked={false}
                      onChange={() => {
                        sparkFromFocus(color)
                        setTimeout(() => {
                          toggle(t.id)
                          toast('Topic covered', { description: t.title })
                        }, 450)
                      }}
                      className="topic-check"
                      {...checkProps}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </div>
    </Card>
  )
}

function ExamCard({ exam, data, index }) {
  const openEditor = useUI((s) => s.openEditor)
  const today = todayISO()
  const subject = data.subjects.find((s) => s.id === exam.subjectId)
  const color = colorOf(subject?.color)
  const days = daysBetween(today, exam.date)
  const r = examReadiness(data, exam)
  const status = readinessTone(r.pct, days)
  const units = data.units.filter((u) => exam.unitIds?.includes(u.id))
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06, ease: [0.16, 1, 0.3, 1], duration: 0.5 }} className="tint h-full" style={{ '--accent': color }}>
      <div className="lift h-full rounded-[1.25rem] border border-line bg-surface">
        <button onClick={() => openEditor('exam', exam)} className="flex h-full w-full flex-col p-5 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid w-14 shrink-0 place-items-center rounded-2xl border py-2" style={{ color, borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}>
                <span className="num font-display text-xl leading-none font-bold">{exam.date.slice(8)}</span>
                <span className="text-[0.65rem] font-semibold uppercase">{shortDate(exam.date).split(' ')[1]}</span>
              </span>
              <div className="min-w-0">
                <p className="truncate text-[0.78rem] font-semibold" style={{ color }}>
                  {subject?.name}
                </p>
                <p className="font-display text-lg leading-tight font-bold text-ink">{exam.title}</p>
              </div>
            </div>
            <Ring value={r.pct} size={54} stroke={6} color={color}>
              <span className="num text-[0.75rem] font-bold text-ink">{r.pct}%</span>
            </Ring>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone={days <= 3 ? 'bad' : days <= 7 ? 'warn' : 'neutral'} dot={days <= 3}>
              {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`}
            </Badge>
            <Badge>{exam.type}</Badge>
            {exam.time && <Badge>{formatTime(exam.time)}</Badge>}
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <div className="mt-4">
            <ProgressBar value={r.pct} color={color} height={7} delay={0.2 + index * 0.05} />
            <p className="mt-2 text-[0.78rem] text-muted">
              {r.done}/{r.total} topics · {units.length ? units.map((u) => u.title).join(', ') : 'Whole subject'}
            </p>
          </div>
        </button>
      </div>
    </motion.div>
  )
}

export default function Exams() {
  const data = useStore()
  const openEditor = useUI((s) => s.openEditor)
  const [showPast, setShowPast] = useState(false)
  const upcoming = upcomingExams(data)
  const past = pastExams(data)
  const [next, ...rest] = upcoming

  return (
    <>
      <PageHeader
        eyebrowIcon={GraduationCap}
        title="Exams"
        sub="Countdowns, plus how much of each exam’s syllabus you’ve covered."
        actions={
          <Button variant="primary" data-tour="add-exam" onClick={() => openEditor('exam')}>
            <Plus /> New exam
          </Button>
        }
      />
      {!next ? (
        <Empty
          pose="worried"
          title="No upcoming exams"
          text="Add your quizzes, internals and semester exams. Pick the units each one covers to see your readiness."
          action={
            <Button variant="primary" size="sm" onClick={() => openEditor('exam')}>
              <Plus /> Add an exam
            </Button>
          }
        />
      ) : (
        <>
          <Hero exam={next} data={data} />
          {rest.length > 0 && (
            <>
              <h2 className="mb-3 font-display text-xl font-bold text-ink">Later this term</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {rest.map((e, i) => (
                  <ExamCard key={e.id} exam={e} data={data} index={i} />
                ))}
              </div>
            </>
          )}
        </>
      )}
      {past.length > 0 && (
        <div className="mt-8">
          <button onClick={() => setShowPast(!showPast)} className="flex min-h-10 items-center gap-2 text-sm font-semibold text-ink-2 hover:text-ink" aria-expanded={showPast}>
            <motion.span animate={{ rotate: showPast ? 180 : 0 }}>
              <ChevronDown className="size-4" />
            </motion.span>
            Past exams ({past.length})
          </button>
          <AnimatePresence>
            {showPast && (
              <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-3 overflow-hidden">
                {past.map((e) => (
                  <li key={e.id}>
                    <button onClick={() => openEditor('exam', e)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-2">
                      <span className="num w-16 font-mono text-[0.78rem] text-muted">{shortDate(e.date)}</span>
                      <SubjectTag subjectId={e.subjectId} short />
                      <span className="flex-1 truncate text-sm font-medium text-ink-2">{e.title}</span>
                      <span className="num text-[0.78rem] text-muted">{examReadiness(data, e).pct}% covered</span>
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}
    </>
  )
}

