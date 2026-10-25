// Yuuki on screen: her corner dock, her speech bubble (in the corner, or next
// to whatever she is pointing at during the tour) and the spotlight ring.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { X } from '../components/icons.jsx'
import { cn } from '../components/ui.jsx'
import { useUI } from '../lib/ui.js'
import { pose } from './poses.js'
import { useYuuki } from './state.js'

export function Typewriter({ text, speed = 16, className }) {
  const reduce = useReducedMotion()
  const [n, setN] = useState(reduce ? text.length : 0)
  useEffect(() => {
    if (reduce) return setN(text.length)
    setN(0)
    const id = setInterval(() => {
      setN((x) => {
        if (x >= text.length) {
          clearInterval(id)
          return x
        }
        // type whole words faster than letters feels more natural
        return x + (text[x] === ' ' ? 2 : 1)
      })
    }, speed)
    return () => clearInterval(id)
  }, [text, speed, reduce])
  const done = n >= text.length
  return (
    <span className={className}>
      <span aria-hidden="true">
        {text.slice(0, n)}
        {!done && <span className="type-caret" />}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  )
}

// Yuuki herself, with a soft idle bob. `flip` mirrors her.
export function YuukiPose({ name = 'wave', className, flip, bob = true, alt = '' }) {
  const reduce = useReducedMotion()
  return (
    // Old and new pose share one grid cell, so they crossfade in place.
    <span className={cn('grid', flip && '-scale-x-100')}>
      <AnimatePresence initial={false}>
        <motion.img
          key={name}
          src={pose(name)}
          alt={alt}
          draggable={false}
          initial={{ opacity: 0, scale: 0.86, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: reduce || !bob ? 0 : [0, -4, 0] }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
          transition={{ opacity: { duration: 0.2 }, scale: { type: 'spring', stiffness: 360, damping: 20 }, y: reduce || !bob ? { duration: 0.2 } : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } }}
          className={cn('pointer-events-none select-none [grid-area:1/1]', className)}
        />
      </AnimatePresence>
    </span>
  )
}

function useAnchorRect(selector) {
  const [rect, setRect] = useState(null)
  useEffect(() => {
    if (!selector) {
      setRect(null)
      return
    }
    let raf = 0
    let last = ''
    const tick = () => {
      const el = document.querySelector(selector)
      const r = el?.getBoundingClientRect()
      const ok = r && r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight
      const key = ok ? `${Math.round(r.top)},${Math.round(r.left)},${Math.round(r.width)},${Math.round(r.height)},${window.innerWidth}` : 'none'
      if (key !== last) {
        last = key
        setRect(ok ? { top: r.top, left: r.left, width: r.width, height: r.height } : null)
      }
      raf = requestAnimationFrame(tick)
    }
    const scroll = setTimeout(() => document.querySelector(selector)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 150)
    tick()
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(scroll)
    }
  }, [selector])
  return rect
}

function Actions({ actions, onDone }) {
  const navigate = useNavigate()
  if (!actions?.length) return null
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={() => {
            if (a.to) navigate(a.to)
            a.run?.()
            if (!a.keep) onDone()
          }}
          className={cn(
            'h-8 rounded-lg px-3 text-[0.8rem] font-semibold transition-colors',
            a.primary ? 'bg-ink text-black hover:bg-white' : a.quiet ? 'text-muted hover:text-ink' : 'border border-line-strong text-ink-2 hover:border-[var(--accent)] hover:text-ink',
          )}
        >
          {a.label}
        </button>
      ))}
    </div>
  )
}

function BubbleCard({ bubble, style, className, tail }) {
  const { hush, hold, release } = useYuuki()
  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.97, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      onPointerEnter={hold}
      onPointerLeave={release}
      className={cn('tint pointer-events-auto absolute w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line-strong bg-surface-2 p-4 shadow-float', className)}
      style={{ '--accent': bubble.accent || 'var(--mint)', ...style }}
    >
      {tail && <span className="bubble-tail" style={tail} />}
      <div className="relative">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-[0.72rem] font-bold tracking-wide text-[var(--accent)]">{bubble.title || 'Yuuki'}</p>
          {!bubble.noClose && (
            <button type="button" onClick={() => (bubble.onClose ? bubble.onClose() : hush(bubble.id))} className="-mr-1 grid size-6 place-items-center rounded-md text-muted hover:bg-surface-3 hover:text-ink" aria-label="Close">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <p className="text-[0.92rem] leading-relaxed text-ink">
          <Typewriter key={bubble.id} text={bubble.text} />
        </p>
        {bubble.body}
        <Actions actions={bubble.actions} onDone={() => hush(bubble.id)} />
      </div>
    </motion.div>
  )
}

function Anchored({ bubble, rect }) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const W = Math.min(352, vw - 32)
  const below = rect.top + rect.height + 230 < vh || rect.top < 260
  const left = Math.max(16, Math.min(vw - W - 16, rect.left + rect.width / 2 - W / 2))
  const top = below ? rect.top + rect.height + 18 : rect.top - 18
  const tailLeft = Math.max(18, Math.min(W - 32, rect.left + rect.width / 2 - left - 7))
  const yuukiRight = left + W + 96 < vw
  const pad = 6
  return (
    <>
      <div className="guide-ring pointer-events-none fixed z-[61]" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, '--accent': bubble.accent || 'var(--mint)' }} />
      <div className="pointer-events-none fixed inset-0 z-[62]">
        <div className="absolute" style={{ left, top, width: W, transform: below ? undefined : 'translateY(-100%)' }}>
          <BubbleCard bubble={bubble} className="relative" style={{ width: W }} tail={below ? { top: -8, left: tailLeft, borderRight: 'none', borderBottom: 'none' } : { bottom: -8, left: tailLeft, borderLeft: 'none', borderTop: 'none' }} />
          <div className={cn('absolute w-24 sm:w-28', yuukiRight ? '-right-[5.5rem] sm:-right-[6.5rem]' : '-left-[5.5rem] sm:-left-[6.5rem]', below ? 'top-2' : 'bottom-2')}>
            <YuukiPose name={bubble.pose} flip={!yuukiRight} className="w-full drop-shadow-[0_8px_18px_rgba(0,0,0,0.6)]" />
          </div>
        </div>
      </div>
    </>
  )
}

function Corner({ bubble }) {
  return (
    <div className="pointer-events-none fixed right-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[62] flex items-end gap-1 sm:right-5 lg:bottom-5">
      <div className="relative mb-6 w-[min(22rem,calc(100vw-7rem))]">
        <BubbleCard bubble={bubble} className="relative bottom-0" style={{ width: '100%' }} tail={{ right: -8, bottom: 22, borderLeft: 'none', borderBottom: 'none' }} />
      </div>
      <div className="w-20 shrink-0 sm:w-28">
        <YuukiPose name={bubble.pose} className="w-full drop-shadow-[0_8px_18px_rgba(0,0,0,0.6)]" />
      </div>
    </div>
  )
}

export function YuukiBubble() {
  const bubble = useYuuki((s) => s.bubble)
  const chatOpen = useYuuki((s) => s.chatOpen)
  const editorOpen = useUI((s) => Boolean(s.editor) || s.palette)
  const rect = useAnchorRect(bubble?.anchor && !editorOpen ? bubble.anchor : null)
  if (!bubble || (chatOpen && !bubble.sticky)) return null
  // While a form is open over the page, step out of the way.
  if (editorOpen && bubble.anchor) return null
  return <AnimatePresence>{bubble.anchor && rect ? <Anchored key={`a${bubble.id}`} bubble={bubble} rect={rect} /> : <Corner key={`c${bubble.id}`} bubble={bubble} />}</AnimatePresence>
}

// Yuuki peeking in from the right edge. Click to chat.
export function YuukiDock() {
  const bubble = useYuuki((s) => s.bubble)
  const chatOpen = useYuuki((s) => s.chatOpen)
  const openChat = useYuuki((s) => s.openChat)
  const covered = useUI((s) => Boolean(s.editor) || s.palette || s.focusOpen || Boolean(s.quiz))
  const ref = useRef(null)
  const hidden = chatOpen || covered || (bubble && !bubble.anchor)
  useLayoutEffect(() => {
    ref.current?.setAttribute('data-tour', 'yuuki-dock')
  }, [])
  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={() => openChat()}
      aria-label="Talk to Yuuki"
      initial={{ x: 120 }}
      animate={{ x: hidden ? 140 : typeof window !== 'undefined' && window.innerWidth < 640 ? 14 : 30 }}
      whileHover={{ x: 8 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="tint group fixed right-0 bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-40 w-16 sm:w-20 lg:bottom-4"
      style={{ '--accent': 'var(--mint)' }}
    >
      <span className="hover-only pointer-events-none absolute -top-7 right-8 rounded-lg border border-line-strong bg-surface-2 px-2 py-0.5 text-[0.7rem] font-semibold whitespace-nowrap text-ink opacity-0 transition-opacity group-hover:opacity-100">
        Talk to Yuuki
      </span>
      <img src={pose('peek')} alt="" draggable={false} className="w-full select-none drop-shadow-[0_6px_14px_rgba(0,0,0,0.7)]" />
    </motion.button>
  )
}
