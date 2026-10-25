import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarCheck2, CalendarRange, ChevronLeft, ChevronRight, Check, Clock, GripVertical, Plus, Target, Timer } from '../../components/icons.jsx'
import { Button, Card, Count, Duration, Empty, PageHeader, cn, sparkAt, useToast } from '../../components/ui.jsx'
import { useCompleteBlock } from '../../components/blocks.jsx'
import { colorOf, useStore } from '../../lib/store.js'
import { useUI } from '../../lib/ui.js'
import { blocksOn, minutesOn } from '../../lib/selectors.js'
import { addDays, formatMinutes, formatTime, shortDate, todayISO, weekDays, weekStart } from '../../lib/dates.js'

function BlockCard({ block, onDragStart }) {
  const subject = useStore((s) => s.subjects.find((x) => x.id === block.subjectId))
  const openEditor = useUI((s) => s.openEditor)
  const toggle = useCompleteBlock()
  const color = colorOf(subject?.color)
  return (
    <motion.div
      layout
      layoutId={block.id}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      draggable
      onDragStart={(e) => onDragStart(e, block)}
      className={cn('tint group relative rounded-xl border border-line bg-surface p-2.5 transition-colors hover:border-[color-mix(in_srgb,var(--accent)_40%,var(--line-strong))]', block.done && 'opacity-60')}
      style={{ '--c': color, '--accent': color }}
    >
      <span className="sc-bg absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-r-full" />
      <div className="flex items-start gap-1.5 pl-1.5">
        <button
          onClick={(e) => {
            if (!block.done) sparkAt(e.currentTarget, color)
            toggle(block)
          }}
          className={cn(
            'tap mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-md border-[1.5px] transition-colors',
            block.done ? 'border-primary bg-primary text-on-primary' : 'border-line-strong hover:border-primary',
          )}
          aria-label={block.done ? `Mark ${block.title} as not done` : `Mark ${block.title} as done`}
        >
          {block.done && <Check className="size-3" strokeWidth={3.5} />}
        </button>
        <button onClick={() => openEditor('block', block)} className="min-w-0 flex-1 text-left">
          <p className="num font-mono text-[0.68rem] font-semibold text-muted">
            {formatTime(block.start)} · {formatMinutes(block.minutes)}
          </p>
          <p className={cn('mt-0.5 text-[0.8rem] leading-snug font-semibold text-ink', block.done && 'line-through')}>{block.title}</p>
          <p className="sc-text mt-1 truncate text-[0.7rem] font-semibold">{subject?.code || subject?.name}</p>
        </button>
        <GripVertical className="hover-only size-3.5 shrink-0 text-muted opacity-0 group-hover:opacity-100" />
      </div>
    </motion.div>
  )
}

export default function Planner() {
  const data = useStore()
  const update = useStore((s) => s.updateBlock)
  const openEditor = useUI((s) => s.openEditor)
  const toast = useToast()
  const today = todayISO()
  const [start, setStart] = useState(weekStart(today))
  const [dir, setDir] = useState(0)
  const [over, setOver] = useState(null)
  const days = weekDays(start)
  const weekBlocks = data.blocks.filter((b) => days.includes(b.date))
  const planned = weekBlocks.reduce((s, b) => s + b.minutes, 0)
  const doneMin = weekBlocks.filter((b) => b.done).reduce((s, b) => s + b.minutes, 0)
  const studied = days.reduce((s, d) => s + minutesOn(data, d), 0)

  const move = (n) => {
    setDir(n)
    setStart(addDays(start, n * 7))
  }

  const onDragStart = (e, block) => {
    e.dataTransfer.setData('text/plain', block.id)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDrop = (e, date) => {
    e.preventDefault()
    setOver(null)
    const id = e.dataTransfer.getData('text/plain')
    const block = data.blocks.find((b) => b.id === id)
    if (block && block.date !== date) {
      update(id, { date })
      toast(`Moved to ${shortDate(date)}`)
    }
  }

  return (
    <>
      <PageHeader
        eyebrowIcon={CalendarRange}
        title="Study planner"
        sub="Plan your week in blocks. Drag a block to another day to reschedule it."
        actions={
          <Button variant="primary" data-tour="add-block" onClick={() => openEditor('block')}>
            <Plus /> Plan a block
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Planned this week', <Duration minutes={planned} />, Timer, 'var(--mint)'],
          ['Blocks completed', <><Count value={weekBlocks.filter((b) => b.done).length} /> / {weekBlocks.length}</>, CalendarCheck2, 'var(--lime)'],
          ['Time studied', <Duration minutes={studied} />, Clock, 'var(--teal)'],
          ['Plan followed', <><Count value={planned ? Math.round((doneMin / planned) * 100) : 0} />%</>, Target, 'var(--gold)'],
        ].map(([label, value, Icon, color], i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card accent={color} className="draw p-4">
              <p className="flex items-center gap-1.5 text-[0.78rem] font-medium text-muted">
                <Icon className="size-4" style={{ color }} />
                {label}
              </p>
              <p className="num mt-1 font-display text-2xl font-bold text-ink">{value}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {data.blocks.length === 0 && (
        <Empty compact pose="clipboard" className="mb-5" title="Your week is a blank page" text="Plan a block: a subject, a time and how long. Drag it to another day if plans change." />
      )}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-bold text-ink">
            {shortDate(days[0])} to {shortDate(days[6])}
          </h2>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" onClick={() => move(-1)} aria-label="Previous week">
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStart(weekStart(today))} disabled={start === weekStart(today)}>
              This week
            </Button>
            <Button variant="outline" size="icon" onClick={() => move(1)} aria-label="Next week">
              <ChevronRight />
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={start}
              custom={dir}
              initial={{ opacity: 0, x: dir * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -40 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="grid min-w-[980px] grid-cols-7 divide-x divide-line"
            >
              {days.map((date, di) => {
                const list = blocksOn(data, date)
                const total = list.reduce((s, b) => s + b.minutes, 0)
                const isToday = date === today
                const past = date < today
                return (
                  <motion.div
                    key={date}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: di * 0.05, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setOver(date)
                    }}
                    onDragLeave={() => setOver((o) => (o === date ? null : o))}
                    onDrop={(e) => onDrop(e, date)}
                    className={cn('flex min-h-[26rem] flex-col transition-colors', isToday && 'bg-primary-soft/40', over === date && 'bg-primary-soft')}
                  >
                    <div className={cn('border-b border-line px-3 py-3', past && 'opacity-60')}>
                      <p className={cn('text-[0.75rem] font-semibold', isToday ? 'text-primary' : 'text-muted')}>
                        {new Date(date + 'T00:00').toLocaleDateString('en-IN', { weekday: 'short' })}
                        {isToday && ' · Today'}
                      </p>
                      <div className="flex items-baseline justify-between">
                        <p className={cn('num font-display text-2xl font-bold', isToday ? 'text-primary' : 'text-ink')}>{date.slice(8)}</p>
                        <p className="num font-mono text-[0.7rem] text-muted">{total ? formatMinutes(total) : ''}</p>
                      </div>
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-2">
                      <AnimatePresence>
                        {list.map((b) => (
                          <BlockCard key={b.id} block={b} onDragStart={onDragStart} />
                        ))}
                      </AnimatePresence>
                      <button
                        onClick={() => openEditor('block', null, { date })}
                        className="mt-auto flex items-center justify-center gap-1 rounded-xl border border-dashed border-line-strong py-2 text-[0.75rem] font-semibold text-muted opacity-70 transition-all hover:border-primary hover:text-primary hover:opacity-100"
                      >
                        <Plus className="size-3.5" /> Add
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </Card>
    </>
  )
}
