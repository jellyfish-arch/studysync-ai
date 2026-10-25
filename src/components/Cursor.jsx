// The custom cursor: an outline arrow with a second, offset outline behind it
// (like a two-colour print slightly out of register). The offset line takes
// the colour of whatever the pointer is over (the nearest --accent), so it is
// mint over the planner, the subject's colour over a subject, and so on.
//
// It sits exactly at the pointer (no trailing, no lag), only appears for a
// mouse or trackpad, and can be turned off in Settings.
import { useEffect, useRef, useState } from 'react'

const ARROW = 'M2 2v17l4.3-4 2.9 6.4 2.8-1.2-2.8-6.3H15L2 2Z'
const CLICKABLE = 'a[href],button:not(:disabled),[role=button],[role=tab],[role=radio],[role=switch],[role=option],label,select,summary,[data-cursor=pointer],[draggable=true]'
const TEXT = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]),textarea,[contenteditable=true]'

function readAccent(el) {
  const v = el ? getComputedStyle(el).getPropertyValue('--accent').trim() : ''
  return v || '#f5f3ef'
}

export default function Cursor({ enabled = true }) {
  const ref = useRef(null)
  const [mode, setMode] = useState('arrow')
  const [accent, setAccent] = useState('#f5f3ef')
  const [visible, setVisible] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [fine, setFine] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(pointer: fine)')
    const on = () => setFine(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const active = enabled && fine

  useEffect(() => {
    const root = document.documentElement
    if (!active) {
      root.classList.remove('has-cursor')
      return
    }
    root.classList.add('has-cursor')
    let frame = 0
    let last = null
    let target = null

    const paint = () => {
      frame = 0
      if (!last || !ref.current) return
      ref.current.style.transform = `translate3d(${last.x}px, ${last.y}px, 0)`
      if (target) {
        const el = target
        setMode(el.closest(TEXT) ? 'text' : el.closest(CLICKABLE) ? 'pointer' : 'arrow')
        setAccent(readAccent(el))
        target = null
      }
    }
    const move = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return
      last = { x: e.clientX, y: e.clientY }
      target = e.target instanceof Element ? e.target : null
      setVisible(true)
      if (!frame) frame = requestAnimationFrame(paint)
    }
    const leave = () => setVisible(false)
    const down = () => setPressed(true)
    const up = () => setPressed(false)

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    document.addEventListener('mouseleave', leave)
    window.addEventListener('blur', leave)
    return () => {
      cancelAnimationFrame(frame)
      root.classList.remove('has-cursor')
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      document.removeEventListener('mouseleave', leave)
      window.removeEventListener('blur', leave)
    }
  }, [active])

  if (!active) return null

  const echo = accent.toLowerCase() === '#f5f3ef' ? '#8a867f' : accent
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-[2147483647]"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 120ms' }}
    >
      {mode === 'text' ? (
        <svg width="22" height="30" viewBox="0 0 22 30" fill="none" style={{ transform: 'translate(-11px, -15px)' }}>
          <path d="M7 4c2.2 0 4 .6 4 3v16c0 2.4-1.8 3-4 3M15 4c-2.2 0-4 .6-4 3v16c0 2.4 1.8 3 4 3M8 15h6" stroke={echo} strokeWidth="3.4" strokeLinecap="round" opacity="0.35" />
          <path d="M7 4c2.2 0 4 .6 4 3v16c0 2.4-1.8 3-4 3M15 4c-2.2 0-4 .6-4 3v16c0 2.4 1.8 3 4 3M8 15h6" stroke="#f5f3ef" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ) : (
        <svg
          width="34"
          height="34"
          viewBox="0 0 34 34"
          fill="none"
          style={{
            transform: `translate(-2px, -2px) rotate(${mode === 'pointer' ? -10 : 0}deg) scale(${pressed ? 0.88 : 1})`,
            transformOrigin: '2px 2px',
            transition: 'transform 140ms cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {/* the offset "print" line in the local colour */}
          <path d={ARROW} transform={mode === 'pointer' ? 'translate(3 3)' : 'translate(2 2)'} stroke={echo} strokeWidth="1.5" strokeLinejoin="round" style={{ transition: 'stroke 160ms' }} />
          <path d={ARROW} fill="#000" stroke="#f5f3ef" strokeWidth="1.5" strokeLinejoin="round" />
          {mode === 'pointer' && (
            <g stroke={echo} strokeWidth="1.5" strokeLinecap="round" className={pressed ? 'cursor-burst' : ''} style={{ transition: 'stroke 160ms' }}>
              <path d="M18 7.5 21 5" />
              <path d="M19.5 12.5h3.4" />
              <path d="M13.2 3.6 14.2 1" />
            </g>
          )}
        </svg>
      )}
    </div>
  )
}
