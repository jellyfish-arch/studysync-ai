import { AnimatePresence, motion } from 'motion/react'
import { CalendarCheck2, Clock, ListChecks, Play, Plus, Trash2, Zap } from '../../components/icons.jsx'
import { Badge, Button, Card, CardHeader, Count, Duration, Empty, PageHeader, Ring, Stagger, SubjectTag, cn, useUndo } from '../../components/ui.jsx'
import { BlockRow, checkProps, sparkFromFocus } from '../../components/blocks.jsx'
import SpringCheck from '../../components/rb/SpringCheck/SpringCheck.jsx'
import { ReviseCard } from '../../components/revision.jsx'
import { colorOf, useStore } from '../../lib/store.js'
import { useUI } from '../../lib/ui.js'
import { blocksOn, minutesOn, nextPriority } from '../../lib/selectors.js'
import { addDays, addMinutesToTime, daysBetween, formatMinutes, formatTime, fullDate, nowHHMM, relativeDays, todayISO } from '../../lib/dates.js'

function Summary({ data }) {
  const today = todayISO()
  const todays = blocksOn(data, today)
  const done = todays.filter((b) => b.done)
  const planned = todays.reduce((s, b) => s + b.minutes, 0)
  const left = todays.filter((b) => !b.done).reduce((s, b) => s + b.minutes, 0)
  const studied = minutesOn(data, today)
  const pctDone = todays.length ? Math.round((done.length / todays.length) * 100) : 0
  return (
    <Card accent="var(--lime)" className="dots p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-6">
        <Ring value={pctDone} size={92} stroke={9}>
          <span className="num font-display text-xl font-bold text-ink">
            <Count value={pctDone} />%
          </span>
        </Ring>
        <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ['Blocks done', <><Count value={done.length} /> <span className="text-base text-muted">/ {todays.length}</span></>],
            ['Studied today', <Duration minutes={studied} />],
            ['Planned', <Duration minutes={planned} />],
            ['Still to go', <Duration minutes={left} />],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[0.78rem] font-medium text-muted">{label}</p>
              <p className="num mt-0.5 font-display text-2xl font-bold text-ink">{value}</p>
            </div>
          ))}
        </div>
      </div>
      {todays.length > 0 && (
        <div className="mt-5 flex gap-1.5" aria-hidden="true">
          {todays.map((b) => (
            <span key={b.id} className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3" style={{ flexGrow: b.minutes }}>
              <motion.span
                className="block h-full rounded-full"
                style={{ background: colorOf(data.subjects.find((s) => s.id === b.subjectId)?.color) }}
                initial={{ width: 0 }}
                animate={{ width: b.done ? '100%' : 0 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              />
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}

function Spotlight({ data }) {
  const p = nextPriority(data)
  const timer = useStore((s) => s.timer)
  const start = useStore((s) => s.startTimer)
  const setFocusOpen = useUI((s) => s.setFocusOpen)
  const openEditor = useUI((s) => s.openEditor)
  if (!p) {
    return (
      <Card accent="var(--lime)" className="p-6">
        <Empty compact pose="thumbs" title="Nothing pressing" text="No blocks left, no overdue work. Plan tomorrow or start a free focus session." action={<Button variant="primary" size="sm" onClick={() => openEditor('focus')}><Zap /> Free focus</Button>} />
      </Card>
    )
  }
  const subject = data.subjects.find((s) => s.id === p.subjectId)
  const color = colorOf(subject?.color)
  const minutes = p.kind === 'block' ? p.block.minutes : 45
  const now = nowHHMM()
  const startsIn = p.kind === 'block' && p.block.start > now ? p.block.start : null
  return (
    <Card accent={color} className="overflow-hidden">
      <div className="relative p-6 text-black" style={{ background: color }}>
        <p className="relative text-[0.78rem] font-semibold text-black/65">{p.kind === 'block' ? 'Your next block' : p.kind === 'assignment' ? 'Most urgent assignment' : 'Next topic for your exam'}</p>
        <h2 className="relative mt-2 text-2xl leading-tight font-bold">{p.title}</h2>
        <p className="relative mt-2 text-sm text-black/70">{subject?.name}</p>
        <div className="relative mt-5 flex flex-wrap gap-2 text-[0.8rem] font-semibold">
          {p.kind === 'block' && (
            <span className="rounded-lg bg-black/12 px-2.5 py-1">
              {formatTime(p.block.start)} to {formatTime(addMinutesToTime(p.block.start, p.block.minutes))}
            </span>
          )}
          {p.kind === 'assignment' && <span className="rounded-lg bg-black/12 px-2.5 py-1">Due {relativeDays(p.assignment.due)}</span>}
          {p.kind === 'topic' && <span className="rounded-lg bg-black/12 px-2.5 py-1">{p.exam.title}, {relativeDays(p.exam.date)}</span>}
          {startsIn && <span className="rounded-lg bg-black/12 px-2.5 py-1">Starts at {formatTime(startsIn)}</span>}
        </div>
      </div>
      <div className="space-y-3 p-5">
        {!timer ? (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => {
              start({ subjectId: p.subjectId, blockId: p.kind === 'block' ? p.block.id : null, title: p.title, planned: minutes })
              setFocusOpen(true)
            }}
          >
            <Play /> Start {formatMinutes(minutes)} focus session
          </Button>
        ) : (
          <Button variant="soft" size="lg" className="w-full" onClick={() => setFocusOpen(true)}>
            A session is running. Open it.
          </Button>
        )}
        <p className="text-center text-[0.78rem] text-muted">Full-screen timer. The time is saved to your log when you finish.</p>
      </div>
    </Card>
  )
}

function DueSoon({ data }) {
  const today = todayISO()
  const update = useStore((s) => s.updateAssignment)
  const items = data.assignments
    .filter((a) => a.status !== 'done' && a.due <= addDays(today, 2))
    .sort((a, b) => a.due.localeCompare(b.due))
  return (
    <Card accent="var(--coral)" className="p-5">
      <CardHeader title="Due soon" icon={ListChecks} sub="Overdue, today and the next two days" />
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nothing due in the next two days.</p>
      ) : (
        <ul className="mt-3 space-y-1">
          <AnimatePresence initial={false}>
            {items.map((a) => {
              const d = daysBetween(today, a.due)
              return (
                <motion.li key={a.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="rounded-xl px-1 py-1 hover:bg-surface-2">
                  <SpringCheck
                    key={`${a.id}-${a.status}`}
                    label={a.title}
                    defaultChecked={false}
                    onChange={() => {
                      sparkFromFocus('#ff6b5b')
                      setTimeout(() => update(a.id, { status: 'done' }), 450)
                    }}
                    className="topic-check"
                    {...checkProps}
                  />
                  <div className="flex items-center gap-2 pb-1 pl-[34px]">
                    <SubjectTag subjectId={a.subjectId} short />
                    <span className={cn('text-[0.75rem] font-semibold', d < 0 ? 'text-danger' : d === 0 ? 'text-warning' : 'text-muted')}>
                      {d < 0 ? `${-d}d overdue` : d === 0 ? 'Due today' : `Due ${relativeDays(a.due)}`}
                    </span>
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  )
}

function Sessions({ data }) {
  const today = todayISO()
  const remove = useStore((s) => s.deleteSession)
  const undo = useUndo()
  const list = data.sessions.filter((s) => s.date === today)
  return (
    <Card accent="var(--lime)" className="p-5">
      <CardHeader title="Logged today" icon={Clock} sub={`${list.length} session${list.length === 1 ? '' : 's'}`} />
      {list.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Finish a focus session or tick a block to log time.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {list.map((s) => (
            <li key={s.id} className="group flex items-center gap-3 py-2.5">
              <span className="size-2 shrink-0 rounded-full" style={{ background: colorOf(data.subjects.find((x) => x.id === s.subjectId)?.color) }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{s.note || data.subjects.find((x) => x.id === s.subjectId)?.name}</span>
              </span>
              <Badge>{formatMinutes(s.minutes)}</Badge>
              {!s.blockId && (
                <button className="rounded-lg p-1 text-muted opacity-0 group-hover:opacity-100 hover:text-danger" onClick={() => undo('Session removed', () => remove(s.id))} aria-label="Remove session">
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export default function Today() {
  const data = useStore()
  const openEditor = useUI((s) => s.openEditor)
  const today = todayISO()
  const todays = blocksOn(data, today)
  return (
    <>
      <PageHeader
        eyebrowIcon={CalendarCheck2}
        title="Today"
        sub={fullDate(today)}
        actions={
          <>
            <Button variant="outline" onClick={() => openEditor('log')}>
              <Clock /> Log time
            </Button>
            <Button variant="primary" onClick={() => openEditor('block', null, { date: today })}>
              <Plus /> Add block
            </Button>
          </>
        }
      />
      <Stagger className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <Summary data={data} />
          <Card accent="var(--lime)" className="p-5 sm:p-6">
            <CardHeader title="Focus queue" icon={ListChecks} sub="Tick a block when it’s done, or start it as a timed session." />
            {todays.length ? (
              <ul className="mt-4 space-y-2">
                <AnimatePresence initial={false}>
                  {todays.map((b, i) => (
                    <BlockRow key={b.id} block={b} index={i} />
                  ))}
                </AnimatePresence>
              </ul>
            ) : (
              <Empty
                className="mt-4"
                pose="clipboard"
                title="Nothing planned yet"
                text="Break today into blocks: what you’ll study, when, for how long."
                action={
                  <Button variant="primary" size="sm" onClick={() => openEditor('block', null, { date: today })}>
                    <Plus /> Plan a block
                  </Button>
                }
              />
            )}
          </Card>
        </div>
        <div className="space-y-5 lg:col-span-4">
          <Spotlight data={data} />
          <ReviseCard data={data} />
          <DueSoon data={data} />
          <Sessions data={data} />
        </div>
      </Stagger>
    </>
  )
}
