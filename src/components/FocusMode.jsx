import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Maximize2, Minimize2, Pause, Play, Square, Timer } from './icons.jsx'
import Counter from './rb/Counter/Counter.jsx'
import { Button, Ring, celebrate, useToast } from './ui.jsx'
import { colorOf, useStore } from '../lib/store.js'
import { useUI } from '../lib/ui.js'
import { formatMinutes } from '../lib/dates.js'
import { YuukiPose, Typewriter } from '../yuuki/Yuuki.jsx'
import { blip } from '../lib/sound.js'

export function useElapsed(timer) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!timer || timer.pausedAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [timer])
  if (!timer) return 0
  const end = timer.pausedAt || now
  return Math.max(0, Math.floor((end - timer.startedAt - timer.pausedMs) / 1000))
}

export function clock(total) {
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const p = (n) => String(n).padStart(2, '0')
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`
}

function RollingClock({ seconds, size }) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const common = { fontSize: size, gap: 0, horizontalPadding: 0, borderRadius: 0, fontWeight: 700, gradientHeight: 0, gradientFrom: 'transparent' }
  const colon = <span style={{ fontSize: size * 0.8, lineHeight: 1 }} className="px-1 pb-[0.12em] opacity-50">:</span>
  return (
    <span className="inline-flex items-center font-mono tracking-tight" aria-hidden="true">
      {h > 0 && (
        <>
          <Counter value={h} places={h >= 10 ? [10, 1] : [1]} {...common} />
          {colon}
        </>
      )}
      <Counter value={m} places={[10, 1]} {...common} />
      {colon}
      <Counter value={s} places={[10, 1]} {...common} />
    </span>
  )
}

function useFinish() {
  const finish = useStore((s) => s.finishTimer)
  const setFocusOpen = useUI((s) => s.setFocusOpen)
  const toast = useToast()
  return () => {
    const minutes = finish()
    setFocusOpen(false)
    celebrate()
    // With remarks on, Yuuki says this herself.
    if (!useStore.getState().prefs.yuukiTips) toast(`Saved ${formatMinutes(minutes)} of focus`, { description: 'Nice work. It’s in your study log.' })
  }
}

export default function FocusMode() {
  const timer = useStore((s) => s.timer)
  const subject = useStore((s) => s.subjects.find((x) => x.id === s.timer?.subjectId))
  const pause = useStore((s) => s.pauseTimer)
  const resume = useStore((s) => s.resumeTimer)
  const cancel = useStore((s) => s.cancelTimer)
  const open = useUI((s) => s.focusOpen)
  const setOpen = useUI((s) => s.setFocusOpen)
  const finish = useFinish()
  const seconds = useElapsed(timer)
  const reduce = useReducedMotion()
  const breakReminder = useStore((s) => s.prefs.breakReminder)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [note, setNote] = useState(null)
  const nudged = useRef(null)
  const [wide, setWide] = useState(() => window.innerWidth > 640)

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth > 640)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault()
        timer?.pausedAt ? resume() : pause()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, timer, pause, resume, setOpen])

  useEffect(() => {
    document.title = timer ? `${clock(seconds)} · ${subject?.name || 'Focus'}` : 'StudySync AI'
  }, [timer, seconds, subject])

  const color = colorOf(subject?.color)
  const planned = (timer?.planned || 45) * 60
  const progress = Math.min(100, (seconds / planned) * 100)

  // Yuuki studies with you, and suggests a break once you reach the target.
  useEffect(() => {
    if (!timer) {
      setNote(null)
      nudged.current = null
      return
    }
    if (seconds < 3) setNote({ pose: 'desk', text: "I'll study right here with you. Phone face down?" })
    if (breakReminder && seconds >= planned && nudged.current !== timer.startedAt) {
      nudged.current = timer.startedAt
      blip('done')
      setNote({ pose: 'sleepy', text: `That's your ${formatMinutes(timer.planned)}! Finish and take five, or keep going if you're in the zone.` })
    }
  }, [timer, seconds, planned, breakReminder])

  return (
    <AnimatePresence>
      {timer && open && (
        <motion.div
          className="fixed inset-0 z-[60] overflow-hidden bg-black text-white"
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          role="dialog"
          aria-label="Focus session"
        >
          {/* A slow breathing outline behind the clock: in for 4s, out for 4s. */}
          <div className="dots pointer-events-none absolute inset-0 opacity-40" />
          {!reduce && !timer.pausedAt && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden="true">
              <motion.div
                className="rounded-full border"
                style={{ borderColor: color, width: wide ? 460 : 340, height: wide ? 460 : 340 }}
                animate={{ scale: [0.92, 1.06, 0.92], opacity: [0.18, 0.45, 0.18] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          )}
          <div className="pointer-events-none absolute bottom-0 left-4 hidden w-44 sm:block lg:left-10 lg:w-56">
            <YuukiPose name={note?.pose || 'desk'} className="w-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.9)]" alt="" />
          </div>
          <AnimatePresence>
            {note && (
              <motion.div
                key={note.text}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute bottom-[17rem] left-6 z-10 hidden max-w-xs rounded-2xl border border-white/15 bg-[#111] p-4 text-left text-sm text-white/85 sm:block lg:bottom-[21.5rem] lg:left-12"
              >
                <p className="mb-1 text-[0.7rem] font-bold" style={{ color }}>Yuuki</p>
                <Typewriter text={note.text} />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="absolute top-5 right-5 flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="draw flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/10"
              >
                <Minimize2 className="size-4" /> Minimise
              </button>
            </div>

            <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-sm font-semibold">
                <span className="size-2 rounded-full" style={{ background: color }} />
                {subject?.name || 'Study'}
              </span>
              <h2 className="mt-4 max-w-xl text-2xl font-semibold text-white/90 sm:text-3xl">{timer.title || 'Deep focus'}</h2>
            </motion.div>

            <motion.div
              className="relative my-10"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.25, type: 'spring', stiffness: 160, damping: 18 }}
            >
              <Ring value={progress} size={wide ? 340 : 270} stroke={6} color={color} track="rgb(255 255 255 / 0.12)">
                <div className="flex flex-col items-center">
                  <RollingClock seconds={seconds} size={wide ? 64 : 48} />
                  <span className="mt-2 text-sm text-white/60">
                    {timer.pausedAt ? 'Paused' : `Target ${formatMinutes(timer.planned)}`}
                  </span>
                </div>
              </Ring>
            </motion.div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => (timer.pausedAt ? resume() : pause())}
                className="draw flex h-12 items-center gap-2 rounded-2xl border border-white/20 px-5 font-semibold hover:bg-white/10"
              >
                {timer.pausedAt ? <Play className="size-5" /> : <Pause className="size-5" />}
                {timer.pausedAt ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={finish}
                className="draw flex h-12 items-center gap-2 rounded-2xl bg-white px-6 font-bold text-black hover:bg-white/90"
              >
                <Square className="size-4" /> Finish & save
              </button>
            </div>
            <div className="mt-6 h-8 text-sm">
              {confirmCancel ? (
                <span className="flex items-center gap-3 text-white/80">
                  Throw away this session?
                  <button
                    className="font-semibold text-rose-300 underline underline-offset-4"
                    onClick={() => {
                      cancel()
                      setOpen(false)
                      setConfirmCancel(false)
                    }}
                  >
                    Discard
                  </button>
                  <button className="font-semibold underline underline-offset-4" onClick={() => setConfirmCancel(false)}>
                    Keep going
                  </button>
                </span>
              ) : (
                <button className="text-white/50 hover:text-white/80" onClick={() => setConfirmCancel(true)}>
                  Discard session
                </button>
              )}
            </div>
            <p className="absolute bottom-6 text-xs text-white/40">Space to pause · Esc to minimise</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Small floating pill while a session runs in the background.
export function TimerPill() {
  const timer = useStore((s) => s.timer)
  const subject = useStore((s) => s.subjects.find((x) => x.id === s.timer?.subjectId))
  const open = useUI((s) => s.focusOpen)
  const setOpen = useUI((s) => s.setFocusOpen)
  const finish = useFinish()
  const seconds = useElapsed(timer)
  return (
    <AnimatePresence>
      {timer && !open && (
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          className="fixed right-24 bottom-24 z-40 flex items-center gap-1 rounded-2xl border border-line bg-surface p-1.5 shadow-float lg:right-28 lg:bottom-6"
        >
          <button onClick={() => setOpen(true)} className="flex items-center gap-3 rounded-xl px-3 py-1.5 hover:bg-surface-2" aria-label="Open focus mode">
            <span className="relative grid size-8 place-items-center rounded-lg text-black" style={{ background: colorOf(subject?.color) }}>
              <Timer className="size-4" />
              {!timer.pausedAt && <span className="live-dot absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface bg-danger" />}
            </span>
            <span className="text-left">
              <span className="block max-w-36 truncate text-[0.72rem] text-muted">{subject?.name}</span>
              <span className="num block font-mono text-base font-bold text-ink">{clock(seconds)}</span>
            </span>
          </button>
          <Button variant="primary" size="sm" onClick={finish} aria-label="Finish and save">
            <Square /> Save
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Expand">
            <Maximize2 />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
