// Revision planner pieces: "how sure are you?" on a ticked topic, and the
// "Revise today" card fed by the spaced-revision queue (lib/planner/revision.js).
import { useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Refresh, Target } from './icons.jsx'
import { Button, Card, CardHeader, Empty, SubjectTag, cn, useToast } from './ui.jsx'
import { openQuiz } from '../lib/ui.js'
import { useStore } from '../lib/store.js'
import { CONFIDENCE, nextGap, revisionQueue } from '../lib/planner/revision.js'
import { todayISO } from '../lib/dates.js'

export const CONF_COLOR = { shaky: 'var(--coral)', ok: 'var(--gold)', solid: 'var(--mint)' }

// Three small choices. Tapping the current one again keeps it (no accidental clears).
export function ConfidencePicker({ value, onChange, label, className }) {
  return (
    <div role="radiogroup" aria-label={`How sure are you about ${label}?`} className={cn('flex shrink-0 items-center gap-0.5 rounded-lg border border-line p-0.5', className)}>
      {Object.entries(CONFIDENCE).map(([k, c]) => {
        const on = value === k
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={on}
            title={c.label}
            onClick={() => onChange(k)}
            className={cn('rounded-md px-1.5 py-0.5 text-[0.68rem] font-bold transition-colors', on ? 'text-black' : 'text-muted hover:text-ink')}
            style={on ? { background: CONF_COLOR[k] } : undefined}
          >
            {c.label}
          </button>
        )
      })}
    </div>
  )
}

export function ReviseCard({ data, limit = 5 }) {
  const reviseTopic = useStore((s) => s.reviseTopic)
  const toast = useToast()
  const queue = useMemo(() => revisionQueue(data, { today: todayISO() }), [data])
  const anyTicked = data.topics.some((t) => t.done)
  if (!anyTicked) return null
  return (
    <Card accent="var(--sand)" className="p-5 sm:p-6">
      <CardHeader title="Revise today" icon={Refresh} sub="A quick look back at topics you've covered. Tap how it went, or take a quick quiz." />
      {queue.length === 0 ? (
        <Empty compact pose="thumbs" className="mt-4" title="Nothing to revise today" text="Ticked topics come back here a few days later, sooner if you mark them shaky." />
      ) : (
        <ul className="mt-4 space-y-2">
          <AnimatePresence initial={false}>
            {queue.slice(0, limit).map((q) => (
              <motion.li key={q.topicId} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="rounded-xl border border-line p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{q.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[0.75rem] text-muted">
                      <SubjectTag subjectId={q.subjectId} short /> {q.reason}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
                  <ConfidencePicker
                    className="self-start sm:self-auto"
                    label={q.title}
                    value={null}
                    onChange={(c) => {
                      reviseTopic(q.topicId, c)
                      const n = nextGap(c, q.revisions + 1)
                      toast(`Revised ${q.title}`, { description: `Next look in ${n} day${n === 1 ? '' : 's'}.` })
                    }}
                  />
                  <Button variant="ghost" size="sm" className="-mr-1 h-8 px-2 text-[0.75rem]" onClick={() => openQuiz([q.topicId], q.title)}>
                    <Target /> Quiz me
                  </Button>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      {queue.length > limit && <p className="mt-3 text-[0.78rem] text-muted">{queue.length - limit} more after these.</p>}
    </Card>
  )
}
