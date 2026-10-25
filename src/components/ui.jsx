import { createContext, forwardRef, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, LayoutGroup, motion, useInView, useReducedMotion } from 'motion/react'
import clsx from 'clsx'
import { X, CheckCircle2 } from './icons.jsx'
import confetti from 'canvas-confetti'
import CountUp from './rb/CountUp/CountUp.jsx'
import SwipeToast from './rb/SwipeToast/SwipeToast.jsx'
import { colorOf, useStore } from '../lib/store.js'
import { pageFor } from '../lib/nav.js'
import { pose } from '../yuuki/poses.js'
import { blip } from '../lib/sound.js'

export const cn = clsx

/* ---------- Motion presets ---------- */
export const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
}

export function Stagger({ children, className, delay = 0, gap = 0.06, as = 'div' }) {
  const Comp = motion[as]
  return (
    <Comp
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: delay } } }}
    >
      {children}
    </Comp>
  )
}

/* ---------- Buttons ---------- */
const BUTTON = {
  primary: 'bg-ink text-black hover:bg-white',
  accent: 'bg-primary text-on-primary hover:brightness-110',
  soft: 'bg-surface-3 text-ink hover:bg-[#262626]',
  outline: 'border border-line-strong bg-surface text-ink hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--line-strong))] hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-danger-soft text-danger hover:brightness-125',
}
const SIZE = {
  sm: 'h-8 px-3 text-[0.8rem] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[0.95rem] gap-2 rounded-2xl',
  icon: 'h-9 w-9 rounded-xl',
}

export const Button = forwardRef(function Button({ variant = 'outline', size = 'md', className, children, ...rest }, ref) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'draw inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-[background,color,border-color,filter] duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4',
        BUTTON[variant],
        SIZE[size],
        className,
      )}
      type="button"
      {...rest}
    >
      {children}
    </motion.button>
  )
})

/* ---------- Cards ----------
   Set `accent` to give a card its own colour (border on hover, its icon,
   rings and bars inside). */
export function Card({ className, children, hover = true, accent, style, as = 'div', ...rest }) {
  const Comp = motion[as]
  return (
    <Comp
      variants={fadeUp}
      className={cn('rounded-2xl border border-line bg-surface', accent && 'tint', hover && 'lift', className)}
      style={accent ? { '--accent': accent, ...style } : style}
      {...rest}
    >
      {children}
    </Comp>
  )
}

export function CardHeader({ title, icon: Icon, action, sub, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="draw flex items-center gap-2 text-[1.05rem] font-semibold text-ink">
          {Icon && <Icon className="size-[1.15rem] shrink-0 text-[var(--accent)]" />}
          {title}
        </h2>
        {sub && <p className="mt-0.5 text-[0.8rem] text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

/* ---------- Page header ----------
   Outline icon in the section colour, the title rising word by word and a
   hand-drawn underline that draws itself. */
export function PageHeader({ title, sub, actions, eyebrowIcon: Icon }) {
  const { pathname } = useLocation()
  const color = pageFor(pathname).color
  const words = typeof title === 'string' ? title.split(' ') : null
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="flex items-center gap-3 text-[1.9rem] leading-tight font-bold text-ink sm:text-[2.3rem]">
          {Icon && (
            <span className="draw-now grid size-11 shrink-0 place-items-center rounded-2xl border" style={{ color, borderColor: `color-mix(in srgb, ${color} 35%, transparent)` }}>
              <Icon className="size-6" />
            </span>
          )}
          <span className="relative">
            {words
              ? words.map((w, i) => (
                  <span key={`${title}-${i}`} className="inline-block overflow-hidden pb-1 align-bottom">
                    <motion.span className="inline-block" initial={{ y: '105%' }} animate={{ y: 0 }} transition={{ duration: 0.55, delay: 0.05 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}>
                      {w}
                      {i < words.length - 1 ? ' ' : ''}
                    </motion.span>
                  </span>
                ))
              : title}
            <svg key={pathname} className="scribble pointer-events-none absolute -bottom-1.5 left-0 h-3 w-full overflow-visible" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true">
              <path d="M2 8c30-5 62-6 96-3.5S166 9 198 4" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
          </span>
        </h1>
        {sub && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-2.5 max-w-2xl text-[0.95rem] text-muted">
            {sub}
          </motion.p>
        )}
      </div>
      {actions && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-wrap items-center gap-2">
          {actions}
        </motion.div>
      )}
    </header>
  )
}

/* ---------- Badges ---------- */
const TONES = {
  neutral: 'bg-surface-2 text-ink-2',
  primary: 'bg-primary-soft text-primary-ink',
  good: 'bg-success-soft text-success',
  warn: 'bg-warning-soft text-warning',
  bad: 'bg-danger-soft text-danger',
}
export function Badge({ tone = 'neutral', className, children, dot }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.72rem] font-semibold whitespace-nowrap', TONES[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/* ---------- Subjects ---------- */
export function useSubject(id) {
  return useStore((s) => s.subjects.find((x) => x.id === id))
}

export function SubjectDot({ color, className }) {
  return <span className={cn('inline-block size-2.5 shrink-0 rounded-full', className)} style={{ background: colorOf(color) }} />
}

export function SubjectTag({ subjectId, className, short }) {
  const subject = useSubject(subjectId)
  if (!subject) return null
  return (
    <span
      className={cn('sc-soft inline-flex max-w-full items-center gap-1.5 truncate rounded-md px-2 py-0.5 text-[0.72rem] font-semibold', className)}
      style={{ '--c': colorOf(subject.color), '--accent': colorOf(subject.color) }}
    >
      <span className="sc-bg size-1.5 shrink-0 rounded-full" />
      <span className="truncate">{short ? subject.code || subject.name : subject.code ? `${subject.code} · ${subject.name}` : subject.name}</span>
    </span>
  )
}

/* ---------- Progress ---------- */
export function ProgressBar({ value, color, className, height = 8, delay = 0 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  return (
    <div ref={ref} className={cn('overflow-hidden rounded-full bg-surface-3', className)} style={{ height }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color || 'var(--primary)' }}
        initial={{ width: 0 }}
        animate={{ width: inView ? `${Math.max(0, Math.min(100, value))}%` : 0 }}
        transition={{ duration: 1.1, delay, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  )
}

export function Ring({ value, size = 64, stroke = 7, color, track, children, className, delay = 0 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value || 0))
  return (
    <div ref={ref} className={cn('relative grid shrink-0 place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track || 'var(--surface-3)'} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color || 'var(--primary)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: inView ? c - (v / 100) * c : c }}
          transition={{ duration: 1.3, delay, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

/* ---------- Numbers ---------- */
function usePrevious(value) {
  const ref = useRef(0)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref.current
}

export function Count({ value, duration = 1, className }) {
  const prev = usePrevious(value)
  return (
    <span className={cn('num', className)} aria-label={String(value)}>
      <span aria-hidden="true">
        <CountUp key={value} from={prev} to={value} duration={duration} />
      </span>
    </span>
  )
}

// 135 -> "2h 15m" with each part counting up.
export function Duration({ minutes, className, unitClass = 'text-[0.6em] font-semibold text-muted ml-0.5' }) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return (
    <span className={cn('num whitespace-nowrap', className)} aria-label={`${h} hours ${m} minutes`}>
      {h > 0 && (
        <>
          <Count value={h} />
          <span className={unitClass}>h</span>{' '}
        </>
      )}
      <Count value={m} />
      <span className={unitClass}>m</span>
    </span>
  )
}

/* ---------- Empty state: Yuuki keeps you company ---------- */
export function Empty({ icon: Icon, pose: poseName, title, text, action, className, compact }) {
  const reduce = useReducedMotion()
  return (
    <div className={cn('dots relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line-strong px-6 text-center', compact ? 'py-7' : 'py-10', className)}>
      {poseName ? (
        <motion.img
          src={pose(poseName)}
          alt=""
          draggable={false}
          initial={{ opacity: 0, y: 12, scale: 0.9 }}
          animate={{ opacity: 1, y: reduce ? 0 : [0, -4, 0], scale: 1 }}
          transition={{ opacity: { duration: 0.3 }, scale: { type: 'spring', stiffness: 260, damping: 18 }, y: reduce ? { duration: 0 } : { duration: 3.4, repeat: Infinity, ease: 'easeInOut', delay: 0.4 } }}
          className={cn('mb-3 select-none drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]', compact ? 'w-20' : 'w-28')}
        />
      ) : (
        Icon && (
          <span className="draw-now mb-3 grid size-12 place-items-center rounded-2xl border border-line-strong text-[var(--accent)]">
            <Icon className="size-6" />
          </span>
        )
      )}
      <p className="font-display text-lg font-semibold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ---------- Drawer (forms) ---------- */
export function Drawer({ open, onClose, title, sub, children, footer, accent }) {
  const reduce = useReducedMotion()
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={reduce ? { opacity: 0 } : { x: '100%' }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="tint absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-line bg-surface pt-[env(safe-area-inset-top)] shadow-float"
            style={accent ? { '--accent': accent } : undefined}
          >
            <span className="absolute inset-x-0 top-0 h-[2px] bg-[var(--accent)]" aria-hidden="true" />
            <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-ink">{title}</h2>
                {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                <X />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">{children}</div>
            {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{footer}</div>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}

export function Field({ label, children, className, hint }) {
  return (
    <label className={cn('block', className)}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[0.75rem] text-muted">{hint}</span>}
    </label>
  )
}

export function SubjectSelect({ value, onChange, className }) {
  const subjects = useStore((s) => s.subjects)
  return (
    <select className={cn('input', className)} value={value} onChange={(e) => onChange(e.target.value)} required>
      {subjects.map((s) => (
        <option key={s.id} value={s.id}>
          {s.code ? `${s.code} · ${s.name}` : s.name}
        </option>
      ))}
    </select>
  )
}

export function Kbd({ children }) {
  return <kbd className="rounded-md border border-line-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[0.68rem] text-muted">{children}</kbd>
}

// A row of options with a highlight that slides to the chosen one.
// options: [{ value, label, hint? }]
export function Choice({ id, value, options, onChange, label, size = 'md', className }) {
  return (
    <LayoutGroup id={id}>
      <div role="radiogroup" aria-label={label} className={cn('flex flex-wrap gap-1 rounded-xl border border-line bg-surface-2 p-1', className)}>
        {options.map((o) => {
          const on = o.value === value
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={on}
              title={o.hint}
              disabled={o.disabled}
              onClick={() => onChange(o.value)}
              className={cn('relative rounded-lg font-semibold transition-colors disabled:opacity-40', size === 'sm' ? 'px-2.5 py-1 text-[0.76rem]' : 'px-3 py-1.5 text-[0.82rem]', on ? 'text-black' : 'text-ink-2 hover:text-ink')}
            >
              {on && <motion.span layoutId={`${id}-pill`} className="absolute inset-0 rounded-lg bg-[var(--accent)]" transition={{ type: 'spring', stiffness: 480, damping: 34 }} />}
              <span className="relative">{o.label}</span>
            </button>
          )
        })}
      </div>
    </LayoutGroup>
  )
}

/* A small on/off switch for settings. */
export function Toggle({ checked, onChange, label, className }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('tap relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors', checked ? 'border-transparent bg-[var(--accent)]' : 'border-line-strong bg-surface-3', className)}
    >
      <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 32 }} className={cn('block size-4.5 rounded-full', checked ? 'ml-[1.4rem] bg-black' : 'ml-[0.2rem] bg-muted')} />
    </button>
  )
}

/* ---------- Toasts ---------- */
const ToastContext = createContext(() => {})
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const show = useCallback((title, options = {}) => setToast({ id: Date.now() + Math.random(), title, ...options }), [])
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <SwipeToast
          key={toast.id}
          className="app-toast"
          title={toast.title}
          description={toast.description || ''}
          actionLabel={toast.actionLabel || ''}
          onAction={toast.onAction}
          icon={<CheckCircle2 />}
          open
          onClose={() => setToast((t) => (t?.id === toast.id ? null : t))}
          background="var(--ink)"
          color="var(--bg)"
          fuseColor="#34d399"
          duration={toast.actionLabel ? 5000 : 3200}
          width={340}
        />
      )}
    </ToastContext.Provider>
  )
}

/* ---------- Celebration ---------- */
const PARTY = ['#facc15', '#ff4d8d', '#34d399', '#ff6b5b', '#2dd4bf', '#a3e635']
export function celebrate(origin = { x: 0.5, y: 0.35 }) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  if (document.documentElement.classList.contains('reduce-motion')) return
  if (useStore.getState().prefs?.celebrations === false) return
  blip('done')
  confetti({ particleCount: 90, spread: 75, startVelocity: 38, origin, colors: PARTY, scalar: 0.9, ticks: 160 })
}

// A small burst of line sparks from an element (ticking things off).
export function sparkAt(el, color = '#f5f3ef') {
  if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion')) return
  const r = el.getBoundingClientRect()
  const layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  layer.style.cssText = `position:fixed;left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;width:0;height:0;pointer-events:none;z-index:90`
  for (let i = 0; i < 8; i++) {
    const s = document.createElement('span')
    const a = (i / 8) * Math.PI * 2
    s.style.cssText = `position:absolute;left:-1px;top:-6px;width:2px;height:8px;border-radius:2px;background:${color};transform:rotate(${a + Math.PI / 2}rad) translateY(0);opacity:1;transition:transform 420ms cubic-bezier(.16,1,.3,1),opacity 420ms`
    layer.appendChild(s)
    requestAnimationFrame(() => {
      s.style.transform = `rotate(${a + Math.PI / 2}rad) translateY(-20px)`
      s.style.opacity = '0'
    })
  }
  document.body.appendChild(layer)
  setTimeout(() => layer.remove(), 500)
}

// Snapshot of the data before a destructive action, for "Undo".
export function useUndo() {
  const toast = useToast()
  return (label, action) => {
    const before = useStore.getState()
    action()
    toast(label, {
      actionLabel: 'Undo',
      onAction: () =>
        useStore.setState({
          subjects: before.subjects,
          units: before.units,
          topics: before.topics,
          exams: before.exams,
          assignments: before.assignments,
          blocks: before.blocks,
          sessions: before.sessions,
        }),
    })
  }
}
