import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { AlarmClock, AlertTriangle, ArrowUpRight, BookOpenCheck, CalendarClock, Flame, GraduationCap, ListTodo, MapPin, Play, Plus, Target } from '../../components/icons.jsx'
import SplitFlapText from '../../components/rb/SplitFlapText/SplitFlapText.jsx'
import { Badge, Button, Card, CardHeader, Count, Duration, Empty, ProgressBar, Ring, Stagger, SubjectTag, cn } from '../../components/ui.jsx'
import { BlockRow } from '../../components/blocks.jsx'
import { DayBars } from '../../components/charts.jsx'
import { colorOf, useStore } from '../../lib/store.js'
import { useUI } from '../../lib/ui.js'
import { analyzeRisks } from '../../lib/planner/risks.js'
import {
  agenda,
  blocksOn,
  examReadiness,
  minutesOn,
  nextPriority,
  overallProgress,
  streak,
  subjectProgress,
  subjectStatus,
  upcomingExams,
  weekMinutes,
} from '../../lib/selectors.js'
import { daysBetween, formatMinutes, formatTime, fullDate, greeting, relativeDays, shortDate, todayISO } from '../../lib/dates.js'

function Hero({ data }) {
  const today = todayISO()
  const studied = minutesOn(data, today)
  const goal = data.prefs.dailyGoal || 180
  const todays = blocksOn(data, today)
  const doneBlocks = todays.filter((b) => b.done).length
  const days = streak(data, today)
  const overall = overallProgress(data)
  const dueWeek = agenda(data, 7, today).filter((i) => i.kind === 'assignment').length
  const name = data.profile.name?.split(' ')[0]

  // Each number keeps the colour of the section it comes from.
  const stats = [
    { icon: Flame, label: 'Day streak', value: <Count value={days} />, color: 'var(--orange)' },
    { icon: BookOpenCheck, label: 'Syllabus done', value: <><Count value={overall.pct} />%</>, color: 'var(--gold)' },
    { icon: ListTodo, label: 'Due this week', value: <Count value={dueWeek} />, color: 'var(--coral)' },
  ]
  const words = `${greeting()}${name ? `, ${name}` : ''}.`.split(' ')

  return (
    <Card className="dots relative overflow-hidden p-6 sm:p-7 lg:col-span-8">
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted">{[data.profile.semester, data.profile.course].filter(Boolean).join(', ') || fullDate(today)}</p>
          <h1 className="mt-1 text-[2rem] leading-tight font-bold text-ink sm:text-[2.5rem]">
            {words.map((w, i) => (
              <span key={i} className="inline-block overflow-hidden pb-1 align-bottom">
                <motion.span className="inline-block" initial={{ y: '105%' }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}>
                  {w}
                  {i < words.length - 1 ? '\u00a0' : ''}
                </motion.span>
              </span>
            ))}
          </h1>
          <p className="mt-2 text-[0.95rem] text-ink-2">
            {todays.length ? (
              <>
                <b className="text-ink">
                  {doneBlocks} of {todays.length}
                </b>{' '}
                study blocks done today, <b className="text-ink">{formatMinutes(studied)}</b> focused so far.
              </>
            ) : studied ? (
              <>
                <b className="text-ink">{formatMinutes(studied)}</b> studied today. Plan a few blocks to stay on track.
              </>
            ) : (
              'Nothing planned for today yet. Plan a block or start a focus session.'
            )}
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.08 }}
                className="draw lift rounded-2xl border border-line bg-surface p-3"
                style={{ '--accent': s.color }}
              >
                <s.icon className="size-5" style={{ color: s.color }} />
                <p className="num mt-2 font-display text-xl font-bold text-ink sm:text-2xl">{s.value}</p>
                <p className="text-[0.72rem] text-muted sm:text-[0.78rem]">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center">
          <Ring value={(studied / goal) * 100} size={168} stroke={12} color="var(--lime)">
            <div className="text-center">
              <Duration minutes={studied} className="font-display text-[1.7rem] font-bold text-ink" />
              <p className="text-[0.72rem] text-muted">of {formatMinutes(goal)} goal</p>
            </div>
          </Ring>
          <p className="mt-2 flex items-center gap-1.5 text-[0.78rem] font-semibold text-ink-2">
            <Target className="size-3.5 text-lime" /> Today’s study goal
          </p>
        </div>
      </div>
    </Card>
  )
}

function ExamCountdown({ data }) {
  const today = todayISO()
  const exam = upcomingExams(data, today)[0]
  const openEditor = useUI((s) => s.openEditor)
  if (!exam) {
    return (
      <Card accent="var(--rose)" className="p-6 lg:col-span-4">
        <CardHeader title="Next exam" icon={GraduationCap} />
        <Empty compact pose="worried" className="mt-4" title="No exams yet" text="Add your quiz and exam dates to see a countdown and how ready you are." action={<Button variant="primary" size="sm" onClick={() => openEditor('exam')}><Plus /> Add exam</Button>} />
      </Card>
    )
  }
  const days = daysBetween(today, exam.date)
  const r = examReadiness(data, exam)
  const subject = data.subjects.find((s) => s.id === exam.subjectId)
  const urgent = days <= 3
  const flap = days === 0 ? 'TODAY' : `${String(days).padStart(2, '0')} DAY${days === 1 ? '' : 'S'}`
  return (
    <Card accent="var(--rose)" className={cn('relative flex flex-col overflow-hidden p-6 lg:col-span-4', urgent && 'border-[color-mix(in_srgb,var(--rose)_45%,transparent)]')}>
      <div className="relative flex items-center justify-between">
        <h2 className="draw flex items-center gap-2 text-[1.05rem] font-semibold text-ink">
          <AlarmClock className="size-[1.15rem] text-rose" />
          Next exam
        </h2>
        <Badge tone={urgent ? 'bad' : 'neutral'} dot={urgent}>
          {exam.type}
        </Badge>
      </div>
      <div className="relative mt-5">
        <SplitFlapText text={flap} padTo={flap.length} loop={false} fontSize={34} tileColor="#161616" textColor="#fff4e6" tileRadius={7} gap={4} flipsPerChar={6} stagger={0.05} />
      </div>
      <div className="relative mt-5 min-w-0">
        <SubjectTag subjectId={exam.subjectId} />
        <p className="mt-2 truncate font-display text-lg font-bold text-ink">{exam.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem] text-muted">
          <span className="flex items-center gap-1">
            <CalendarClock className="size-3.5" /> {shortDate(exam.date)}
            {exam.time && `, ${formatTime(exam.time)}`}
          </span>
          {exam.venue && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" /> {exam.venue}
            </span>
          )}
        </p>
      </div>
      <div className="relative mt-auto pt-5">
        <div className="mb-1.5 flex items-baseline justify-between text-[0.8rem]">
          <span className="font-semibold text-ink-2">Syllabus ready</span>
          <span className="num font-bold text-ink">
            <Count value={r.pct} />%
          </span>
        </div>
        <ProgressBar value={r.pct} color={colorOf(subject?.color)} height={9} />
        <Link to="/app/exams" className="draw mt-3 inline-flex items-center gap-1 text-[0.8rem] font-semibold text-rose hover:underline">
          {r.left.length ? `${r.left.length} topic${r.left.length === 1 ? '' : 's'} left to cover` : 'All topics covered'}
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </Card>
  )
}

function UpNext({ data }) {
  const p = nextPriority(data)
  const timer = useStore((s) => s.timer)
  const start = useStore((s) => s.startTimer)
  const setFocusOpen = useUI((s) => s.setFocusOpen)
  const openEditor = useUI((s) => s.openEditor)
  if (!p) return null
  const reason =
    p.kind === 'block'
      ? `Planned for ${formatTime(p.block.start)}, ${formatMinutes(p.block.minutes)}.`
      : p.kind === 'assignment'
        ? `${p.assignment.due < todayISO() ? 'Overdue' : 'Due'} ${relativeDays(p.assignment.due)}.`
        : `Not covered yet, and it’s in your ${p.exam.type.toLowerCase()} ${relativeDays(p.exam.date)}.`
  const minutes = p.kind === 'block' ? p.block.minutes : p.kind === 'assignment' ? Math.min(90, p.assignment.estimate || 45) : 45
  const color = colorOf(data.subjects.find((s) => s.id === p.subjectId)?.color)
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="relative overflow-hidden rounded-2xl p-[1.5px]"
      style={{ background: color }}
    >
      <div className="relative rounded-[15px] bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[0.75rem] font-bold tracking-wide" style={{ color }}>
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60" style={{ background: color }} />
                <span className="relative inline-flex size-2 rounded-full" style={{ background: color }} />
              </span>
              Up next
            </p>
            <h3 className="mt-1.5 text-xl font-bold text-ink sm:text-2xl">{p.title}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
              <SubjectTag subjectId={p.subjectId} />
              <span>{reason}</span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {p.kind === 'assignment' && (
              <Button variant="outline" onClick={() => openEditor('assignment', p.assignment)}>
                Open
              </Button>
            )}
            {!timer && (
              <Button
                variant="primary"
                onClick={() => {
                  start({ subjectId: p.subjectId, blockId: p.kind === 'block' ? p.block.id : null, title: p.title, planned: minutes })
                  setFocusOpen(true)
                }}
              >
                <Play /> Start {formatMinutes(minutes)} focus
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function TodayPlan({ data }) {
  const today = todayISO()
  const todays = blocksOn(data, today)
  const openEditor = useUI((s) => s.openEditor)
  const done = todays.filter((b) => b.done).length
  return (
    <Card accent="var(--lime)" className="p-5 sm:p-6 lg:col-span-8">
      <CardHeader
        title="Today’s study plan"
        icon={ListTodo}
        sub={todays.length ? `${done} of ${todays.length} done` : 'No blocks planned for today'}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => openEditor('block', null, { date: today })}>
              <Plus /> Add block
            </Button>
            <Link to="/app/today">
              <Button variant="outline" size="sm">
                Open Today
              </Button>
            </Link>
          </div>
        }
      />
      {todays.length > 0 && (
        <div className="mt-4 flex gap-1.5">
          {todays.map((b) => (
            <motion.span key={b.id} className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
              <motion.span className="block h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: b.done ? '100%' : 0 }} transition={{ duration: 0.6 }} />
            </motion.span>
          ))}
        </div>
      )}
      <div className="mt-4 space-y-4">
        <UpNext data={data} />
        {todays.length > 0 ? (
          <ul className="space-y-2">
            {todays.map((b, i) => (
              <BlockRow key={b.id} block={b} index={i} />
            ))}
          </ul>
        ) : (
          <Empty compact pose="clipboard" title="A blank day" text="Plan what you’ll study and when. Each block becomes a one-tap focus session." action={<Button variant="primary" size="sm" onClick={() => openEditor('block', null, { date: today })}><Plus /> Plan a block</Button>} />
        )}
      </div>
    </Card>
  )
}

function Deadlines({ data }) {
  const today = todayISO()
  const items = agenda(data, 14, today)
  const late = data.assignments.filter((a) => a.status !== 'done' && a.due < today)
  const openEditor = useUI((s) => s.openEditor)
  const all = [...late.map((a) => ({ kind: 'assignment', id: a.id, date: a.due, title: a.title, subjectId: a.subjectId, ref: a, late: true })), ...items]
  return (
    <Card accent="var(--coral)" className="p-5 sm:p-6 lg:col-span-4">
      <CardHeader title="Coming up" icon={CalendarClock} sub="Next 14 days" action={<Link to="/app/calendar" className="tap text-[0.8rem] font-semibold text-coral hover:underline">Calendar</Link>} />
      {all.length === 0 ? (
        <Empty compact pose="read" className="mt-4" title="All clear" text="No exams or assignments in the next two weeks." />
      ) : (
        <ul className="mt-4 space-y-1">
          {all.slice(0, 8).map((it, i) => {
            const d = daysBetween(today, it.date)
            return (
              <motion.li key={`${it.kind}-${it.id}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.05 }}>
                <button
                  onClick={() => openEditor(it.kind, it.ref)}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-surface-2"
                >
                  <span
                    className={cn(
                      'grid w-11 shrink-0 place-items-center rounded-xl py-1 text-center',
                      it.late ? 'bg-danger-soft text-danger' : it.kind === 'exam' ? 'border border-rose/50 text-rose' : 'bg-surface-2 text-ink',
                    )}
                  >
                    <span className="num font-display text-base leading-none font-bold">{it.date.slice(8)}</span>
                    <span className="text-[0.6rem] font-semibold uppercase">{shortDate(it.date).split(' ')[1]}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{it.kind === 'exam' ? `${data.subjects.find((s) => s.id === it.subjectId)?.code || ''} ${it.title}`.trim() : it.title}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-[0.75rem] text-muted">
                      {it.kind === 'exam' ? 'Exam' : 'Assignment'}
                      <span className={cn('font-semibold', it.late || d <= 1 ? 'text-danger' : d <= 3 ? 'text-warning' : '')}>
                        {it.late ? `${-d}d overdue` : d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `in ${d} days`}
                      </span>
                    </span>
                  </span>
                  <span className="size-2 shrink-0 rounded-full" style={{ background: colorOf(data.subjects.find((s) => s.id === it.subjectId)?.color) }} />
                </button>
              </motion.li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function SyllabusHealth({ data }) {
  return (
    <Card accent="var(--gold)" className="p-5 sm:p-6 lg:col-span-7">
      <CardHeader title="Syllabus progress" icon={BookOpenCheck} sub="Topics ticked off per subject" action={<Link to="/app/subjects" className="tap text-[0.8rem] font-semibold text-gold hover:underline">All subjects</Link>} />
      {data.subjects.length === 0 ? (
        <Empty compact pose="hug" className="mt-4" title="No subjects yet" text="Add your subjects and their units to track the syllabus." action={<Link to="/app/subjects"><Button variant="primary" size="sm"><Plus /> Add a subject</Button></Link>} />
      ) : (
        <ul className="mt-5 space-y-4">
          {data.subjects.map((s, i) => {
            const p = subjectProgress(data, s.id)
            const st = subjectStatus(data, s.id)
            return (
              <li key={s.id}>
                <Link to={`/app/subjects/${s.id}`} className="group block">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorOf(s.color) }} />
                      <span className="truncate text-sm font-semibold text-ink transition-colors group-hover:text-[var(--c)]" style={{ '--c': colorOf(s.color) }}>{s.name}</span>
                      {st.exam && <Badge tone={st.tone}>{st.label}</Badge>}
                    </span>
                    <span className="num shrink-0 text-[0.8rem] text-muted">
                      <b className="text-ink">{p.pct}%</b> · {p.done}/{p.total}
                    </span>
                  </div>
                  <ProgressBar value={p.pct} color={colorOf(s.color)} delay={i * 0.08} />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function ThisWeek({ data }) {
  const days = weekMinutes(data)
  const total = days.reduce((s, d) => s + d.minutes, 0)
  return (
    <Card accent="var(--mint)" className="p-5 sm:p-6 lg:col-span-5">
      <CardHeader
        title="This week"
        icon={Flame}
        sub="Studied against planned, per day"
        action={<Duration minutes={total} className="font-display text-xl font-bold text-ink" />}
      />
      <div className="mt-6">
        <DayBars days={days} />
      </div>
    </Card>
  )
}

// The most serious risks from the risk radar, with a way into Mission Planner.
function HeadsUp({ data }) {
  const risks = analyzeRisks(data, { today: todayISO() }).filter((r) => r.level !== 'low').slice(0, 3)
  if (!risks.length) return null
  return (
    <Card accent="var(--coral)" className="p-4 sm:px-6 lg:col-span-12">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
        <p className="flex items-center gap-2 font-display font-bold text-ink">
          <AlertTriangle className="size-4 text-[var(--accent)]" /> Heads up
        </p>
        <ul className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm text-ink-2 sm:flex-row sm:flex-wrap sm:gap-x-5">
          {risks.map((r) => (
            <li key={r.id} className="flex min-w-0 items-center gap-2" title={r.reason}>
              <span className={cn('size-2 shrink-0 rounded-full', r.level === 'high' ? 'bg-danger' : 'bg-warning')} />
              <span className="truncate">{r.title}</span>
            </li>
          ))}
        </ul>
        <Link to="/app/missions" className="tap inline-flex items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink">
          Plan around it <ArrowUpRight className="size-4" />
        </Link>
      </div>
    </Card>
  )
}

export default function Overview() {
  const data = useStore()
  return (
    <Stagger className="grid grid-cols-1 gap-5 lg:grid-cols-12" gap={0.07}>
      <Hero data={data} />
      <HeadsUp data={data} />
      <ExamCountdown data={data} />
      <TodayPlan data={data} />
      <Deadlines data={data} />
      <SyllabusHealth data={data} />
      <ThisWeek data={data} />
    </Stagger>
  )
}
