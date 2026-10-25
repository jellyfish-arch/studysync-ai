import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, CheckCircle2, CircleDashed, ClipboardList, Clock3, Flag, LayoutGrid, List, Loader, Plus } from '../../components/icons.jsx'
import RubberSegment from '../../components/rb/RubberSegment/RubberSegment.jsx'
import SpringCheck from '../../components/rb/SpringCheck/SpringCheck.jsx'
import { Badge, Button, Card, Count, Empty, PageHeader, SubjectTag, celebrate, cn, useToast } from '../../components/ui.jsx'
import { checkProps, sparkFromFocus } from '../../components/blocks.jsx'
import { colorOf, useStore } from '../../lib/store.js'
import { useUI } from '../../lib/ui.js'
import { prioRank } from '../../lib/selectors.js'
import { addDays, daysBetween, formatMinutes, shortDate, todayISO } from '../../lib/dates.js'

const COLUMNS = [
  { key: 'todo', label: 'To do', icon: CircleDashed },
  { key: 'doing', label: 'In progress', icon: Loader },
  { key: 'done', label: 'Done', icon: CheckCircle2 },
]

export const segProps = {
  trackColor: 'var(--surface-2)',
  thumbColor: '#f5f3ef',
  textColor: 'var(--muted)',
  activeTextColor: '#000000',
  size: 'md',
  radius: 12,
}

function DueBadge({ a }) {
  if (a.status === 'done') return <Badge tone="good">Submitted</Badge>
  const d = daysBetween(todayISO(), a.due)
  if (d < 0) return <Badge tone="bad" dot>{-d}d overdue</Badge>
  if (d === 0) return <Badge tone="bad" dot>Due today</Badge>
  if (d === 1) return <Badge tone="warn">Tomorrow</Badge>
  if (d <= 3) return <Badge tone="warn">In {d} days</Badge>
  return <Badge>{shortDate(a.due)}</Badge>
}

const PRIO = { high: 'text-danger', medium: 'text-warning', low: 'text-muted' }

function useSetStatus() {
  const update = useStore((s) => s.updateAssignment)
  const toast = useToast()
  return (a, status) => {
    if (a.status === status) return
    update(a.id, { status })
    if (status === 'done') {
      celebrate({ x: 0.5, y: 0.3 })
      toast('Assignment done', { description: a.title, actionLabel: 'Undo', onAction: () => update(a.id, { status: a.status }) })
    }
  }
}

function BoardCard({ a, onDragStart }) {
  const openEditor = useUI((s) => s.openEditor)
  const subject = useStore((s) => s.subjects.find((x) => x.id === a.subjectId))
  return (
    <motion.div
      layout
      layoutId={`as-${a.id}`}
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
      draggable
      onDragStart={(e) => onDragStart(e, a)}
      onClick={() => openEditor('assignment', a)}
      className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-[color-mix(in_srgb,var(--accent)_40%,var(--line-strong))]"
      style={{ '--c': colorOf(subject?.color), '--accent': colorOf(subject?.color) }}
    >
      <span className="sc-bg absolute inset-x-0 top-0 h-1 opacity-80" />
      <div className="flex items-start justify-between gap-2">
        <SubjectTag subjectId={a.subjectId} short />
        <Flag className={cn('size-4 shrink-0', PRIO[a.priority])} aria-label={`${a.priority} priority`} />
      </div>
      <p className={cn('mt-2.5 leading-snug font-semibold text-ink', a.status === 'done' && 'line-through opacity-60')}>{a.title}</p>
      {a.notes && <p className="mt-1 line-clamp-2 text-[0.8rem] text-muted">{a.notes}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <DueBadge a={a} />
        {a.estimate > 0 && (
          <span className="flex items-center gap-1 text-[0.72rem] text-muted">
            <Clock3 className="size-3" /> {formatMinutes(a.estimate)}
          </span>
        )}
      </div>
    </motion.div>
  )
}

function Board({ list }) {
  const setStatus = useSetStatus()
  const openEditor = useUI((s) => s.openEditor)
  const [over, setOver] = useState(null)
  const onDragStart = (e, a) => e.dataTransfer.setData('text/plain', a.id)
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const items = list.filter((a) => a.status === col.key)
        return (
          <div
            key={col.key}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(col.key)
            }}
            onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
            onDrop={(e) => {
              e.preventDefault()
              setOver(null)
              const a = list.find((x) => x.id === e.dataTransfer.getData('text/plain'))
              if (a) setStatus(a, col.key)
            }}
            className={cn('flex min-h-64 flex-col rounded-3xl border border-line bg-surface p-3 transition-colors', over === col.key && 'border-dashed border-primary bg-primary-soft')}
          >
            <div className="mb-3 flex items-center justify-between px-1.5 pt-1">
              <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                <col.icon className={cn('size-4', col.key === 'done' ? 'text-mint' : col.key === 'doing' ? 'text-gold' : 'text-coral')} />
                {col.label}
                <span className="num rounded-full bg-surface px-2 text-[0.72rem] text-muted">{items.length}</span>
              </h3>
              {col.key !== 'done' && (
                <button onClick={() => openEditor('assignment')} className="tap rounded-lg p-1 text-muted hover:bg-surface hover:text-primary" aria-label={`Add to ${col.label}`}>
                  <Plus className="size-4" />
                </button>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2.5">
              <AnimatePresence>
                {items.map((a) => (
                  <BoardCard key={a.id} a={a} onDragStart={onDragStart} />
                ))}
              </AnimatePresence>
              {items.length === 0 && <p className="m-auto py-8 text-center text-[0.8rem] text-muted">Drop assignments here</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ListView({ list }) {
  const data = useStore()
  const setStatus = useSetStatus()
  const openEditor = useUI((s) => s.openEditor)
  if (!list.length) return null
  return (
    <Card className="overflow-hidden">
      <div className="hidden grid-cols-[1fr_9rem_8rem_6rem_8rem] gap-4 border-b border-line bg-surface-2 px-5 py-2.5 text-[0.72rem] font-semibold text-muted md:grid">
        <span>Assignment</span>
        <span>Subject</span>
        <span>Due</span>
        <span>Priority</span>
        <span>Status</span>
      </div>
      <ul className="divide-y divide-line">
        <AnimatePresence initial={false}>
          {list.map((a, i) => (
            <motion.li
              key={a.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: i * 0.02 }}
              className="grid grid-cols-1 items-center gap-2 px-5 py-3 hover:bg-surface-2/60 md:grid-cols-[1fr_9rem_8rem_6rem_8rem] md:gap-4"
            >
              <SpringCheck
                key={`${a.id}-${a.status}`}
                label={a.title}
                defaultChecked={a.status === 'done'}
                onChange={(on) => {
                  if (on) sparkFromFocus(colorOf(data.subjects.find((s) => s.id === a.subjectId)?.color))
                  setTimeout(() => setStatus(a, on ? 'done' : 'todo'), 420)
                }}
                className="topic-check"
                {...checkProps}
              />
              <span className="min-w-0">
                <SubjectTag subjectId={a.subjectId} short />
              </span>
              <span>
                <DueBadge a={a} />
              </span>
              <span className={cn('flex items-center gap-1 text-[0.8rem] font-semibold capitalize', PRIO[a.priority])}>
                <Flag className="size-3.5" /> {a.priority}
              </span>
              <span className="flex items-center gap-2">
                <select
                  className="input h-8 min-h-0 py-0 text-[0.8rem]"
                  value={a.status}
                  onChange={(e) => setStatus(a, e.target.value)}
                  aria-label={`Status of ${a.title}`}
                >
                  {COLUMNS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <button onClick={() => openEditor('assignment', a)} className="text-[0.75rem] font-semibold text-primary hover:underline">
                  Edit
                </button>
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </Card>
  )
}

export default function Assignments() {
  const data = useStore()
  const openEditor = useUI((s) => s.openEditor)
  const today = todayISO()
  const [view, setView] = useState('board')
  const [filter, setFilter] = useState('all')
  const [subject, setSubject] = useState('all')

  const open = data.assignments.filter((a) => a.status !== 'done')
  const stats = [
    { label: 'Open', value: open.length, icon: ClipboardList, color: 'var(--coral)' },
    { label: 'Due this week', value: open.filter((a) => a.due >= today && a.due <= addDays(today, 7)).length, icon: Clock3, color: 'var(--gold)' },
    { label: 'Overdue', value: open.filter((a) => a.due < today).length, icon: AlertTriangle, color: 'var(--danger)' },
    { label: 'Completed', value: data.assignments.length - open.length, icon: CheckCircle2, color: 'var(--mint)' },
  ]

  let list = data.assignments.filter((a) => subject === 'all' || a.subjectId === subject)
  if (filter === 'overdue') list = list.filter((a) => a.status !== 'done' && a.due < today)
  else if (filter === 'week') list = list.filter((a) => a.status !== 'done' && a.due <= addDays(today, 7))
  list = [...list].sort((a, b) => (a.status === 'done') - (b.status === 'done') || a.due.localeCompare(b.due) || prioRank(b.priority) - prioRank(a.priority))

  return (
    <>
      <PageHeader
        eyebrowIcon={ClipboardList}
        title="Assignments"
        sub="Every assignment, lab record and problem set with its deadline. Drag cards between columns."
        actions={
          <Button variant="primary" data-tour="add-assignment" onClick={() => openEditor('assignment')}>
            <Plus /> New assignment
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card accent={s.color} className="draw flex items-center gap-3 p-4">
              <span className="grid size-10 place-items-center rounded-xl border" style={{ color: s.color, borderColor: `color-mix(in srgb, ${s.color} 35%, transparent)` }}>
                <s.icon className="size-5" />
              </span>
              <span>
                <span className="num block font-display text-2xl leading-none font-bold text-ink">
                  <Count value={s.value} />
                </span>
                <span className="text-[0.78rem] text-muted">{s.label}</span>
              </span>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <RubberSegment
            {...segProps}
            aria-label="Filter"
            items={[
              { value: 'all', label: 'All' },
              { value: 'week', label: 'This week' },
              { value: 'overdue', label: 'Overdue' },
            ]}
            value={filter}
            onChange={setFilter}
          />
          <select className="input h-10 w-auto min-w-44" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject filter">
            <option value="all">All subjects</option>
            {data.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <RubberSegment
          {...segProps}
          aria-label="View"
          items={[
            { value: 'board', label: 'Board', icon: <LayoutGrid className="size-4" /> },
            { value: 'list', label: 'List', icon: <List className="size-4" /> },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      {data.assignments.length === 0 ? (
        <Empty
          pose="clipboard"
          title="No assignments yet"
          text="Add assignments, lab records and problem sets with their due dates."
          action={
            <Button variant="primary" size="sm" onClick={() => openEditor('assignment')}>
              <Plus /> New assignment
            </Button>
          }
        />
      ) : list.length === 0 ? (
        <Empty compact pose="think" title="Nothing here" text="No assignments match these filters." />
      ) : view === 'board' ? (
        <Board list={list} />
      ) : (
        <ListView list={list} />
      )}
    </>
  )
}
