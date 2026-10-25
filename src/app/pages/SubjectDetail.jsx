import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ChevronDown, ClipboardList, Clock3, GraduationCap, ListChecks, Pencil, Play, Plus, Trash2, X } from '../../components/icons.jsx'
import SpringCheck from '../../components/rb/SpringCheck/SpringCheck.jsx'
import RubberSegment from '../../components/rb/RubberSegment/RubberSegment.jsx'
import { Badge, Button, Card, Count, Duration, Empty, ProgressBar, Ring, celebrate, cn, useToast, useUndo } from '../../components/ui.jsx'
import { checkProps, sparkFromFocus } from '../../components/blocks.jsx'
import { ConfidencePicker } from '../../components/revision.jsx'
import { openQuiz } from '../../lib/ui.js'
import { segProps } from './Assignments.jsx'
import { colorOf, useStore } from '../../lib/store.js'
import { useUI } from '../../lib/ui.js'
import { examReadiness, subjectProgress, totalMinutes, unitProgress, upcomingExams } from '../../lib/selectors.js'
import { daysBetween, formatDay, formatMinutes, shortDate, todayISO } from '../../lib/dates.js'
import { parseSyllabus } from '../../lib/ingest.js'

function Unit({ unit, index, color, open, onToggle }) {
  const allTopics = useStore((s) => s.topics)
  const topics = allTopics.filter((t) => t.unitId === unit.id)
  const toggleTopic = useStore((s) => s.toggleTopic)
  const addTopic = useStore((s) => s.addTopic)
  const deleteTopic = useStore((s) => s.deleteTopic)
  const rateTopic = useStore((s) => s.rateTopic)
  const updateUnit = useStore((s) => s.updateUnit)
  const deleteUnit = useStore((s) => s.deleteUnit)
  const undo = useUndo()
  const toast = useToast()
  const [draft, setDraft] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState(unit.title)
  const p = unitProgress({ topics: allTopics }, unit.id)

  const add = (e) => {
    e.preventDefault()
    // Paste several topics at once: one per line, or separated by commas/semicolons.
    const parts = draft.split(/\n|;|,(?![^()]*\))/).map((x) => x.trim()).filter(Boolean)
    parts.forEach((t) => addTopic(unit.id, t))
    if (parts.length > 1) toast(`Added ${parts.length} topics`)
    setDraft('')
  }

  const onCheck = (t) => {
    if (!t.done) sparkFromFocus(color)
    setTimeout(() => {
      toggleTopic(t.id)
      const after = unitProgress(useStore.getState(), unit.id)
      if (!t.done && after.total > 1 && after.done === after.total) celebrate({ x: 0.5, y: 0.5 })
    }, 380)
  }

  return (
    <motion.div layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-center gap-3 p-4">
        <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={open}>
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border font-mono text-sm font-bold" style={{ color, borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}>
            U{index + 1}
          </span>
          <span className="min-w-0 flex-1">
            {renaming ? null : <span className="block truncate font-semibold text-ink">{unit.title}</span>}
            <span className="mt-1 flex items-center gap-3">
              <ProgressBar value={p.pct} color={color} height={6} className="max-w-56 flex-1" />
              <span className="num shrink-0 text-[0.75rem] font-semibold text-muted">
                {p.done}/{p.total}
              </span>
            </span>
          </span>
        </button>
        {renaming ? (
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (title.trim()) updateUnit(unit.id, { title: title.trim() })
              setRenaming(false)
            }}
          >
            <input className="input h-9 min-h-0" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus aria-label="Unit name" />
            <Button variant="primary" size="sm" type="submit">
              Save
            </Button>
          </form>
        ) : (
          <>
            {p.total > 0 && p.done === p.total && <Badge tone="good">Complete</Badge>}
            <Button variant="ghost" size="icon" onClick={() => setRenaming(true)} aria-label={`Rename ${unit.title}`}>
              <Pencil />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => undo(`Deleted ${unit.title}`, () => deleteUnit(unit.id))} aria-label={`Delete ${unit.title}`}>
              <Trash2 />
            </Button>
            <motion.button animate={{ rotate: open ? 180 : 0 }} onClick={onToggle} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label={open ? 'Collapse' : 'Expand'}>
              <ChevronDown className="size-5" />
            </motion.button>
          </>
        )}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
            <div className="border-t border-line px-4 pt-2 pb-4">
              <ul>
                <AnimatePresence initial={false}>
                  {topics.map((t) => (
                    <motion.li key={t.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }} className="group flex items-center gap-2 rounded-xl px-1 hover:bg-surface-2">
                      <div className="min-w-0 flex-1">
                        <SpringCheck key={`${t.id}-${t.done}`} label={t.title} defaultChecked={t.done} onChange={() => onCheck(t)} className="topic-check" {...checkProps} />
                      </div>
                      {t.done && t.doneOn && <span className="hidden shrink-0 text-[0.7rem] text-muted sm:inline">{formatDay(t.doneOn)}</span>}
                      {t.done && t.quiz && <span className={cn('hidden shrink-0 text-[0.7rem] font-semibold sm:inline', t.quiz.last >= 80 ? 'text-mint' : t.quiz.last >= 50 ? 'text-gold' : 'text-coral')} title="Last quiz score">{t.quiz.last}%</span>}
                      {t.done && <ConfidencePicker label={t.title} value={t.confidence} onChange={(c) => rateTopic(t.id, c)} />}
                      {t.done && (
                        <button type="button" onClick={() => openQuiz([t.id], t.title)} className="tap shrink-0 rounded-md px-1.5 py-1 text-[0.7rem] font-bold text-muted hover:text-[var(--teal)]" aria-label={`Quiz me on ${t.title}`} title="Quiz me">
                          Quiz
                        </button>
                      )}
                      <button onClick={() => deleteTopic(t.id)} className="shrink-0 rounded-md p-1 text-muted opacity-0 group-hover:opacity-100 hover:text-danger" aria-label={`Delete ${t.title}`}>
                        <X className="size-4" />
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
              <form onSubmit={add} className="mt-2 flex gap-2">
                <input
                  className="input h-10 min-h-0"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Add a topic, or paste several separated by commas"
                  aria-label={`Add topic to ${unit.title}`}
                />
                <Button variant="soft" type="submit" disabled={!draft.trim()}>
                  <Plus /> Add
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function Syllabus({ subject, color }) {
  const allUnits = useStore((s) => s.units)
  const units = allUnits.filter((u) => u.subjectId === subject.id).sort((a, b) => a.order - b.order)
  const addUnit = useStore((s) => s.addUnit)
  const addSyllabus = useStore((s) => s.addSyllabus)
  const [open, setOpen] = useState(() => new Set(units.slice(0, 2).map((u) => u.id)))
  const [title, setTitle] = useState('')
  const [paste, setPaste] = useState(false)
  const [text, setText] = useState('')
  const [review, setReview] = useState(null) // parsed units, editable before saving
  const toggle = (id) => {
    const next = new Set(open)
    next.has(id) ? next.delete(id) : next.add(id)
    setOpen(next)
  }
  // Paste -> review (edit or remove anything) -> add. Parsing is in lib/ingest.js.
  const startReview = () => setReview(parseSyllabus(text))
  const editUnit = (i, patch) => setReview((r) => ({ ...r, units: r.units.map((u, j) => (j === i ? { ...u, ...patch } : u)) }))
  const dropUnit = (i) => setReview((r) => ({ ...r, units: r.units.filter((_, j) => j !== i) }))
  const kept = review ? review.units.filter((u) => u.title.trim()) : []
  const keptTopics = kept.reduce((n, u) => n + u.topics.length, 0)
  const save = () => {
    const r = addSyllabus(subject.id, kept)
    if (!r) return
    setOpen(new Set(useStore.getState().units.filter((u) => u.subjectId === subject.id).slice(0, 2).map((u) => u.id)))
    setText('')
    setReview(null)
    setPaste(false)
  }

  return (
    <div className="space-y-3" data-tour="syllabus">
      {units.length === 0 && !paste && (
        <Empty
          pose="read"
          title="No syllabus yet"
          text="Add units one by one, or paste the syllabus from your university PDF."
          action={
            <Button variant="primary" size="sm" onClick={() => setPaste(true)}>
              Paste syllabus
            </Button>
          }
        />
      )}
      {units.map((u, i) => (
        <Unit key={u.id} unit={u} index={i} color={color} open={open.has(u.id)} onToggle={() => toggle(u.id)} />
      ))}
      <AnimatePresence>
        {paste && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Card className="p-5">
              {!review ? (
                <>
                  <h3 className="font-semibold text-ink">Paste your syllabus</h3>
                  <p className="mt-1 text-sm text-muted">Copy it from your university PDF as it is. Lines starting with “Unit”, “Module” or “Chapter” become units; you'll check everything before it's added.</p>
                  <textarea
                    className="input mt-3 min-h-48 font-mono text-[0.82rem]"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={'UNIT-I Introduction (9 hours)\nOS structure, system calls, process states, threads\nUNIT-II Scheduling: FCFS, SJF, Round Robin\nTEXT BOOKS ...'}
                    aria-label="Syllabus text"
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setPaste(false)}>
                      Cancel
                    </Button>
                    <Button variant="primary" onClick={startReview} disabled={!text.trim()}>
                      Review
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="font-semibold text-ink">Check before adding</h3>
                  <p className="mt-1 text-sm text-muted">
                    {kept.length} unit{kept.length === 1 ? '' : 's'} and {keptTopics} topic{keptTopics === 1 ? '' : 's'}. Rename a unit, or remove anything that isn't a topic.
                  </p>
                  {review.notes.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-[0.78rem] text-muted">
                      {review.notes.map((n) => (
                        <li key={n}>· {n}</li>
                      ))}
                    </ul>
                  )}
                  {review.units.length === 0 ? (
                    <p className="mt-4 text-sm text-warning">No units or topics found. Go back and check the text has one topic per line or units like “Unit 1: …”.</p>
                  ) : (
                    <ol className="mt-4 space-y-3">
                      {review.units.map((u, i) => (
                        <li key={i} className="rounded-xl border border-line p-3">
                          <div className="flex items-center gap-2">
                            <span className="num shrink-0 font-mono text-[0.72rem] font-bold text-muted">U{i + 1}</span>
                            <input className="input h-9 min-h-0 flex-1 py-1" value={u.title} onChange={(e) => editUnit(i, { title: e.target.value })} aria-label={`Unit ${i + 1} title`} />
                            <Button variant="ghost" size="icon" onClick={() => dropUnit(i)} aria-label={`Remove unit ${u.title}`}>
                              <Trash2 />
                            </Button>
                          </div>
                          {u.topics.length > 0 ? (
                            <ul className="mt-2 flex flex-wrap gap-1.5">
                              {u.topics.map((t, k) => (
                                <li key={`${t}-${k}`} className="flex items-center gap-1 rounded-lg border border-line bg-surface-2 py-0.5 pr-1 pl-2 text-[0.8rem] text-ink-2">
                                  {t}
                                  <button type="button" onClick={() => editUnit(i, { topics: u.topics.filter((_, j) => j !== k) })} className="tap rounded p-0.5 text-muted hover:text-danger" aria-label={`Remove topic ${t}`}>
                                    <X className="size-3.5" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-2 text-[0.78rem] text-muted">No topics. You can add them after.</p>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <Button variant="ghost" onClick={() => setReview(null)}>
                      Back to text
                    </Button>
                    <Button variant="primary" onClick={save} disabled={!kept.length}>
                      <Plus /> Add {kept.length} unit{kept.length === 1 ? '' : 's'}, {keptTopics} topic{keptTopics === 1 ? '' : 's'}
                    </Button>
                  </div>
                </>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!title.trim()) return
          const u = addUnit(subject.id, title)
          if (u) setOpen(new Set([...open, u.id]))
          setTitle('')
        }}
        className="flex flex-wrap gap-2 rounded-2xl border border-dashed border-line-strong p-3"
      >
        <input className="input h-10 min-h-0 flex-1 border-transparent bg-transparent" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New unit, e.g. Unit 5: File systems" aria-label="New unit name" />
        <Button variant="soft" type="submit" disabled={!title.trim()}>
          <Plus /> Add unit
        </Button>
        {units.length > 0 && !paste && (
          <Button variant="ghost" onClick={() => setPaste(true)}>
            Paste syllabus
          </Button>
        )}
      </form>
    </div>
  )
}

function ExamsTab({ subject, data }) {
  const openEditor = useUI((s) => s.openEditor)
  const exams = data.exams.filter((e) => e.subjectId === subject.id).sort((a, b) => a.date.localeCompare(b.date))
  const today = todayISO()
  return (
    <div className="space-y-3">
      {exams.map((e, i) => {
        const r = examReadiness(data, e)
        const d = daysBetween(today, e.date)
        return (
          <motion.button
            key={e.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => openEditor('exam', e)}
            className={cn('flex w-full items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-left hover:border-primary/40', d < 0 && 'opacity-60')}
          >
            <Ring value={r.pct} size={56} stroke={6}>
              <span className="num text-[0.75rem] font-bold text-ink">{r.pct}%</span>
            </Ring>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">{e.title}</span>
              <span className="text-[0.8rem] text-muted">
                {e.type} · {shortDate(e.date)} · {r.done}/{r.total} topics
              </span>
            </span>
            <Badge tone={d < 0 ? 'neutral' : d <= 3 ? 'bad' : d <= 7 ? 'warn' : 'primary'}>{d < 0 ? 'Done' : d === 0 ? 'Today' : `In ${d}d`}</Badge>
          </motion.button>
        )
      })}
      <Button variant="soft" onClick={() => openEditor('exam', null, { subjectId: subject.id })}>
        <Plus /> Add exam for {subject.name}
      </Button>
    </div>
  )
}

function AssignmentsTab({ subject, data }) {
  const openEditor = useUI((s) => s.openEditor)
  const list = data.assignments.filter((a) => a.subjectId === subject.id).sort((a, b) => (a.status === 'done') - (b.status === 'done') || a.due.localeCompare(b.due))
  const today = todayISO()
  return (
    <div className="space-y-2">
      {list.map((a, i) => {
        const d = daysBetween(today, a.due)
        return (
          <motion.button
            key={a.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => openEditor('assignment', a)}
            className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left hover:border-primary/40"
          >
            <ClipboardList className="size-5 shrink-0 text-muted" />
            <span className={cn('min-w-0 flex-1 truncate font-semibold text-ink', a.status === 'done' && 'line-through opacity-60')}>{a.title}</span>
            <Badge tone={a.status === 'done' ? 'good' : d < 0 ? 'bad' : d <= 2 ? 'warn' : 'neutral'}>
              {a.status === 'done' ? 'Done' : d < 0 ? `${-d}d overdue` : d === 0 ? 'Today' : `Due ${shortDate(a.due)}`}
            </Badge>
          </motion.button>
        )
      })}
      <Button variant="soft" onClick={() => openEditor('assignment', null, { subjectId: subject.id })}>
        <Plus /> Add assignment
      </Button>
    </div>
  )
}

function LogTab({ subject, data }) {
  const openEditor = useUI((s) => s.openEditor)
  const list = data.sessions.filter((s) => s.subjectId === subject.id).sort((a, b) => b.date.localeCompare(a.date))
  return (
    <Card className="p-5">
      {list.length === 0 ? (
        <Empty compact pose="desk" title="No study time yet" text="Start a focus session for this subject, or log time you already studied." />
      ) : (
        <ul className="divide-y divide-line">
          {list.slice(0, 25).map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="w-28 shrink-0 text-muted">{formatDay(s.date)}</span>
              <span className="min-w-0 flex-1 truncate text-ink-2">{s.note || 'Study session'}</span>
              <span className="num font-semibold text-ink">{formatMinutes(s.minutes)}</span>
            </li>
          ))}
        </ul>
      )}
      <Button variant="soft" className="mt-4" onClick={() => openEditor('log', null, { subjectId: subject.id })}>
        <Plus /> Log time
      </Button>
    </Card>
  )
}

export default function SubjectDetail() {
  const { id } = useParams()
  const data = useStore()
  const openEditor = useUI((s) => s.openEditor)
  const timer = useStore((s) => s.timer)
  const [tab, setTab] = useState('syllabus')
  const subject = data.subjects.find((s) => s.id === id)

  if (!subject) {
    return (
      <Empty
        pose="oops"
        title="Subject not found"
        text="It may have been deleted."
        action={
          <Link to="/app/subjects">
            <Button variant="primary" size="sm">
              Back to subjects
            </Button>
          </Link>
        }
      />
    )
  }

  const color = colorOf(subject.color)
  const p = subjectProgress(data, subject.id)
  const next = upcomingExams(data).find((e) => e.subjectId === subject.id)
  const nextDays = next ? daysBetween(todayISO(), next.date) : null
  const minutes = totalMinutes(data, subject.id)
  const open = data.assignments.filter((a) => a.subjectId === subject.id && a.status !== 'done').length

  return (
    <div className="tint" style={{ '--accent': color }}>
      <Link to="/app/subjects" className="draw mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> All subjects
      </Link>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-6 overflow-hidden rounded-3xl p-6 text-black shadow-float sm:p-8"
        style={{ background: color }}
      >
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <span className="rounded-lg bg-black/15 px-2.5 py-1 font-mono text-[0.8rem] font-bold">{subject.code || 'Subject'}</span>
            <h1 className="mt-3 text-3xl leading-tight font-bold sm:text-4xl">{subject.name}</h1>
            {subject.teacher && <p className="mt-1 text-black/65">{subject.teacher}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              {!timer && (
                <button
                  onClick={() => openEditor('focus', null, { subjectId: subject.id })}
                  className="flex h-10 items-center gap-2 rounded-xl bg-black px-4 text-sm font-bold text-white hover:bg-black/85"
                >
                  <Play className="size-4" /> Study now
                </button>
              )}
              <button onClick={() => openEditor('subject', subject)} className="flex h-10 items-center gap-2 rounded-xl bg-black/12 px-4 text-sm font-semibold hover:bg-black/20">
                <Pencil className="size-4" /> Edit
              </button>
            </div>
          </div>
          <Ring value={p.pct} size={124} stroke={11} color="#000000" track="rgb(0 0 0 / 0.14)">
            <div className="text-center">
              <p className="num font-display text-3xl font-bold">
                <Count value={p.pct} />%
              </p>
              <p className="text-[0.7rem] text-black/60">syllabus</p>
            </div>
          </Ring>
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [ListChecks, 'Topics covered', `${p.done} / ${p.total}`],
            [Clock3, 'Time studied', <Duration key="d" minutes={minutes} unitClass="text-[0.6em] font-semibold text-black/55 ml-0.5" />],
            [GraduationCap, 'Next exam', next ? (nextDays === 0 ? 'Today' : `${nextDays} days`) : 'None'],
            [ClipboardList, 'Open assignments', open],
          ].map(([Icon, label, value]) => (
            <div key={label} className="rounded-2xl bg-black/10 p-3">
              <Icon className="size-4 text-black/60" />
              <p className="num mt-1.5 font-display text-xl font-bold">{value}</p>
              <p className="text-[0.72rem] text-black/60">{label}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="mb-4">
        <RubberSegment
          {...segProps}
          aria-label="Section"
          items={[
            { value: 'syllabus', label: 'Syllabus' },
            { value: 'exams', label: 'Exams' },
            { value: 'assignments', label: 'Assignments' },
            { value: 'log', label: 'Study log' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
          {tab === 'syllabus' && <Syllabus subject={subject} color={color} />}
          {tab === 'exams' && <ExamsTab subject={subject} data={data} />}
          {tab === 'assignments' && <AssignmentsTab subject={subject} data={data} />}
          {tab === 'log' && <LogTab subject={subject} data={data} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
