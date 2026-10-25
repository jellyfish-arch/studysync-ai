// The guided tour: the app in a window on the left, a cursor clicking through
// the sidebar, the camera zooming to each feature while numbered outlines draw
// around it, and the explanation (with Yuuki) on the right.
import React from 'react'
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion'
import shotsFile from '../public/shots/shots.json'
import { C, EASE, FONT } from './theme.js'
import { PAGES, TOUR_LENGTH } from './tour.js'
import { cameraAt, framing } from './camera.js'
import { Bubble, Cursor, Icon, Rise, Yuuki, useSpring } from './parts.jsx'

const SHOTS = shotsFile.shots
const WIN = { x: 64, y: 112, w: 1300, bar: 48 }
WIN.h = Math.round((WIN.w * 900) / 1440)
const PANEL = { x: 1414, w: 446 }
const ease = Easing.bezier(...EASE)
const clamp01 = (v) => Math.min(1, Math.max(0, v))
const FULL = { x: 720, y: 450, z: 1 }
// Where the content of each long screenshot ends.
const BOTTOM = { missions: 2250, today: 1560, subject: 1360, overview: 1280 }

/* ---------- the timeline, worked out once ---------- */
const CAMERA = PAGES.flatMap((p) => [
  ...p.anns.map((a) => ({ from: p.start + a.at - 20, to: p.start + a.at + 2, x: a.cam[0], y: a.cam[1], z: a.cam[2] })),
  { from: p.end - 40, to: p.end - 16, ...FULL },
])

const SWITCHES = [{ at: 0, img: 'overview', page: 0 }]
PAGES.forEach((p, i) => {
  if (p.click) SWITCHES.push({ at: p.start + p.click.at + 3, img: p.click.img || p.img, page: i })
  if (p.click2) SWITCHES.push({ at: p.start + p.click2.at + 3, img: p.img, page: i })
})
const panelStart = (i) => (i === 0 ? 8 : PAGES[i].start + (PAGES[i].click?.at ?? 0) + 3)

const MOVES = [{ from: 28, to: 48, x: 980, y: 640 }]
const CLICKS = []
PAGES.forEach((p) => {
  for (const c of [p.click, p.click2].filter(Boolean)) {
    MOVES.push({ from: p.start + c.at - 18, to: p.start + c.at - 2, x: c.to[0], y: c.to[1] })
    CLICKS.push(p.start + c.at)
  }
  for (const a of p.anns) MOVES.push({ from: p.start + a.at - 16, to: p.start + a.at + 4, x: a.box[0] + a.box[2] * 0.82, y: a.box[1] + a.box[3] * 0.78 })
})

function pointAt(frame) {
  let cur = MOVES[0]
  for (const m of MOVES) {
    if (frame >= m.to) cur = m
    else if (frame > m.from) {
      const t = ease(clamp01((frame - m.from) / (m.to - m.from)))
      return [cur.x + (m.x - cur.x) * t, cur.y + (m.y - cur.y) * t]
    } else break
  }
  return [cur.x, cur.y]
}

/* ---------- pieces ---------- */
function Shot({ name, cam, style }) {
  const shot = SHOTS[name]
  const { k, tx, ty } = framing(cam, shot, WIN.w, WIN.h, BOTTOM[name])
  return (
    <Img
      src={staticFile(`shots/${name}.png`)}
      style={{ position: 'absolute', left: 0, top: 0, width: shot.w, height: shot.h, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${k})`, ...style }}
    />
  )
}

function Annotations({ page, frame, map }) {
  const shown = page.anns.filter((a) => frame >= page.start + a.at)
  if (!shown.length) return null
  const out = 1 - clamp01((frame - (page.end - 42)) / 16)
  const active = shown.at(-1)
  const activeAge = frame - (page.start + active.at)
  const [ax, ay, aw, ah] = map(active.box)
  const pad = 10
  return (
    <svg width={WIN.w} height={WIN.h} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
      <defs>
        <mask id={`hole-${page.key}`}>
          <rect x="-50" y="-50" width={WIN.w + 100} height={WIN.h + 100} fill="white" />
          <rect x={ax - pad} y={ay - pad} width={aw + pad * 2} height={ah + pad * 2} rx="16" fill="black" />
        </mask>
      </defs>
      {/* a soft spotlight on the newest one */}
      <rect x="0" y="0" width={WIN.w} height={WIN.h} fill="#000" opacity={0.5 * clamp01(activeAge / 12) * out} mask={`url(#hole-${page.key})`} />
      {shown.map((a, i) => {
        const [x, y, w, h] = map(a.box)
        const age = frame - (page.start + a.at)
        const d = ease(clamp01(age / 18))
        const isActive = a === active
        const pop = ease(clamp01((age - 6) / 10))
        return (
          <g key={i} opacity={(isActive ? 1 : 0.45) * out}>
            <rect x={x - pad} y={y - pad} width={w + pad * 2} height={h + pad * 2} rx="16" fill="none" stroke={page.accent} strokeWidth="3" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - d} />
            <g transform={`translate(${x - pad} ${y - pad}) scale(${pop})`}>
              <circle r="17" fill={page.accent} />
              <text textAnchor="middle" dy="6.5" fontFamily={FONT.sans} fontWeight="800" fontSize="17" fill="#000">
                {i + 1}
              </text>
            </g>
          </g>
        )
      })}
    </svg>
  )
}

function Panel({ page, index, frame }) {
  const enter = panelStart(index)
  const leave = index < PAGES.length - 1 ? panelStart(index + 1) : TOUR_LENGTH - 6
  if (frame < enter - 2 || frame > leave + 2) return null
  const inT = ease(clamp01((frame - enter) / 14))
  const outT = ease(clamp01((frame - (leave - 12)) / 12))
  const shown = page.anns.filter((a) => frame >= page.start + a.at - 4)
  const active = shown.at(-1)
  return (
    <div style={{ position: 'absolute', left: PANEL.x, top: 0, width: PANEL.w, height: 1080, opacity: inT * (1 - outT), transform: `translateY(${(1 - inT) * 24 - outT * 24}px)` }}>
      <div style={{ position: 'absolute', top: 128, width: PANEL.w, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: FONT.mono, fontSize: 18, color: page.accent, letterSpacing: 1 }}>
          <Icon name={page.icon} size={26} color={page.accent} />
          <span>{String(index + 1).padStart(2, '0')}</span>
          <span style={{ color: C.muted }}>/</span>
          <span style={{ fontFamily: FONT.sans, fontWeight: 700, fontSize: 20, letterSpacing: 0.2 }}>{page.eyebrow}</span>
        </div>
        <Rise text={page.title} at={enter + 4} size={54} style={{ marginTop: 18 }} />
        <div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {page.anns.map((a, i) => {
            const t = ease(clamp01((frame - (page.start + a.at - 4)) / 12))
            const on = a === active
            return (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', opacity: t, transform: `translateX(${(1 - t) * 18}px)` }}>
                <div
                  style={{
                    flex: '0 0 auto',
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    border: `2px solid ${page.accent}`,
                    background: on ? page.accent : 'transparent',
                    color: on ? '#000' : page.accent,
                    fontFamily: FONT.sans,
                    fontWeight: 800,
                    fontSize: 16,
                    display: 'grid',
                    placeItems: 'center',
                    marginTop: 1,
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ fontFamily: FONT.sans, fontSize: 22, lineHeight: 1.32, color: on ? C.ink : C.ink2, fontWeight: on ? 600 : 400 }}>{a.text}</div>
              </div>
            )
          })}
        </div>
      </div>
      <Bubble text={page.yuuki.line} start={Math.max(enter + 10, page.yuuki.at)} width={PANEL.w} size={20} style={{ left: 0, top: 690 }} />
      <Yuuki pose={page.yuuki.pose} height={232} style={{ position: 'absolute', right: 6, top: 822 }} />
    </div>
  )
}

/* ---------- the scene ---------- */
export function Tour() {
  const frame = useCurrentFrame()
  const pageIndex = Math.max(0, PAGES.findIndex((p) => frame >= p.start && frame < p.end))
  const page = PAGES[pageIndex]
  const cam = cameraAt(frame, FULL, CAMERA)

  // Which screenshot is showing, and the one fading out.
  const cur = [...SWITCHES].reverse().find((s) => frame >= s.at)
  const prev = SWITCHES[SWITCHES.indexOf(cur) - 1]
  const blend = ease(clamp01((frame - cur.at) / 10))
  const current = framing(cam, SHOTS[cur.img], WIN.w, WIN.h, BOTTOM[cur.img])

  // Window in and out.
  const enter = useSpring(0, { damping: 20, stiffness: 110 })
  const exit = ease(clamp01((frame - (TOUR_LENGTH - 22)) / 22))

  // Cursor.
  const [px, py] = pointAt(frame)
  const [cx, cy] = current.toScreen([px, py])
  const lastClick = [...CLICKS].reverse().find((c) => frame >= c)
  const cursorOpacity = clamp01((frame - 30) / 12) * (1 - clamp01((frame - (TOUR_LENGTH - 30)) / 10))
  const urlPage = PAGES[cur.page]
  const path = cur.img === 'overview' ? 'app' : urlPage.path

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: WIN.x,
          top: WIN.y,
          width: WIN.w,
          height: WIN.h + WIN.bar,
          borderRadius: 22,
          border: `1.5px solid ${C.lineStrong}`,
          background: C.surface,
          overflow: 'hidden',
          opacity: enter * (1 - exit),
          transform: `translateY(${(1 - enter) * 60 + exit * -30}px) scale(${0.96 + enter * 0.04 - exit * 0.04})`,
          boxShadow: '0 40px 90px -30px rgba(0,0,0,0.9)',
        }}
      >
        <div style={{ height: WIN.bar, display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', borderBottom: `1px solid ${C.line}` }}>
          <Img src={staticFile('brand/studysync-icon.webp')} style={{ width: 26, height: 26 }} />
          <div style={{ display: 'flex', alignItems: 'center', height: 30, padding: '0 14px', borderRadius: 10, background: C.surface2, border: `1px solid ${C.line}`, fontFamily: FONT.mono, fontSize: 15 }}>
            <span style={{ color: C.muted }}>studysync</span>
            <span style={{ color: C.ink2 }}>/{path}</span>
          </div>
        </div>
        <div style={{ position: 'relative', width: WIN.w, height: WIN.h, overflow: 'hidden', background: '#000' }}>
          {prev && blend < 1 && <Shot name={prev.img} cam={cam} />}
          <Shot name={cur.img} cam={cam} style={{ opacity: prev ? blend : 1, translate: `0 ${(1 - blend) * 14}px` }} />
          <Annotations page={page} frame={frame} map={current.toScreen} />
          <Cursor x={cx} y={cy} accent={page.accent} clickAge={lastClick != null ? frame - lastClick : null} opacity={cursorOpacity} />
        </div>
      </div>
      {PAGES.map((p, i) => (
        <Panel key={p.key} page={p} index={i} frame={frame} />
      ))}
    </AbsoluteFill>
  )
}
