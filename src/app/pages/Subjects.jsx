import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowUpRight, BookOpen, Clock3, GraduationCap, ListChecks, Plus } from '../../components/icons.jsx'
import { Badge, Button, Count, Empty, PageHeader, Ring } from '../../components/ui.jsx'
import { colorOf, useStore } from '../../lib/store.js'
import { useUI } from '../../lib/ui.js'
import { overallProgress, subjectProgress, subjectStatus, totalMinutes } from '../../lib/selectors.js'
import { formatMinutes } from '../../lib/dates.js'

function SubjectCard({ subject, data, index }) {
  const color = colorOf(subject.color)
  const p = subjectProgress(data, subject.id)
  const st = subjectStatus(data, subject.id)
  const units = data.units.filter((u) => u.subjectId === subject.id).length
  const open = data.assignments.filter((a) => a.subjectId === subject.id && a.status !== 'done').length
  const minutes = totalMinutes(data, subject.id)
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="tint h-full"
      style={{ '--accent': color }}
      data-tour={index === 0 ? 'subject-card' : undefined}
    >
      <div className="lift h-full overflow-hidden rounded-3xl border border-line bg-surface">
        <Link to={`/app/subjects/${subject.id}`} className="group draw block h-full">
          <div className="relative h-24 overflow-hidden" style={{ background: color }}>
            <span className="subject-dots absolute inset-0 opacity-25" aria-hidden="true" />
            <span className="absolute top-4 left-5 rounded-lg bg-black/15 px-2 py-0.5 font-mono text-[0.75rem] font-bold text-black">{subject.code || 'Subject'}</span>
            <ArrowUpRight className="absolute top-4 right-4 size-5 text-black/70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
          <div className="relative px-5 pb-5">
            <div className="-mt-9 flex items-end justify-between">
              <span className="rounded-full bg-surface p-1.5 shadow-card">
                <Ring value={p.pct} size={64} stroke={6} color={color} delay={0.2 + index * 0.07}>
                  <span className="num text-[0.85rem] font-bold text-ink">{p.pct}%</span>
                </Ring>
              </span>
              {st.exam && <Badge tone={st.tone}>{st.label}</Badge>}
            </div>
            <h3 className="mt-3 font-display text-xl leading-tight font-bold text-ink transition-colors group-hover:text-primary">{subject.name}</h3>
            {subject.teacher && <p className="mt-0.5 text-[0.8rem] text-muted">{subject.teacher}</p>}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                [ListChecks, `${p.done}/${p.total}`, 'topics'],
                [Clock3, formatMinutes(minutes), 'studied'],
                [GraduationCap, open, open === 1 ? 'task open' : 'tasks open'],
              ].map(([Icon, value, label], i) => (
                <div key={i} className="rounded-xl border border-line px-1 py-2">
                  <Icon className="mx-auto size-4 text-[var(--accent)]" />
                  <p className="num mt-1 text-[0.85rem] font-bold text-ink">{value}</p>
                  <p className="text-[0.68rem] text-muted">{label}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[0.78rem] text-muted">
              {st.exam ? (
                <>
                  Next: <b className="text-ink-2">{st.exam.title}</b> in {st.days} day{st.days === 1 ? '' : 's'}, {st.readiness}% ready
                </>
              ) : (
                `${units} unit${units === 1 ? '' : 's'} in the syllabus`
              )}
            </p>
          </div>
        </Link>
      </div>
    </motion.div>
  )
}

export default function Subjects() {
  const data = useStore()
  const openEditor = useUI((s) => s.openEditor)
  const overall = overallProgress(data)
  return (
    <>
      <PageHeader
        eyebrowIcon={BookOpen}
        title="Subjects"
        sub={
          data.subjects.length ? (
            <>
              {data.subjects.length} subjects · <Count value={overall.done} /> of {overall.total} topics covered across the semester
            </>
          ) : (
            'Each subject holds its syllabus, exams, assignments and study time.'
          )
        }
        actions={
          <Button variant="primary" data-tour="add-subject" onClick={() => openEditor('subject')}>
            <Plus /> Add subject
          </Button>
        }
      />
      {data.subjects.length === 0 ? (
        <Empty
          pose="hug"
          title="Add your first subject"
          text="Start with the subjects on your timetable. Then add each one’s units and topics."
          action={
            <Button variant="primary" size="sm" onClick={() => openEditor('subject')}>
              <Plus /> Add subject
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {data.subjects.map((s, i) => (
            <SubjectCard key={s.id} subject={s} data={data} index={i} />
          ))}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: data.subjects.length * 0.07 }}
            onClick={() => openEditor('subject')}
            className="draw flex min-h-72 flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-line-strong text-muted transition-colors hover:border-gold hover:text-gold"
          >
            <span className="grid size-12 place-items-center rounded-2xl border border-line-strong">
              <Plus className="size-6" />
            </span>
            <span className="font-semibold">Add a subject</span>
          </motion.button>
        </div>
      )}
    </>
  )
}
