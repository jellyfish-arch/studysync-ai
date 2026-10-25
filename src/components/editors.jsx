// Every add/edit form in the app, shown in one slide-over drawer.
import { useEffect, useState } from 'react'
import { Trash2 } from './icons.jsx'
import { Button, Drawer, Field, SubjectSelect, cn, useToast, useUndo } from './ui.jsx'
import { pose } from '../yuuki/poses.js'
import JellyRadio from './rb/JellyRadio/JellyRadio.jsx'
import { EXAM_TYPES, SUBJECT_COLORS, colorOf, useStore } from '../lib/store.js'
import { useUI } from '../lib/ui.js'
import { formatMinutes, nowHHMM, todayISO } from '../lib/dates.js'

const jelly = {
  chipColor: 'var(--surface-2)',
  activeColor: 'var(--primary)',
  textColor: 'var(--ink-2)',
  activeTextColor: '#000000',
  size: 'sm',
  gap: 6,
  className: 'px-0! flex-wrap',
}

function useFirstSubject() {
  return useStore((s) => s.subjects[0]?.id || '')
}

function NeedSubject() {
  const open = useUI((s) => s.openEditor)
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-2">
      <img src={pose('hug')} alt="" className="mb-3 w-24" />
      Add a subject first. Everything in StudySync belongs to a subject, so Yuuki knows where to put it.
      <div className="mt-4">
        <Button variant="primary" size="sm" onClick={() => open('subject')}>
          Add a subject
        </Button>
      </div>
    </div>
  )
}

/* ---------- Subject ---------- */
function SubjectForm({ item, close }) {
  const add = useStore((s) => s.addSubject)
  const update = useStore((s) => s.updateSubject)
  const remove = useStore((s) => s.deleteSubject)
  const undo = useUndo()
  const toast = useToast()
  const used = useStore((s) => s.subjects.map((x) => x.color).join(','))
  const [f, setF] = useState(() => ({
    name: item?.name || '',
    code: item?.code || '',
    color: item?.color || Object.keys(SUBJECT_COLORS).find((c) => !used.split(',').includes(c)) || 'gold',
    teacher: item?.teacher || '',
  }))
  const submit = (e) => {
    e.preventDefault()
    if (!f.name.trim()) return
    const ok = item ? update(item.id, { ...f, code: f.code.toUpperCase() }) : add(f)
    if (ok) close()
  }
  return (
    <form id="editor-form" onSubmit={submit} className="space-y-4">
      <Field label="Subject name">
        <input className="input" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Operating Systems" required maxLength={80} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Code (optional)">
          <input className="input uppercase" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="CS501" maxLength={12} />
        </Field>
        <Field label="Faculty (optional)">
          <input className="input" value={f.teacher} onChange={(e) => setF({ ...f, teacher: e.target.value })} placeholder="Prof. Rao" maxLength={60} />
        </Field>
      </div>
      <div>
        <span className="field-label">Colour</span>
        <div className="flex flex-wrap gap-2">
          {Object.keys(SUBJECT_COLORS).map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setF({ ...f, color: c })}
              aria-label={c}
              aria-pressed={f.color === c}
              className={cn('size-9 rounded-xl transition-transform hover:scale-110', f.color === c && 'ring-2 ring-ink ring-offset-2 ring-offset-surface')}
              style={{ background: colorOf(c) }}
            />
          ))}
        </div>
      </div>
      {item && (
        <div className="border-t border-line pt-4">
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              close()
              undo(`Deleted ${item.name}`, () => remove(item.id))
            }}
          >
            <Trash2 /> Delete subject and everything in it
          </Button>
        </div>
      )}
    </form>
  )
}

/* ---------- Assignment ---------- */
function AssignmentForm({ item, defaults, close }) {
  const first = useFirstSubject()
  const add = useStore((s) => s.addAssignment)
  const update = useStore((s) => s.updateAssignment)
  const remove = useStore((s) => s.deleteAssignment)
  const undo = useUndo()
  const toast = useToast()
  const [f, setF] = useState({
    title: item?.title || '',
    subjectId: item?.subjectId || defaults.subjectId || first,
    due: item?.due || defaults.due || todayISO(),
    priority: item?.priority || 'medium',
    status: item?.status || 'todo',
    estimate: item?.estimate || 60,
    notes: item?.notes || '',
  })
  if (!first) return <NeedSubject />
  const submit = (e) => {
    e.preventDefault()
    if (!f.title.trim()) return
    const data = { ...f, title: f.title.trim(), estimate: Number(f.estimate) || 0 }
    const ok = item ? update(item.id, data) : add(data)
    if (ok) close()
  }
  return (
    <form id="editor-form" onSubmit={submit} className="space-y-4">
      <Field label="What is it?">
        <input className="input" autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Lab record: SQL joins" required maxLength={120} />
      </Field>
      <Field label="Subject">
        <SubjectSelect value={f.subjectId} onChange={(subjectId) => setF({ ...f, subjectId })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Due date">
          <input className="input num" type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} required />
        </Field>
        <Field label="Estimated time (min)">
          <input className="input num" type="number" min="0" max="1440" value={f.estimate} onChange={(e) => setF({ ...f, estimate: e.target.value })} />
        </Field>
      </div>
      <div>
        <span className="field-label">Priority</span>
        <JellyRadio
          {...jelly}
          ariaLabel="Priority"
          items={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ]}
          value={f.priority}
          onChange={(priority) => setF({ ...f, priority })}
        />
      </div>
      <div>
        <span className="field-label">Status</span>
        <JellyRadio
          {...jelly}
          ariaLabel="Status"
          items={[
            { value: 'todo', label: 'To do' },
            { value: 'doing', label: 'In progress' },
            { value: 'done', label: 'Done' },
          ]}
          value={f.status}
          onChange={(status) => setF({ ...f, status })}
        />
      </div>
      <Field label="Notes (optional)">
        <textarea className="input min-h-24" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Questions, pages, submission link…" maxLength={1000} />
      </Field>
      {item && (
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            close()
            undo('Assignment deleted', () => remove(item.id))
          }}
        >
          <Trash2 /> Delete assignment
        </Button>
      )}
    </form>
  )
}

/* ---------- Exam ---------- */
function ExamForm({ item, defaults, close }) {
  const first = useFirstSubject()
  const units = useStore((s) => s.units)
  const add = useStore((s) => s.addExam)
  const update = useStore((s) => s.updateExam)
  const remove = useStore((s) => s.deleteExam)
  const undo = useUndo()
  const toast = useToast()
  const [f, setF] = useState({
    title: item?.title || '',
    subjectId: item?.subjectId || defaults.subjectId || first,
    type: item?.type || 'Quiz',
    date: item?.date || defaults.date || todayISO(),
    time: item?.time || '10:00',
    venue: item?.venue || '',
    unitIds: item?.unitIds || [],
  })
  if (!first) return <NeedSubject />
  const subjectUnits = units.filter((u) => u.subjectId === f.subjectId).sort((a, b) => a.order - b.order)
  const toggleUnit = (id) => setF({ ...f, unitIds: f.unitIds.includes(id) ? f.unitIds.filter((u) => u !== id) : [...f.unitIds, id] })
  const submit = (e) => {
    e.preventDefault()
    const data = { ...f, title: f.title.trim() || f.type }
    const ok = item ? update(item.id, data) : add(data)
    if (ok) close()
  }
  return (
    <form id="editor-form" onSubmit={submit} className="space-y-4">
      <Field label="Subject">
        <SubjectSelect value={f.subjectId} onChange={(subjectId) => setF({ ...f, subjectId, unitIds: [] })} />
      </Field>
      <div>
        <span className="field-label">Type</span>
        <JellyRadio {...jelly} ariaLabel="Exam type" items={EXAM_TYPES} value={f.type} onChange={(type) => setF({ ...f, type })} />
      </div>
      <Field label="Name (optional)">
        <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={`e.g. ${f.type} 1: Units 1-2`} maxLength={80} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <input className="input num" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required />
        </Field>
        <Field label="Time">
          <input className="input num" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
        </Field>
      </div>
      <Field label="Venue (optional)">
        <input className="input" value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} placeholder="Exam Hall B" maxLength={60} />
      </Field>
      <div>
        <span className="field-label">Units in this exam</span>
        {subjectUnits.length === 0 ? (
          <p className="text-sm text-muted">This subject has no units yet. The whole subject counts towards readiness.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {subjectUnits.map((u, i) => {
              const on = f.unitIds.includes(u.id)
              return (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => toggleUnit(u.id)}
                  aria-pressed={on}
                  className={cn(
                    'rounded-xl border px-3 py-1.5 text-left text-[0.8rem] font-medium transition-colors',
                    on ? 'border-primary bg-primary-soft text-primary-ink' : 'border-line-strong text-ink-2 hover:border-primary/50',
                  )}
                >
                  <span className="mr-1 font-mono text-[0.7rem] opacity-70">U{i + 1}</span> {u.title}
                </button>
              )
            })}
          </div>
        )}
        <p className="mt-1.5 text-[0.75rem] text-muted">None selected means the whole subject.</p>
      </div>
      {item && (
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            close()
            undo('Exam deleted', () => remove(item.id))
          }}
        >
          <Trash2 /> Delete exam
        </Button>
      )}
    </form>
  )
}

/* ---------- Planned study block ---------- */
function BlockForm({ item, defaults, close }) {
  const first = useFirstSubject()
  const add = useStore((s) => s.addBlock)
  const update = useStore((s) => s.updateBlock)
  const remove = useStore((s) => s.deleteBlock)
  const undo = useUndo()
  const [f, setF] = useState({
    title: item?.title || '',
    subjectId: item?.subjectId || defaults.subjectId || first,
    date: item?.date || defaults.date || todayISO(),
    start: item?.start || defaults.start || nextHalfHour(),
    minutes: item?.minutes || 45,
  })
  if (!first) return <NeedSubject />
  const submit = (e) => {
    e.preventDefault()
    const data = { ...f, title: f.title.trim() || 'Study', minutes: Number(f.minutes) || 45 }
    const ok = item ? update(item.id, data) : add(data)
    if (ok) close()
  }
  return (
    <form id="editor-form" onSubmit={submit} className="space-y-4">
      <Field label="What will you study?">
        <input className="input" autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Unit 3: paging numericals" maxLength={120} />
      </Field>
      <Field label="Subject">
        <SubjectSelect value={f.subjectId} onChange={(subjectId) => setF({ ...f, subjectId })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Day">
          <input className="input num" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required />
        </Field>
        <Field label="Start">
          <input className="input num" type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} required />
        </Field>
      </div>
      <div>
        <span className="field-label">Length</span>
        <JellyRadio
          {...jelly}
          ariaLabel="Length in minutes"
          items={[25, 30, 45, 60, 90, 120].map((m) => ({ value: m, label: formatMinutes(m) }))}
          value={[25, 30, 45, 60, 90, 120].includes(Number(f.minutes)) ? Number(f.minutes) : null}
          onChange={(minutes) => setF({ ...f, minutes })}
        />
      </div>
      {item && (
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            close()
            undo('Study block removed', () => remove(item.id))
          }}
        >
          <Trash2 /> Remove block
        </Button>
      )}
    </form>
  )
}

function nextHalfHour() {
  const [h, m] = nowHHMM().split(':').map(Number)
  const total = Math.min(23 * 60 + 30, Math.ceil((h * 60 + m + 1) / 30) * 30)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/* ---------- Log time already studied ---------- */
function LogForm({ defaults, close }) {
  const first = useFirstSubject()
  const log = useStore((s) => s.logSession)
  const toast = useToast()
  const [f, setF] = useState({ subjectId: defaults.subjectId || first, minutes: 45, date: todayISO(), note: '' })
  if (!first) return <NeedSubject />
  const submit = (e) => {
    e.preventDefault()
    if (log(f)) close()
  }
  return (
    <form id="editor-form" onSubmit={submit} className="space-y-4">
      <Field label="Subject">
        <SubjectSelect value={f.subjectId} onChange={(subjectId) => setF({ ...f, subjectId })} />
      </Field>
      <Field label="Minutes studied">
        <input className="input num" type="number" min="1" max="720" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} required />
      </Field>
      <JellyRadio
        {...jelly}
        ariaLabel="Quick durations"
        items={[15, 30, 45, 60, 90, 120].map((m) => ({ value: m, label: formatMinutes(m) }))}
        value={[15, 30, 45, 60, 90, 120].includes(Number(f.minutes)) ? Number(f.minutes) : null}
        onChange={(minutes) => setF({ ...f, minutes })}
      />
      <Field label="Day">
        <input className="input num" type="date" value={f.date} max={todayISO()} onChange={(e) => setF({ ...f, date: e.target.value })} required />
      </Field>
      <Field label="What did you cover? (optional)">
        <input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Unit 2 numericals" maxLength={120} />
      </Field>
    </form>
  )
}

/* ---------- Start a focus session ---------- */
function FocusForm({ defaults, close }) {
  const first = useFirstSubject()
  const start = useStore((s) => s.startTimer)
  const setFocusOpen = useUI((s) => s.setFocusOpen)
  const focusLength = useStore((s) => s.prefs.focusLength)
  const [f, setF] = useState({ subjectId: defaults.subjectId || first, title: defaults.title || '', planned: focusLength || 45 })
  if (!first) return <NeedSubject />
  const submit = (e) => {
    e.preventDefault()
    start({ ...f, title: f.title.trim() })
    close()
    setFocusOpen(true)
  }
  return (
    <form id="editor-form" onSubmit={submit} className="space-y-4">
      <Field label="Subject">
        <SubjectSelect value={f.subjectId} onChange={(subjectId) => setF({ ...f, subjectId })} />
      </Field>
      <Field label="What are you working on? (optional)">
        <input className="input" autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Deadlock numericals" maxLength={120} />
      </Field>
      <div>
        <span className="field-label">Target</span>
        <JellyRadio
          {...jelly}
          ariaLabel="Target length"
          items={[25, 45, 60, 90].map((m) => ({ value: m, label: formatMinutes(m) }))}
          value={f.planned}
          onChange={(planned) => setF({ ...f, planned })}
        />
        <p className="mt-2 text-[0.78rem] text-muted">The timer keeps running past the target. Only the time you actually study is saved.</p>
      </div>
    </form>
  )
}

// Each form takes the colour of its section.
const META = {
  subject: { Form: SubjectForm, add: 'Add a subject', edit: 'Edit subject', save: 'Save subject', accent: 'var(--gold)' },
  assignment: { Form: AssignmentForm, add: 'New assignment', edit: 'Edit assignment', save: 'Save assignment', accent: 'var(--coral)' },
  exam: { Form: ExamForm, add: 'New exam', edit: 'Edit exam', save: 'Save exam', accent: 'var(--rose)' },
  block: { Form: BlockForm, add: 'Plan a study block', edit: 'Edit study block', save: 'Save block', accent: 'var(--mint)' },
  log: { Form: LogForm, add: 'Log study time', save: 'Log time', sub: 'For time you already studied without the timer.', accent: 'var(--lime)' },
  focus: { Form: FocusForm, add: 'Start a focus session', save: 'Start focusing', sub: 'Full-screen timer. Saves the time when you finish.', accent: 'var(--lime)' },
}

export default function Editors() {
  const editor = useUI((s) => (s.editor && META[s.editor.type] ? s.editor : null))
  const close = useUI((s) => s.closeEditor)
  const [last, setLast] = useState(editor)
  useEffect(() => {
    if (editor) setLast(editor)
  }, [editor])
  const current = editor || last
  const meta = current ? META[current.type] : null
  const hasSubjects = useStore((s) => s.subjects.length > 0)
  const needsSubject = current && current.type !== 'subject' && !hasSubjects
  return (
    <Drawer
      open={Boolean(editor)}
      accent={meta?.accent}
      onClose={close}
      title={meta ? (current.item ? meta.edit : meta.add) : ''}
      sub={meta?.sub}
      footer={
        meta &&
        !needsSubject && (
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="editor-form">
              {meta.save}
            </Button>
          </>
        )
      }
    >
      {meta && <meta.Form key={`${current.type}-${current.item?.id || 'new'}`} item={current.item} defaults={current.defaults || {}} close={close} />}
    </Drawer>
  )
}
