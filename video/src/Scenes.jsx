// The scenes around the tour: opening title, Yuuki's hello, phones, closing.
import React from 'react'
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { C, FONT } from './theme.js'
import { Rise, Yuuki, fade, typed, useSpring } from './parts.jsx'

const out = (frame, start, len = 16) => 1 - interpolate(frame, [start, start + len], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

/* ---------- 1. Title ---------- */
export function Title() {
  const frame = useCurrentFrame()
  const logo = useSpring(4, { damping: 14, stiffness: 120 })
  const tag = useSpring(34)
  const o = out(frame, 104)
  const legend = [
    ['Syllabus', C.gold],
    ['Exams', C.rose],
    ['Assignments', C.coral],
    ['Study time', C.lime],
  ]
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: o, transform: `translateY(${(1 - o) * -20}px)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 34 }}>
        <Img src={staticFile('brand/studysync-icon.webp')} style={{ width: 150, height: 150, opacity: logo, transform: `scale(${0.6 + logo * 0.4}) rotate(${(1 - logo) * -12}deg)` }} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <Rise text="StudySync" at={12} size={140} step={0} />
          <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 52, color: C.muted, opacity: fade(frame, [22, 32, 200, 201]) }}>AI</span>
        </div>
      </div>
      <div style={{ marginTop: 30, fontFamily: FONT.sans, fontSize: 36, color: C.ink2, opacity: tag, transform: `translateY(${(1 - tag) * 16}px)` }}>Your syllabus, exams, assignments and study time, in one place.</div>
      <div style={{ marginTop: 34, display: 'flex', gap: 40 }}>
        {legend.map(([label, color], i) => {
          const s = useSpring(50 + i * 6)
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: s, transform: `translateY(${(1 - s) * 12}px)`, fontFamily: FONT.sans, fontSize: 26, color: C.ink2 }}>
              <span style={{ width: 12, height: 12, borderRadius: 6, background: color }} />
              {label}
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

/* ---------- 2. Yuuki says hello ---------- */
export function Hello() {
  const frame = useCurrentFrame()
  const yuuki = useSpring(2, { damping: 16, stiffness: 90 })
  const eyebrow = useSpring(6)
  const o = out(frame, 106, 14)
  const line = 'Your study companion inside StudySync. Let me show you around!'
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <div style={{ position: 'absolute', left: 170, top: 300, width: 900 }}>
        <div style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: 26, color: C.mint, letterSpacing: 0.4, opacity: eyebrow, transform: `translateY(${(1 - eyebrow) * 10}px)` }}>Meet your study companion</div>
        <Rise text="Hi! I’m Yuuki." at={10} size={120} style={{ marginTop: 18 }} />
        <div style={{ marginTop: 26, position: 'relative', fontFamily: FONT.sans, fontSize: 40, lineHeight: 1.35, color: C.ink2 }}>
          <span style={{ visibility: 'hidden' }}>{line}</span>
          <span style={{ position: 'absolute', inset: 0 }}>{typed(line, frame, 30, 2.2)}</span>
        </div>
      </div>
      <Yuuki pose="wave" height={780} style={{ position: 'absolute', right: 170, top: 170, opacity: yuuki, transform: `translateX(${(1 - yuuki) * 260}px) translateY(${Math.sin(frame / 18) * 5}px)` }} bob={false} />
    </AbsoluteFill>
  )
}

/* ---------- 3. On your phone ---------- */
function Phone({ name, at, x }) {
  const s = useSpring(at, { damping: 18, stiffness: 100 })
  const scale = 0.84
  const w = 390 * scale
  const h = 844 * scale
  return (
    <div style={{ position: 'absolute', left: x, top: 236, width: w + 20, height: h + 20, borderRadius: 56, border: `2px solid ${C.lineStrong}`, background: C.surface, padding: 10, opacity: s, transform: `translateY(${(1 - s) * 140}px)` }}>
      <div style={{ width: w, height: h, borderRadius: 46, overflow: 'hidden', background: '#000' }}>
        <Img src={staticFile(`shots/${name}.png`)} style={{ width: w, height: h }} />
      </div>
    </div>
  )
}

export function Phones() {
  const frame = useCurrentFrame()
  const sub = useSpring(18)
  const o = out(frame, 106, 14)
  const w = 390 * 0.84 + 20
  const gap = 70
  const left = (1920 - (w * 3 + gap * 2)) / 2
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <div style={{ position: 'absolute', top: 70, width: '100%', textAlign: 'center' }}>
        <Rise text="Made for your phone, too." at={4} size={70} style={{ display: 'inline-block' }} />
        <div style={{ marginTop: 10, fontFamily: FONT.sans, fontSize: 30, color: C.ink2, opacity: sub }}>Add it to your home screen and it opens like an app.</div>
      </div>
      <Phone name="m-overview" at={10} x={left} />
      <Phone name="m-today" at={16} x={left + w + gap} />
      <Phone name="m-chat" at={22} x={left + (w + gap) * 2} />
    </AbsoluteFill>
  )
}

/* ---------- 4. Closing ---------- */
export function Outro() {
  const frame = useCurrentFrame()
  const yuuki = useSpring(4, { damping: 15, stiffness: 90 })
  const logo = useSpring(2)
  const end = out(frame, 106, 14)
  const lines = [
    ['Track every topic.', C.gold],
    ['Plan what actually fits.', C.orange],
    ['Study with Yuuki.', C.mint],
  ]
  return (
    <AbsoluteFill style={{ opacity: end }}>
      <div style={{ position: 'absolute', left: 170, top: 250 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, opacity: logo, transform: `translateY(${(1 - logo) * 12}px)` }}>
          <Img src={staticFile('brand/studysync-icon.webp')} style={{ width: 76, height: 76 }} />
          <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 64, color: C.ink, letterSpacing: '-0.02em' }}>StudySync</span>
          <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 28, color: C.muted, marginTop: 14 }}>AI</span>
        </div>
        <div style={{ marginTop: 44, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lines.map(([t, color], i) => (
            <Rise key={t} text={t} at={18 + i * 12} size={78} color={color} />
          ))}
        </div>
        <div style={{ marginTop: 40, fontFamily: FONT.sans, fontSize: 30, color: C.ink2, opacity: fade(frame, [62, 74, 400, 401]) }}>Free to start. Built for college students.</div>
      </div>
      <Yuuki pose="cheer" height={700} style={{ position: 'absolute', right: 190, top: 200, opacity: yuuki, transform: `translateY(${(1 - yuuki) * 120}px)` }} />
    </AbsoluteFill>
  )
}
