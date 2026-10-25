import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, GraduationCap, Plus, Star, Timer } from '../../components/icons.jsx'
import { Badge, Button, Card, Empty, PageHeader, SubjectTag, cn } from '../../components/ui.jsx'
import { colorOf, useStore } from '../../lib/store.js'
import { useUI } from '../../lib/ui.js'
import { examReadiness } from '../../lib/selectors.js'
import { addMonths, formatMinutes, formatTime, fullDate, monthGrid, monthLabel, shortWeekday, todayISO } from '../../lib/dates.js'

const KINDS = [
  { key: 'exam', label: 'Exams', icon: GraduationCap, swatch: 'bg-rose' },
  { key: 'assignment', label: 'Assignments', icon: ClipboardList, swatch: 'bg-coral' },
  { key: 'block', label: 'Study blocks', icon: Timer, swatch: 'bg-mint' },
]

function itemsOn(data, date, show) {
  const items = []
  if (show.exam) for (const e of data.exams) if (e.date === date) items.push({ kind: 'exam', id: e.id, title: e.title, time: e.time, subjectId: e.subjectId, ref: e })
  if (show.assignment)
    for (const a of data.assignments) if (a.due === date) items.push({ kind: 'assignment', id: a.id, title: a.title, subjectId: a.subjectId, done: a.status === 'done', ref: a })
  if (show.block) for (const b of data.blocks) if (b.date === date) items.push({ kind: 'block', id: b.id, title: b.title, time: b.start, subjectId: b.subjectId, done: b.done, ref: b })
  return items.sort((x, y) => ['exam', 'assignment', 'block'].indexOf(x.kind) - ['exam', 'assignment', 'block'].indexOf(y.kind) || (x.time || '').localeCompare(y.time || ''))
}

export default function Calendar() {
  const data = useStore()
  const openEditor = useUI((s) => s.openEditor)
  const today = todayISO()
  const [month, setMonth] = useState(today.slice(0, 8) + '01')
  const [dir, setDir] = useState(0)
  const [selected, setSelected] = useState(today)
  const [show, setShow] = useState({ exam: true, assignment: true, block: true })
  const grid = monthGrid(month)
  const go = (n) => {
    setDir(n)
    setMonth(addMonths(month, n))
  }
  const dayItems = itemsOn(data, selected, { exam: true, assignment: true, block: true })
  const subjectColor = (id) => colorOf(data.subjects.find((s) => s.id === id)?.color)

  return (
    <>
      <PageHeader
        eyebrowIcon={CalendarDays}
        title="Calendar"
        sub="Exams, assignment deadlines and study blocks in one month view."
        actions={
          <>
            <Button variant="outline" onClick={() => openEditor('assignment', null, { due: selected })}>
              <Plus /> Assignment
            </Button>
            <Button variant="primary" onClick={() => openEditor('exam', null, { date: selected })}>
              <Plus /> Exam
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="overflow-hidden xl:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => go(-1)} aria-label="Previous month">
                <ChevronLeft />
              </Button>
              <AnimatePresence mode="wait" initial={false}>
                <motion.h2
                  key={month}
                  initial={{ opacity: 0, y: dir * 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: dir * -8 }}
                  className="min-w-44 text-center font-display text-xl font-bold text-ink"
                >
                  {monthLabel(month)}
                </motion.h2>
              </AnimatePresence>
              <Button variant="outline" size="icon" onClick={() => go(1)} aria-label="Next month">
                <ChevronRight />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMonth(today.slice(0, 8) + '01')
                  setSelected(today)
                }}
              >
                Today
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((k) => (
                <button
                  key={k.key}
                  onClick={() => setShow({ ...show, [k.key]: !show[k.key] })}
                  aria-pressed={show[k.key]}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.75rem] font-semibold transition-all',
                    show[k.key] ? 'border-line-strong bg-surface text-ink' : 'border-transparent bg-surface-2 text-muted line-through',
                  )}
                >
                  <span className={cn('size-2 rounded-full', k.swatch)} />
                  {k.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-line bg-surface-2 text-center text-[0.72rem] font-semibold text-muted">
            {grid.slice(0, 7).map((d) => shortWeekday(d)).map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={month}
              initial={{ opacity: 0, x: dir * 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -30 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-7"
            >
              {grid.map((date, i) => {
                const inMonth = date.slice(0, 7) === month.slice(0, 7)
                const items = itemsOn(data, date, show)
                const isToday = date === today
                const isSel = date === selected
                const hasExam = items.some((x) => x.kind === 'exam')
                return (
                  <motion.button
                    key={date}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.008, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    onClick={() => setSelected(date)}
                    className={cn(
                      'relative flex min-h-[5.6rem] flex-col gap-1 border-line p-1.5 text-left transition-colors sm:min-h-[6.6rem] sm:p-2',
                      i % 7 !== 6 && 'border-r',
                      i < 35 && 'border-b',
                      !inMonth && 'bg-surface-2/60',
                      isSel ? 'bg-primary-soft' : 'hover:bg-surface-2',
                    )}
                  >
                    {isSel && <motion.span layoutId="cal-sel" className="absolute inset-0 border-2 border-primary" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                    <span
                      className={cn(
                        'num relative grid size-7 place-items-center rounded-full text-[0.8rem] font-semibold',
                        isToday ? 'bg-primary text-on-primary' : inMonth ? 'text-ink' : 'text-muted/60',
                      )}
                    >
                      {Number(date.slice(8))}
                    </span>
                    {hasExam && <span className="absolute top-2.5 right-2.5 size-2 animate-pulse rounded-full bg-rose" />}
                    <span className="relative hidden flex-col gap-0.5 sm:flex">
                      {items.slice(0, 3).map((it) => (
                        <span
                          key={`${it.kind}-${it.id}`}
                          className={cn(
                            'truncate rounded-md px-1.5 py-0.5 text-[0.68rem] font-semibold',
                            it.kind === 'exam' ? 'border border-rose/50 text-rose' : 'sc-soft',
                            it.done && 'line-through opacity-60',
                          )}
                          style={{ '--c': subjectColor(it.subjectId) }}
                        >
                          {it.kind === 'exam' ? <Star className="mr-1 inline size-3 align-[-2px]" /> : it.time ? `${formatTime(it.time).replace(':00', '')} ` : ''}
                          {it.title}
                        </span>
                      ))}
                      {items.length > 3 && <span className="px-1 text-[0.66rem] font-semibold text-muted">+{items.length - 3} more</span>}
                    </span>
                    <span className="relative flex gap-0.5 sm:hidden">
                      {items.slice(0, 4).map((it) => (
                        <span key={`${it.kind}-${it.id}`} className="size-1.5 rounded-full" style={{ background: it.kind === 'exam' ? 'var(--rose)' : subjectColor(it.subjectId) }} />
                      ))}
                    </span>
                  </motion.button>
                )
              })}
            </motion.div>
          </AnimatePresence>
        </Card>

        <Card className="p-5 sm:p-6 xl:col-span-4">
          <AnimatePresence mode="wait">
            <motion.div key={selected} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
              <p className="text-[0.78rem] font-semibold text-primary">{selected === today ? 'Today' : 'Selected day'}</p>
              <h2 className="mt-0.5 font-display text-xl font-bold text-ink">{fullDate(selected)}</h2>
              {dayItems.length === 0 ? (
                <Empty compact pose="read" className="mt-5" title="A free day" text="Nothing on this day yet. Add something below." />
              ) : (
                <ul className="mt-5 space-y-2.5">
                  {dayItems.map((it, i) => {
                    const K = KINDS.find((k) => k.key === it.kind)
                    return (
                      <motion.li key={`${it.kind}-${it.id}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                        <button
                          onClick={() => openEditor(it.kind, it.ref)}
                          className={cn(
                            'w-full rounded-2xl border p-3.5 text-left transition-colors hover:border-primary/50',
                            it.kind === 'exam' ? 'border-rose/30 bg-[color-mix(in_srgb,var(--rose)_10%,#000)]' : 'border-line bg-surface',
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-[0.72rem] font-semibold text-muted">
                              <K.icon className="size-3.5" /> {K.label.replace(/s$/, '')}
                              {it.time && ` · ${formatTime(it.time)}`}
                            </span>
                            {it.kind === 'exam' && <Badge tone="bad">{examReadiness(data, it.ref).pct}% ready</Badge>}
                            {it.kind === 'block' && <Badge>{formatMinutes(it.ref.minutes)}</Badge>}
                            {it.done && <Badge tone="good">Done</Badge>}
                          </div>
                          <p className={cn('mt-1.5 font-semibold text-ink', it.done && 'line-through opacity-70')}>{it.title}</p>
                          <div className="mt-2">
                            <SubjectTag subjectId={it.subjectId} />
                          </div>
                        </button>
                      </motion.li>
                    )
                  })}
                </ul>
              )}
              <div className="mt-6 grid grid-cols-3 gap-2">
                {[
                  ['exam', 'Exam', { date: selected }],
                  ['assignment', 'Task', { due: selected }],
                  ['block', 'Block', { date: selected }],
                ].map(([type, label, defaults]) => (
                  <Button key={type} variant="outline" size="sm" onClick={() => openEditor(type, null, defaults)}>
                    <Plus /> {label}
                  </Button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </Card>
      </div>
    </>
  )
}
