import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react'
import { ArrowRight, BarChart3, BookOpenCheck, CalendarRange, ClipboardList, GraduationCap, Lock, MessageCircle, Plug, Server, Timer } from '../components/icons.jsx'
import RotatingText from '../components/rb/RotatingText/RotatingText.jsx'
import SplitFlapText from '../components/rb/SplitFlapText/SplitFlapText.jsx'
import SpringCheck from '../components/rb/SpringCheck/SpringCheck.jsx'
import Counter from '../components/rb/Counter/Counter.jsx'
import ScrollVelocity from '../components/rb/ScrollVelocity/ScrollVelocity.jsx'
import { ProgressBar, Ring, cn } from '../components/ui.jsx'
import { DayBars, Heatmap } from '../components/charts.jsx'
import Logo from '../components/Logo.jsx'
import { Typewriter, YuukiPose } from '../yuuki/Yuuki.jsx'
import { pose } from '../yuuki/poses.js'
import { addDays, todayISO, weekDays, weekStart } from '../lib/dates.js'

// Same black canvas and colour set as the app. No single colour leads.
const C = {
  gold: '#facc15',
  rose: '#ff4d8d',
  mint: '#34d399',
  coral: '#ff6b5b',
  teal: '#2dd4bf',
  lime: '#a3e635',
  orange: '#ff9f43',
  peach: '#ffb38a',
}

const checkStyle = { color: '#f5f3ef', checkColor: '#000000', boxSize: 20, boxRadius: 6, fontSize: 14 }

/* ---------- Hand-drawn doodles that draw themselves ---------- */
function Doodle({ d, color, className, delay = 0, width = 2, viewBox = '0 0 100 100', stretch = false }) {
  const reduce = useReducedMotion()
  return (
    <svg viewBox={viewBox} preserveAspectRatio={stretch ? 'none' : undefined} className={cn('pointer-events-none absolute overflow-visible', className)} fill="none" aria-hidden="true">
      <motion.path
        d={d}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={reduce ? false : { pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ pathLength: { duration: 1.2, delay, ease: [0.65, 0, 0.35, 1] }, opacity: { duration: 0.2, delay } }}
      />
    </svg>
  )
}

const DOODLES = {
  arrow: 'M8 20c18-14 50-16 66 4 9 11 9 26-2 34M62 50l10 9 11-11',
  star: 'M50 8l10 28 30 2-23 19 8 29-25-17-25 17 8-29-23-19 30-2z',
  plane: 'M10 50l80-36-30 74-12-28-38-10zM48 60l42-46',
  squiggle: 'M5 50c10-20 20 20 30 0s20 20 30 0 20 20 30 0',
  circle: 'M50 10c26-2 42 16 40 38s-22 40-46 38S6 66 8 44 26 12 54 12',
  spark: 'M50 6v22M50 72v22M6 50h22M72 50h22M20 20l14 14M66 66l14 14M80 20 66 34M34 66 20 80',
  pencil: 'M14 86l8-26 50-50 18 18-50 50-26 8zM62 20l18 18',
}

/* ---------- Live pieces ---------- */
function LiveClock({ start = 1471, size = 40 }) {
  const reduce = useReducedMotion()
  const [s, setS] = useState(start)
  useEffect(() => {
    if (reduce) return
    const id = setInterval(() => setS((x) => x + 1), 1000)
    return () => clearInterval(id)
  }, [reduce])
  const common = { fontSize: size, gap: 0, horizontalPadding: 0, borderRadius: 0, fontWeight: 700, gradientHeight: 0, gradientFrom: 'transparent' }
  return (
    <span className="inline-flex items-center font-mono text-white" aria-label="Focus timer running">
      <Counter value={Math.floor(s / 60)} places={[10, 1]} {...common} />
      <span className="px-0.5 pb-[0.1em] opacity-40" style={{ fontSize: size * 0.8 }}>
        :
      </span>
      <Counter value={s % 60} places={[10, 1]} {...common} />
    </span>
  )
}

function TopicList({ color, items, start = 1 }) {
  const [done, setDone] = useState(() => items.map((_, i) => i < start))
  const pct = Math.round((done.filter(Boolean).length / items.length) * 100)
  return (
    <div style={{ '--accent': color }}>
      <div className="mb-3 flex items-center gap-3">
        <ProgressBar value={pct} color={color} height={6} className="flex-1" />
        <span className="num text-[0.75rem] font-semibold text-white/70">{pct}%</span>
      </div>
      <ul className="space-y-0.5">
        {items.map((t, i) => (
          <li key={t}>
            <SpringCheck label={t} defaultChecked={done[i]} onChange={(on) => setDone((d) => d.map((x, j) => (j === i ? on : x)))} fillColor={color} className="topic-check" {...checkStyle} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------- Hero ---------- */
const ROTATE = [
  { text: 'syllabus topic.', color: C.gold },
  { text: 'exam date.', color: C.rose },
  { text: 'assignment.', color: C.coral },
  { text: 'study hour.', color: C.lime },
]

function Float({ children, delay = 0, className, from = 30 }) {
  const reduce = useReducedMotion()
  return (
    <motion.div initial={{ opacity: 0, y: from }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className={className}>
      <motion.div animate={reduce ? undefined : { y: [0, -7, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: delay + 1 }}>
        {children}
      </motion.div>
    </motion.div>
  )
}

function HeroStage() {
  return (
    <div className="relative mx-auto h-[560px] w-full max-w-[560px]">
      <Doodle d={DOODLES.circle} color={C.teal} className="top-[18%] left-[22%] size-[62%] opacity-50" delay={0.9} width={1.5} />
      <Doodle d={DOODLES.spark} color={C.gold} className="top-[4%] right-[12%] size-12" delay={1.3} />
      <Doodle d={DOODLES.plane} color={C.mint} className="bottom-[30%] left-0 size-14" delay={1.5} />

      <div className="absolute bottom-0 left-1/2 w-[54%] -translate-x-1/2">
        <YuukiPose name="wave" alt="Yuuki, the StudySync companion" className="w-full drop-shadow-[0_30px_50px_rgba(0,0,0,0.9)]" />
      </div>

      <Float delay={0.6} className="absolute top-0 left-0 w-[58%]">
        <div className="relative rounded-2xl border border-white/12 bg-[#0d0d0d] p-4">
          <span className="bubble-tail" style={{ left: '70%', bottom: -8, borderLeft: 'none', borderTop: 'none', background: '#0d0d0d', borderColor: 'rgb(255 255 255 / 0.12)' }} />
          <p className="mb-1 text-[0.7rem] font-bold text-mint">Yuuki</p>
          <p className="min-h-[4.2em] text-[0.88rem] leading-relaxed text-white/85">
            <Typewriter text="Hi! I keep your syllabus, exams, assignments and study hours in one place. And I cheer, loudly." speed={22} />
          </p>
        </div>
      </Float>

      <Float delay={0.9} className="absolute top-[30%] right-0 w-[46%]">
        <div className="rounded-2xl border border-white/12 bg-[#0d0d0d] p-4" style={{ '--accent': C.rose }}>
          <p className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-white/60">
            <GraduationCap className="size-4" style={{ color: C.rose }} /> DBMS Quiz 2
          </p>
          <div className="mt-2.5">
            <SplitFlapText text="03 DAYS" padTo={7} loop={false} fontSize={22} tileColor="#1a1a1a" textColor="#fff4e6" tileRadius={5} gap={3} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <ProgressBar value={67} color={C.rose} height={5} className="flex-1" delay={1} />
            <span className="num text-[0.7rem] text-white/60">67%</span>
          </div>
        </div>
      </Float>

      <Float delay={1.15} className="absolute bottom-[14%] left-0 w-[40%]">
        <div className="flex items-center gap-3 rounded-2xl border border-white/12 bg-[#0d0d0d] p-3">
          <Ring value={55} size={44} stroke={4} color={C.lime} track="rgb(255 255 255 / 0.1)">
            <Timer className="size-4" style={{ color: C.lime }} />
          </Ring>
          <div>
            <p className="text-[0.65rem] text-white/50">Focusing</p>
            <LiveClock size={22} />
          </div>
        </div>
      </Float>

      <Float delay={1.35} className="absolute right-[2%] bottom-[6%]">
        <span className="flex items-center gap-2 rounded-xl border px-3 py-2 font-display text-sm font-bold" style={{ color: C.orange, borderColor: `${C.orange}66` }}>
          6 day streak
        </span>
      </Float>
    </div>
  )
}

function Hero() {
  const reduce = useReducedMotion()
  const [i, setI] = useState(0)
  return (
    <section className="relative isolate overflow-hidden">
      <div className="dots pointer-events-none absolute inset-0 -z-10 opacity-60 [mask-image:linear-gradient(to_bottom,black_50%,transparent)]" />
      <nav className="relative z-10 mx-auto flex h-18 max-w-7xl items-center gap-6 px-5 sm:px-8">
        <Logo />
        <div className="ml-auto hidden items-center gap-7 text-sm font-medium text-white/70 md:flex">
          <a href="#features" className="transition-colors hover:text-white">
            Features
          </a>
          <a href="#yuuki" className="transition-colors hover:text-white">
            Meet Yuuki
          </a>
          <a href="#how" className="transition-colors hover:text-white">
            How it works
          </a>
        </div>
        <Link to="/login" className="draw ml-auto inline-flex h-10 items-center gap-2 rounded-xl bg-[#f5f3ef] px-4 text-sm font-bold text-black transition-colors hover:bg-white md:ml-0">
          Log in <ArrowRight className="size-4" />
        </Link>
      </nav>

      <div className="mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-7xl items-center gap-6 px-5 pt-6 pb-16 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-10">
        <div className="relative z-10">
          <h1 className="font-display text-[2.9rem] leading-[1.02] font-bold tracking-tight text-white sm:text-6xl lg:text-[4.4rem]">
            <motion.span initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="relative block">
              Track every
              <Doodle stretch d={DOODLES.squiggle} color={C.gold} viewBox="0 30 100 40" className="-bottom-2 left-1 h-3 w-[min(19rem,62%)]" delay={0.8} width={2.5} />
            </motion.span>
            <motion.span className="block pb-2" animate={{ color: ROTATE[i].color }} transition={{ duration: 0.4 }} style={{ color: ROTATE[0].color }}>
              <RotatingText texts={ROTATE.map((r) => r.text)} auto={!reduce} rotationInterval={2400} staggerDuration={0.02} staggerFrom="first" splitBy="characters" mainClassName="overflow-hidden" onNext={setI} />
            </motion.span>
          </h1>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.6 }} className="mt-6 max-w-[34rem] text-lg leading-relaxed text-white/65">
            StudySync keeps every subject's syllabus, your exams, assignments and study time in one place, with Yuuki, a study buddy who shows you around and cheers you on.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="mt-9 flex flex-wrap items-center gap-3">
            <Link to="/login" className="draw inline-flex h-13 items-center gap-2 rounded-2xl bg-[#f5f3ef] px-7 text-base font-bold text-black transition-colors hover:bg-white">
              Log in <ArrowRight className="size-5" />
            </Link>
            <a href="#how" className="inline-flex h-13 items-center rounded-2xl border border-white/15 px-6 text-base font-semibold text-white/85 transition-colors hover:border-white/35 hover:text-white">
              See how it works
            </a>
          </motion.div>
          <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/55">
            {[
              ['Syllabus', C.gold],
              ['Exams', C.rose],
              ['Assignments', C.coral],
              ['Study time', C.lime],
            ].map(([t, c]) => (
              <li key={t} className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: c }} />
                {t}
              </li>
            ))}
          </motion.ul>
        </div>
        <HeroStage />
      </div>
    </section>
  )
}

/* ---------- Marquee (the only one on the page) ---------- */
const SUBJECTS = [
  ['Operating Systems', C.gold],
  ['Organic Chemistry', C.lime],
  ['Thermodynamics', C.rose],
  ['Engineering Mathematics', C.teal],
  ['Microeconomics', C.mint],
  ['Data Structures', C.coral],
  ['Fluid Mechanics', C.peach],
  ['Constitutional Law', C.orange],
  ['Human Anatomy', C.lime],
]

function Marquee() {
  const reduce = useReducedMotion()
  const row = (
    <span className="inline-flex items-center">
      {SUBJECTS.map(([name, color]) => (
        <span key={name} className="inline-flex items-center">
          <span className="font-display">{name}</span>
          <svg viewBox="0 0 20 20" className="mx-8 inline-block size-4" aria-hidden="true">
            <rect x="3" y="3" width="14" height="14" rx="3.5" fill="none" stroke={color} strokeWidth="2" transform="rotate(45 10 10)" />
          </svg>
        </span>
      ))}
    </span>
  )
  return (
    <section aria-label="Works for any subject" className="border-y border-white/8 py-8">
      <ScrollVelocity texts={[row]} velocity={reduce ? 0 : 40} numCopies={3} className="landing-marquee" />
    </section>
  )
}

/* ---------- Features ---------- */
function Cell({ color, icon: Icon, title, text, className, children, pin = true, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className={cn('tint draw lift relative flex flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0a0a0a]', className)}
      style={{ '--accent': color }}
    >
      <span className="absolute inset-x-8 top-0 h-px" style={{ background: color }} aria-hidden="true" />
      <div className="p-6 sm:p-7">
        <span className="grid size-11 place-items-center rounded-xl border" style={{ color, borderColor: `${color}55` }}>
          <Icon className="size-6" />
        </span>
        <h3 className="mt-4 font-display text-2xl font-bold text-white">{title}</h3>
        <p className="mt-2 max-w-md text-[0.95rem] leading-relaxed text-white/60">{text}</p>
      </div>
      <div className={cn(pin && 'mt-auto', 'px-6 pb-6 sm:px-7 sm:pb-7')}>{children}</div>
    </motion.div>
  )
}

function MiniBoard() {
  const cols = [
    ['To do', C.coral, ['Subnetting worksheet', 'DFA exercises']],
    ['Doing', C.gold, ['Round Robin in C']],
    ['Done', C.mint, ['Greedy algorithms']],
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {cols.map(([label, color, items], ci) => (
        <div key={label} className="rounded-2xl border border-white/8 p-2">
          <p className="mb-2 flex items-center gap-1.5 px-1 text-[0.7rem] font-semibold text-white/60">
            <span className="size-1.5 rounded-full" style={{ background: color }} />
            {label}
          </p>
          {items.map((t, i) => (
            <motion.p
              key={t}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + ci * 0.15 + i * 0.08 }}
              className="mb-1.5 rounded-lg bg-[#141414] px-2 py-1.5 text-[0.7rem] leading-tight font-medium text-white/85"
            >
              {t}
            </motion.p>
          ))}
        </div>
      ))}
    </div>
  )
}

// Made-up but believable numbers for the feature previews.
function useSampleWeek() {
  return useMemo(() => {
    const today = todayISO()
    let seed = 7
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const sessions = []
    for (let i = 0; i < 112; i++) {
      const date = addDays(today, -i)
      if (rand() < 0.22) continue
      sessions.push({ date, minutes: Math.round(20 + rand() * 160) })
    }
    const week = weekDays(weekStart(today)).map((date, i) => ({ date, minutes: date > today ? 0 : [95, 140, 60, 180, 120, 45, 30][i], planned: [120, 150, 90, 180, 150, 60, 60][i] }))
    return { sessions, week }
  }, [])
}

function Features() {
  const reduce = useReducedMotion()
  const { sessions, week } = useSampleWeek()
  return (
    <section id="features" className="relative mx-auto max-w-7xl scroll-mt-10 px-5 py-24 sm:px-8 sm:py-32">
      <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="relative max-w-3xl font-display text-4xl leading-[1.05] font-bold tracking-tight text-white sm:text-6xl">
        Everything your semester throws at you.
        <Doodle d={DOODLES.star} color={C.coral} className="-top-6 -right-10 size-10 max-sm:hidden" delay={0.4} width={1.8} />
      </motion.h2>
      <p className="mt-5 max-w-xl text-lg text-white/60">Six tools on one set of data. Tick a topic and your exam readiness, progress and stats all move with it. Try the ones below.</p>

      <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Cell index={0} className="md:col-span-2 md:row-span-2" pin={false} color={C.gold} icon={BookOpenCheck} title="Your syllabus, as a checklist" text="Every unit and topic for every subject. Paste it straight from the university PDF, then tick topics off as you cover them.">
          <div className="rounded-2xl border border-white/8 bg-black/40 p-4">
            <p className="mb-3 text-sm font-semibold text-white">Unit 3: Normalisation</p>
            <TopicList color={C.gold} items={['Functional dependencies & closure', '1NF, 2NF and 3NF', 'BCNF & lossless decomposition', 'Multivalued dependencies']} start={1} />
          </div>
        </Cell>
        <Cell index={1} className="md:col-span-2" color={C.rose} icon={GraduationCap} title="Exam countdowns" text="Days left, plus how much of each exam's syllabus you've covered.">
          <SplitFlapText words={['03 DAYS', '06 DAYS', '11 DAYS']} padTo={7} loop={!reduce} cycleDelay={2600} fontSize={34} tileColor="#1a1a1a" textColor="#fff4e6" tileRadius={7} gap={4} />
        </Cell>
        <Cell index={2} color={C.lime} icon={Timer} title="Focus mode" text="A full-screen timer. Yuuki studies with you and logs the time.">
          <LiveClock start={1102} size={34} />
        </Cell>
        <Cell index={3} color={C.coral} icon={ClipboardList} title="Assignments" text="A board from to-do to done, with due dates.">
          <MiniBoard />
        </Cell>
        <Cell index={4} className="md:col-span-2" color={C.mint} icon={CalendarRange} title="Weekly planner" text="Plan study blocks for each day, drag them around, and compare the plan with what you actually did.">
          <div style={{ '--primary': C.mint }}>
            <DayBars days={week} height={110} />
          </div>
        </Cell>
        <Cell index={5} className="md:col-span-2" color={C.orange} icon={BarChart3} title="Analytics from your own data" text="Streaks, daily averages and time per subject, all from what you logged.">
          <div style={{ '--primary': C.orange }}>
            <Heatmap sessions={sessions} weeks={16} />
          </div>
        </Cell>
      </div>
    </section>
  )
}

/* ---------- Meet Yuuki ---------- */
const YUUKI_POINTS = [
  { pose: 'wave', color: C.mint, title: 'Says hi on your first login', text: 'She asks what to call you, what you study and your daily goal. Your username stays just for logging in.' },
  { pose: 'point', color: C.gold, title: 'Shows you around', text: 'A short tour where you add your first subject, syllabus, exam and study block for real.' },
  { pose: 'cheer', color: C.rose, title: 'Reacts to what you do', text: 'New subject, finished unit, exam 100% covered: she notices, and she is loud about it.' },
  { pose: 'think', color: C.teal, title: 'Answers, and acts', text: 'Ask what to study next or tell her "plan my week". She uses free AI models and updates your plan for you.' },
]

function MeetYuuki() {
  return (
    <section id="yuuki" className="relative scroll-mt-10 border-t border-white/8">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
        <div className="grid items-end gap-10 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="font-display text-lg font-bold text-mint">Meet Yuuki</p>
            <h2 className="mt-2 max-w-3xl font-display text-4xl leading-[1.05] font-bold tracking-tight text-white sm:text-6xl">A study buddy who actually knows your timetable.</h2>
          </div>
          <img src={pose('present')} alt="" className="hidden w-40 lg:block" />
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {YUUKI_POINTS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="tint lift flex flex-col rounded-3xl border border-white/10 bg-[#0a0a0a] p-5"
              style={{ '--accent': p.color }}
            >
              <div className="dots -mx-5 -mt-5 mb-4 flex h-40 items-end justify-center overflow-hidden rounded-t-3xl border-b border-white/8">
                <YuukiPose name={p.pose} className="h-36 w-auto" />
              </div>
              <h3 className="font-display text-lg font-bold text-white">{p.title}</h3>
              <p className="mt-1.5 text-[0.92rem] leading-relaxed text-white/60">{p.text}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-3xl border border-white/10 bg-[#0a0a0a] p-6">
            <p className="flex items-center gap-2 text-sm font-semibold text-white/70">
              <MessageCircle className="size-4 text-mint" /> A chat with Yuuki
            </p>
            <div className="mt-4 space-y-3 text-[0.9rem]">
              <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[#f5f3ef] px-3.5 py-2.5 text-black">My DBMS quiz is on Friday, can you plan revision?</p>
              <div className="flex gap-2">
                <img src={pose('avatar')} alt="" className="size-7 rounded-full object-cover object-top" />
                <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-white/10 bg-[#141414] px-3.5 py-2.5 text-white/85">
                  On it! Three topics in Unit 3 are left, so I put a 45 min block on Wednesday and Thursday evening, and a quick revision Friday morning.
                  <p className="mt-2 text-[0.75rem] font-semibold text-mint">Planned 3 study blocks</p>
                </div>
              </div>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="rounded-3xl border border-white/10 bg-[#0a0a0a] p-6">
            <p className="flex items-center gap-2 text-sm font-semibold text-white/70">
              <Plug className="size-4 text-peach" style={{ color: C.peach }} /> Works with your AI apps
            </p>
            <p className="mt-3 text-[0.92rem] leading-relaxed text-white/60">
              StudySync comes with an MCP server, so Claude, Cursor and other AI apps can read your semester and add subjects, exams and study plans for you. Changes show up in the app straight away.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-xl border border-white/8 bg-black p-3 font-mono text-[0.75rem] text-white/60">
              <span style={{ color: C.peach }}>"studysync"</span>: {'{'} "command": "node", "args": ["server/stdio.js"] {'}'}
            </pre>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* ---------- How it works ---------- */
const STEPS = [
  { color: C.mint, title: 'Log in and meet Yuuki', text: 'She asks your name, course and daily goal, then offers a one-minute tour.' },
  { color: C.gold, title: 'Add your subjects and syllabus', text: 'Type the units and topics, or paste them from the syllabus PDF. A few minutes per subject.' },
  { color: C.rose, title: 'Put exams and deadlines on the calendar', text: 'Quizzes, internals, lab records and assignments, each with its date and a countdown.' },
  { color: C.lime, title: 'Plan blocks, focus, tick topics off', text: 'Each block becomes a one-tap focus session, and every topic you tick raises your exam readiness.' },
]

function HowItWorks() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 70%', 'end 60%'] })
  const scaleY = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })
  return (
    <section id="how" className="relative mx-auto max-w-7xl scroll-mt-10 px-5 py-24 sm:px-8 sm:py-32">
      <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="font-display text-4xl leading-[1.05] font-bold tracking-tight text-white sm:text-6xl">From timetable to exam hall in four moves.</h2>
          <p className="mt-5 max-w-md text-lg text-white/60">Add one subject and start. The rest fills in as your semester happens.</p>
          <img src={pose('clipboard')} alt="" className="mt-8 hidden w-36 lg:block" />
        </div>
        <div ref={ref} className="relative pl-10">
          <div className="absolute top-2 bottom-2 left-[11px] w-[2px] rounded-full bg-white/10" />
          <motion.div className="absolute top-2 bottom-2 left-[11px] w-[2px] origin-top rounded-full bg-[#f5f3ef]" style={{ scaleY }} />
          <ol className="space-y-16">
            {STEPS.map((s, i) => (
              <motion.li key={s.title} initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.6 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="relative">
                <span className="absolute top-1.5 -left-10 grid size-6 place-items-center rounded-full border-2 bg-black" style={{ borderColor: s.color }}>
                  <span className="size-2 rounded-full" style={{ background: s.color }} />
                </span>
                <h3 className="font-display text-2xl font-bold text-white sm:text-3xl">{s.title}</h3>
                <p className="mt-2 max-w-lg text-[1.02rem] leading-relaxed text-white/60">{s.text}</p>
                {i === 1 && (
                  <pre className="mt-5 overflow-x-auto rounded-2xl border border-white/8 bg-[#0b0b0b] p-4 font-mono text-[0.8rem] leading-relaxed text-white/70">
                    <span style={{ color: C.gold }}>Unit 1: Introduction</span>
                    {'\n'}OS structure and system calls{'\n'}Process states and PCB{'\n'}
                    <span style={{ color: C.gold }}>Unit 2: Scheduling</span>
                    {'\n'}FCFS, SJF and Round Robin
                  </pre>
                )}
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

/* ---------- Your data ---------- */
function Privacy() {
  const facts = [
    { icon: Lock, color: C.mint, title: 'Your own account', text: 'Log in with your username. Each account has its own subjects, exams and study log.' },
    { icon: Server, color: C.gold, title: 'Stays on your computer', text: 'Saved in your browser, and in a file on your own computer when the StudySync server runs. No ads, no tracking.' },
    { icon: MessageCircle, color: C.coral, title: 'Yuuki can do it for you', text: 'Ask her to add an exam, plan tomorrow evening or tick a topic, and she does it right there in your planner.' },
  ]
  return (
    <section className="border-t border-white/8">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-32">
        <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="max-w-4xl font-display text-4xl leading-[1.08] font-bold tracking-tight text-white sm:text-6xl">
          Your semester stays with you.
        </motion.h2>
        <div className="mt-14 grid gap-10 md:grid-cols-3">
          {facts.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.6 }} className="draw" style={{ '--accent': f.color }}>
              <f.icon className="size-8" style={{ color: f.color }} />
              <h3 className="mt-4 font-display text-xl font-bold text-white">{f.title}</h3>
              <p className="mt-2 text-white/60">{f.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------- Closing ---------- */
function Closing() {
  return (
    <section className="relative isolate overflow-hidden border-t border-white/8">
      <div className="dots pointer-events-none absolute inset-0 -z-10 opacity-70" />
      <Doodle d={DOODLES.spark} color={C.gold} className="top-16 left-[12%] size-10" delay={0.2} />
      <Doodle d={DOODLES.star} color={C.rose} className="right-[14%] bottom-24 size-10" delay={0.4} />
      <Doodle d={DOODLES.pencil} color={C.teal} className="top-24 right-[20%] size-10" delay={0.6} />
      <div className="mx-auto flex max-w-4xl flex-col items-center px-5 py-24 text-center sm:py-32">
        <YuukiPose name="jump" className="w-36 sm:w-44" />
        <h2 className="mt-6 font-display text-5xl leading-[1.02] font-bold tracking-tight text-white sm:text-7xl">
          This semester, <span className="relative inline-block">
            know
            <Doodle stretch d={DOODLES.squiggle} color={C.mint} viewBox="0 30 100 40" className="-bottom-2 left-0 h-3 w-full" delay={0.3} width={2.5} />
          </span>{' '}
          where you stand.
        </h2>
        <p className="mt-6 max-w-lg text-lg text-white/60">Log in, say hi to Yuuki, and add your first subject. It takes two minutes.</p>
        <Link to="/login" className="draw mt-10 inline-flex h-14 items-center gap-2 rounded-2xl bg-[#f5f3ef] px-8 text-lg font-bold text-black transition-colors hover:bg-white">
          Log in <ArrowRight className="size-5" />
        </Link>
      </div>
    </section>
  )
}

export default function Landing() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-black text-white">
      <Hero />
      <Marquee />
      <Features />
      <MeetYuuki />
      <HowItWorks />
      <Privacy />
      <Closing />
      <footer className="border-t border-white/8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-white/45 sm:px-8">
          <Logo />
          <p>An entrepreneurship class project. Yuuki is an original character made for StudySync.</p>
        </div>
      </footer>
    </div>
  )
}
