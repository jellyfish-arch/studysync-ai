// Small pieces shared by the scenes.
import React from 'react'
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { C, FONT } from './theme.js'

/* ---------- outline icons (Tabler style, like the app) ---------- */
const PATHS = {
  dashboard: (
    <>
      <rect x="4" y="4" width="6" height="8" rx="1" />
      <rect x="4" y="16" width="6" height="4" rx="1" />
      <rect x="14" y="12" width="6" height="8" rx="1" />
      <rect x="14" y="4" width="6" height="4" rx="1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </>
  ),
  book: <path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0M3 6v13M12 6v13M21 6v13" />,
  route: (
    <>
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="5" r="2" />
      <path d="M12 19h4.5a3.5 3.5 0 0 0 0-7h-8a3.5 3.5 0 0 1 0-7h3.5" />
    </>
  ),
  message: <path d="M8 9h8M8 13h6M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-5l-5 3v-3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" />,
  plug: <path d="M7 12l5 5l-1.5 1.5a3.536 3.536 0 1 1-5-5zM17 12l-5-5l1.5-1.5a3.536 3.536 0 1 1 5 5zM3 21l2.5-2.5M18.5 5.5L21 3M10 11l-2 2M13 14l-2 2" />,
  phone: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <path d="M11 4h2M12 17v.01" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="9" />
    </>
  ),
}

export function Icon({ name, size = 28, color = C.ink, stroke = 1.6, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {PATHS[name]}
    </svg>
  )
}

/* ---------- background: the app's faint dot grid ---------- */
export function Dots({ opacity = 1 }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        backgroundImage: 'radial-gradient(circle at 1px 1px, #1c1c1c 1.2px, transparent 0)',
        backgroundSize: '28px 28px',
      }}
    />
  )
}

/* ---------- springs ---------- */
export function useSpring(at, { damping = 18, stiffness = 140, mass = 0.9 } = {}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - at, fps, config: { damping, stiffness, mass } })
}

/* ---------- Yuuki ---------- */
export function Yuuki({ pose, height = 260, style, bob = true }) {
  const frame = useCurrentFrame()
  const y = bob ? Math.sin(frame / 18) * 4 : 0
  return <Img src={staticFile(`yuuki/${pose}.webp`)} style={{ height, width: 'auto', transform: `translateY(${y}px)`, filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.6))', ...style }} />
}

// Typewriter text, the way Yuuki's bubbles type in the app.
export function typed(text, frame, start, perFrame = 1.7) {
  const n = Math.max(0, Math.floor((frame - start) * perFrame))
  return text.slice(0, n)
}

export function Bubble({ text, start, width = 440, size = 22, tail = 'right', style }) {
  const frame = useCurrentFrame()
  const s = useSpring(start - 4)
  const shown = typed(text, frame, start)
  return (
    <div
      style={{
        position: 'absolute',
        width,
        padding: '18px 22px 20px',
        borderRadius: 22,
        background: '#0f0f0f',
        border: `1.5px solid ${C.lineStrong}`,
        opacity: s,
        transform: `translateY(${(1 - s) * 14}px) scale(${0.96 + s * 0.04})`,
        transformOrigin: tail === 'right' ? '90% 100%' : '10% 100%',
        ...style,
      }}
    >
      <div style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: size * 0.68, color: C.mint, letterSpacing: 0.3, marginBottom: 6 }}>Yuuki</div>
      {/* the full text keeps the size steady while it types */}
      <div style={{ position: 'relative', fontFamily: FONT.sans, fontSize: size, lineHeight: 1.38, color: C.ink }}>
        <span style={{ visibility: 'hidden' }}>{text}</span>
        <span style={{ position: 'absolute', inset: 0 }}>{shown}</span>
      </div>
      <svg width="26" height="16" viewBox="0 0 26 16" style={{ position: 'absolute', bottom: -14, [tail === 'right' ? 'right' : 'left']: 46 }}>
        <path d="M1 0 L13 15 L25 0" fill="#0f0f0f" stroke={C.lineStrong} strokeWidth="1.5" />
        <rect x="0" y="-2" width="26" height="3" fill="#0f0f0f" />
      </svg>
    </div>
  )
}

/* ---------- the cursor: an outline arrow, like the app's ---------- */
export function Cursor({ x, y, accent = C.ink, clickAge = null, opacity = 1 }) {
  const ring = clickAge != null && clickAge >= 0 && clickAge < 14 ? clickAge / 14 : null
  return (
    <div style={{ position: 'absolute', left: x, top: y, opacity, pointerEvents: 'none' }}>
      {ring != null && (
        <div
          style={{
            position: 'absolute',
            left: -22 * (0.4 + ring),
            top: -22 * (0.4 + ring),
            width: 44 * (0.4 + ring),
            height: 44 * (0.4 + ring),
            borderRadius: '50%',
            border: `2.5px solid ${accent}`,
            opacity: 1 - ring,
          }}
        />
      )}
      <svg width="34" height="34" viewBox="0 0 24 24" style={{ position: 'absolute', left: -4, top: -3, transform: `scale(${ring != null && ring < 0.4 ? 0.88 : 1})`, transformOrigin: '4px 3px' }}>
        <path d="M5 3 L19 11.2 L12.6 12.9 L9.7 19.2 Z" fill="#0b0b0b" stroke={C.ink} strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M13.8 14.6 L16.6 20" stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
  )
}

/* ---------- words that rise into place (like the app's page titles) ---------- */
export function Rise({ text, at, size, color = C.ink, weight = 700, font = FONT.display, gap = 0.26, step = 3, style }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const words = text.split(' ')
  return (
    <div style={{ fontFamily: font, fontWeight: weight, fontSize: size, color, lineHeight: 1.05, letterSpacing: '-0.02em', ...style }}>
      {words.map((w, i) => {
        const s = spring({ frame: frame - at - i * step, fps, config: { damping: 20, stiffness: 160 } })
        return (
          <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', paddingBottom: '0.12em', marginRight: `${gap}em` }}>
            <span style={{ display: 'inline-block', transform: `translateY(${(1 - s) * 105}%)` }}>{w}</span>
          </span>
        )
      })}
    </div>
  )
}

export const fade = (frame, [a, b, c, d]) => interpolate(frame, [a, b, c, d], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
