// The first time an account opens the app, Yuuki introduces herself, asks
// what to call you (your username is only for logging in), what you study
// and how long you want to study each day. Then she offers the tour.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight } from '../components/icons.jsx'
import { cn } from '../components/ui.jsx'
import { useStore } from '../lib/store.js'
import { Typewriter, YuukiPose } from './Yuuki.jsx'
import { say } from './state.js'

const GOALS = [60, 120, 180, 240, 300, 360]

export default function Intro() {
  const user = useStore((s) => s.user)
  const profile = useStore((s) => s.profile)
  const prefs = useStore((s) => s.prefs)
  const updateProfile = useStore((s) => s.updateProfile)
  const updatePrefs = useStore((s) => s.updatePrefs)
  const updateGuide = useStore((s) => s.updateGuide)
  const [step, setStep] = useState(0)
  const [name, setName] = useState(profile.name || '')
  const [course, setCourse] = useState(profile.course || '')
  const [semester, setSemester] = useState(profile.semester || '')
  const [college, setCollege] = useState(profile.college || '')
  const [goal, setGoal] = useState(prefs.dailyGoal || 180)
  const inputRef = useRef(null)
  const first = name.trim().split(/\s+/)[0]

  const finish = (tour) => {
    updateProfile({ name: name.trim() || user, course: course.trim(), semester: semester.trim(), college: college.trim() })
    updatePrefs({ dailyGoal: goal })
    updateGuide({ introduced: true, tour: tour ? 1 : 0, tourDone: !tour })
    if (!tour) say({ pose: 'thumbs', text: `Okay ${first || 'friend'}, explore away! I'm in the corner whenever you need me. Start by adding your subjects.`, actions: [{ label: 'Add a subject', to: '/app/subjects', primary: true }] })
  }

  const steps = [
    {
      pose: 'wave',
      text: `Hi${user ? ` ${user}` : ''}! I'm Yuuki. I live inside StudySync and I'm going to help you keep this semester under control.`,
      next: 'Hi Yuuki!',
    },
    {
      pose: 'present',
      text: "Your subjects and their syllabus, exams, assignments and study time, all in one place. You tell me what's coming, I keep count, and I cheer very loudly when you get things done.",
      next: 'Sounds good',
    },
    {
      pose: 'think',
      text: `"${user}" is just for logging in. What should I actually call you?`,
      body: (
        <input ref={inputRef} className="input mt-4 text-base" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={60} aria-label="Your name" />
      ),
      next: "That's me",
      canNext: name.trim().length > 0,
    },
    {
      pose: 'read',
      text: `${first || 'Nice'}! Lovely to meet you properly. What are you studying? (You can skip this.)`,
      body: (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <input ref={inputRef} className="input" value={course} onChange={(e) => setCourse(e.target.value)} placeholder="Course, e.g. B.Tech CSE" maxLength={60} aria-label="Course" />
          <input className="input" value={semester} onChange={(e) => setSemester(e.target.value)} placeholder="Semester, e.g. Semester 3" maxLength={30} aria-label="Semester" />
          <input className="input sm:col-span-2" value={college} onChange={(e) => setCollege(e.target.value)} placeholder="College (optional)" maxLength={80} aria-label="College" />
        </div>
      ),
      next: 'Next',
    },
    {
      pose: 'desk',
      text: 'How long do you want to study on a normal day? Be honest, I will not judge. I fill your ring as you go.',
      body: (
        <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Daily study goal">
          {GOALS.map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={goal === g}
              onClick={() => setGoal(g)}
              className={cn('h-10 rounded-xl border px-4 font-display text-[0.95rem] font-bold transition-colors', goal === g ? 'border-mint bg-mint text-black' : 'border-line-strong text-ink-2 hover:border-mint/60 hover:text-ink')}
            >
              {g / 60} h
            </button>
          ))}
        </div>
      ),
      next: 'Set my goal',
    },
    {
      pose: 'jump',
      text: `All set, ${first || 'friend'}! Want me to show you around? It takes a minute, and you'll add your first subject on the way.`,
      final: true,
    },
  ]
  const s = steps[step]

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350)
    return () => clearTimeout(t)
  }, [step])

  const advance = () => {
    if (s.canNext === false) return
    setStep((x) => Math.min(x + 1, steps.length - 1))
  }

  return (
    <motion.div
      className="tint fixed inset-0 z-[80] flex items-end justify-center overflow-y-auto bg-black/90 p-4 backdrop-blur-sm sm:items-center sm:p-8"
      style={{ '--accent': 'var(--mint)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Meet Yuuki"
    >
      <div className="dots pointer-events-none absolute inset-0 opacity-60" />
      <button type="button" onClick={() => finish(false)} className="absolute top-4 right-4 z-10 rounded-lg px-3 py-1.5 text-sm font-semibold text-muted hover:text-ink">
        Skip intro
      </button>
      <div className="relative grid w-full max-w-4xl items-end gap-2 sm:grid-cols-[minmax(0,15rem)_1fr] sm:gap-8">
        <div className="mx-auto w-40 sm:w-full">
          <YuukiPose name={s.pose} className="w-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)]" alt="Yuuki" />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!s.final) advance()
          }}
          className="relative mb-2 rounded-3xl border border-line-strong bg-surface p-6 shadow-float sm:mb-10 sm:p-7"
        >
          <span className="bubble-tail max-sm:hidden" style={{ left: -8, bottom: 40, borderRight: 'none', borderTop: 'none', background: 'var(--surface)' }} />
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display text-sm font-bold text-mint">Yuuki</p>
            <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${steps.length}`}>
              {steps.map((_, i) => (
                <motion.span key={i} className="h-1.5 rounded-full" animate={{ width: i === step ? 22 : 6, background: i <= step ? 'var(--mint)' : 'var(--surface-3)' }} />
              ))}
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.22 }}>
              <p className="min-h-[3.2em] text-[1.08rem] leading-relaxed text-ink sm:text-[1.15rem]">
                <Typewriter text={s.text} speed={14} />
              </p>
              {s.body}
            </motion.div>
          </AnimatePresence>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {step > 0 && !s.final && (
              <button type="button" onClick={() => setStep(step - 1)} className="h-11 rounded-xl px-4 text-sm font-semibold text-muted hover:text-ink">
                Back
              </button>
            )}
            {s.final ? (
              <>
                <button type="button" onClick={() => finish(true)} className="draw inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-bold text-black hover:bg-white">
                  Show me around <ArrowRight className="size-4" />
                </button>
                <button type="button" onClick={() => finish(false)} className="h-11 rounded-xl border border-line-strong px-5 text-sm font-semibold text-ink-2 hover:text-ink">
                  I'll explore on my own
                </button>
              </>
            ) : (
              <button type="submit" disabled={s.canNext === false} className="draw ml-auto inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-bold text-black hover:bg-white disabled:opacity-40">
                {s.next} <ArrowRight className="size-4" />
              </button>
            )}
          </div>
        </form>
      </div>
    </motion.div>
  )
}
