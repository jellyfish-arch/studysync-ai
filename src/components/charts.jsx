import { useRef, useState } from 'react'
import { motion, useInView } from 'motion/react'
import { addDays, formatDay, formatMinutes, shortDate, shortWeekday, todayISO, weekStart } from '../lib/dates.js'
import { colorOf } from '../lib/store.js'
import { cn } from './ui.jsx'

// Bars per day: studied (solid) against planned (ghost). One axis, minutes.
export function DayBars({ days, height = 170, showPlanned = true, goal }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const [hover, setHover] = useState(null)
  const today = todayISO()
  const max = Math.max(60, goal || 0, ...days.map((d) => Math.max(d.minutes, showPlanned ? d.planned || 0 : 0)))
  const dense = days.length > 14
  return (
    <div ref={ref}>
      <div className="relative flex items-end gap-[3px]" style={{ height }} onMouseLeave={() => setHover(null)}>
        {goal ? (
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-primary/45" style={{ bottom: `${(goal / max) * 100}%` }}>
            <span className="absolute -top-5 right-0 rounded bg-surface px-1 text-[0.65rem] font-semibold text-primary">Goal {formatMinutes(goal)}</span>
          </div>
        ) : null}
        {days.map((d, i) => {
          const isToday = d.date === today
          return (
            <button
              key={d.date}
              type="button"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${formatDay(d.date)}: ${formatMinutes(d.minutes)} studied${showPlanned && d.planned ? `, ${formatMinutes(d.planned)} planned` : ''}`}
              className={cn('group relative flex h-full flex-1 items-end justify-center rounded-lg', hover === i && 'bg-surface-2')}
            >
              {showPlanned && d.planned > 0 && (
                <motion.span
                  className="absolute bottom-0 w-[64%] max-w-9 rounded-t-md bg-surface-3"
                  initial={{ height: 0 }}
                  animate={{ height: inView ? `${(d.planned / max) * 100}%` : 0 }}
                  transition={{ duration: 0.9, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              <motion.span
                className={cn('relative w-[64%] max-w-9 rounded-t-md', dense && 'w-[78%]')}
                style={{ background: 'var(--primary)', opacity: isToday ? 1 : 0.6 }}
                initial={{ height: 0 }}
                animate={{ height: inView ? `${(d.minutes / max) * 100}%` : 0 }}
                transition={{ duration: 1, delay: 0.1 + i * 0.04, ease: [0.16, 1, 0.3, 1] }}
              />
              {hover === i && (
                <motion.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="pointer-events-none absolute bottom-[calc(100%+6px)] z-10 rounded-lg bg-ink px-2.5 py-1.5 text-left text-[0.72rem] whitespace-nowrap text-bg shadow-float"
                >
                  <span className="block font-semibold">{formatDay(d.date)}</span>
                  <span className="num block">{formatMinutes(d.minutes)} studied</span>
                  {showPlanned && d.planned > 0 && <span className="num block opacity-70">{formatMinutes(d.planned)} planned</span>}
                </motion.span>
              )}
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex gap-[3px]">
        {days.map((d, i) => (
          <span key={d.date} className={cn('flex-1 text-center text-[0.7rem] text-muted', d.date === today && 'font-bold text-ink')}>
            {d.date === today ? (dense ? '' : 'Today') : dense ? ((days.length - 1 - i) % 5 === 0 ? shortDate(d.date) : '') : shortWeekday(d.date)}
          </span>
        ))}
      </div>
      {showPlanned && (
        <div className="mt-3 flex items-center gap-4 text-[0.75rem] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary" /> Studied
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-surface-3" /> Planned
          </span>
        </div>
      )}
    </div>
  )
}

// Contribution-style heatmap: one square per day, 7 rows (Mon-Sun).
export function Heatmap({ sessions, weeks = 18 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const [hover, setHover] = useState(null)
  const today = todayISO()
  const start = addDays(weekStart(today), -(weeks - 1) * 7)
  const totals = {}
  for (const s of sessions) totals[s.date] = (totals[s.date] || 0) + s.minutes
  const level = (m) => (m === 0 ? 0 : m < 45 ? 1 : m < 90 ? 2 : m < 150 ? 3 : 4)
  const cols = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)))
  return (
    <div ref={ref} className="relative">
      <div className="flex gap-[4px] overflow-x-auto pb-1">
        {cols.map((col, w) => (
          <div key={w} className="flex flex-col gap-[4px]">
            {col.map((date, d) => {
              const future = date > today
              const m = totals[date] || 0
              const lv = level(m)
              return (
                <motion.span
                  key={date}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={inView ? { scale: 1, opacity: future ? 0.25 : 1 } : {}}
                  transition={{ delay: (w * 7 + d) * 0.004, type: 'spring', stiffness: 300, damping: 20 }}
                  onMouseEnter={() => !future && setHover({ date, m })}
                  onMouseLeave={() => setHover(null)}
                  className={cn('size-[13px] rounded-[4px]', date === today && 'ring-2 ring-primary/60 ring-offset-1 ring-offset-surface')}
                  style={{
                    background: lv === 0 ? 'var(--surface-3)' : `color-mix(in srgb, var(--primary) ${[0, 30, 55, 78, 100][lv]}%, var(--surface-2))`,
                  }}
                  aria-hidden="true"
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-[0.72rem] text-muted">
        <span className="num h-4">{hover ? `${formatDay(hover.date)}: ${formatMinutes(hover.m)}` : `Last ${weeks} weeks`}</span>
        <span className="flex items-center gap-1">
          Less
          {[0, 1, 2, 3, 4].map((lv) => (
            <span
              key={lv}
              className="size-[11px] rounded-[3px]"
              style={{ background: lv === 0 ? 'var(--surface-3)' : `color-mix(in srgb, var(--primary) ${[0, 30, 55, 78, 100][lv]}%, var(--surface-2))` }}
            />
          ))}
          More
        </span>
      </div>
    </div>
  )
}

// Donut of time per subject with a labelled legend (identity never by colour alone).
export function SubjectDonut({ rows, size = 180 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const total = rows.reduce((s, r) => s + r.minutes, 0)
  const r = size / 2 - 14
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div ref={ref} className="flex flex-col items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="22" />
          {total > 0 &&
            rows.map((row, i) => {
              const len = (row.minutes / total) * c
              const seg = (
                <motion.circle
                  key={row.id}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={colorOf(row.color)}
                  strokeWidth="22"
                  strokeDasharray={`${Math.max(0, len - 3)} ${c}`}
                  initial={{ strokeDashoffset: c, opacity: 0 }}
                  animate={inView ? { strokeDashoffset: -offset, opacity: 1 } : {}}
                  transition={{ duration: 1.1, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                />
              )
              offset += len
              return seg
            })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="num font-display text-2xl font-bold text-ink">{formatMinutes(total)}</p>
            <p className="text-[0.72rem] text-muted">total</p>
          </div>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-3 text-sm">
            <span className="size-3 shrink-0 rounded-[4px]" style={{ background: colorOf(row.color) }} />
            <span className="min-w-0 flex-1 truncate text-ink-2">{row.name}</span>
            <span className="num text-[0.8rem] font-semibold text-ink">{formatMinutes(row.minutes)}</span>
            <span className="num w-10 text-right text-[0.75rem] text-muted">{total ? Math.round((row.minutes / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
