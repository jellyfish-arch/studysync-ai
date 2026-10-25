// Mission Planner: multi-day study plans built from the student's real data,
// checked for feasibility, approved before anything touches the calendar,
// tracked against reality and repaired when life happens.
//
// Plans are made by the StudySync server (it enforces plan limits). The risk
// radar runs in the browser, so it also works offline.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, ArrowRight, BarChart3, CalendarCheck2, Check, ChevronDown, Flag, GraduationCap, Lightbulb, ListChecks, Refresh, Route, Sparkles, Target, Trash2, Wand } from '../../components/icons.jsx'
import { Badge, Button, Card, CardHeader, Choice, Empty, Field, PageHeader, Toggle, cn, useToast } from '../../components/ui.jsx'
import { Allowance, PlanBadge, UpgradeNote } from '../../components/plan.jsx'
import { colorOf, useStore } from '../../lib/store.js'
import { useSync } from '../../lib/sync.js'
import { api } from '../../lib/api.js'
import { loadAccount, useAccount } from '../../lib/account.js'
import { analyzeRisks } from '../../lib/planner/risks.js'
import { GOAL_TYPES } from '../../lib/planner/context.js'
import { upcomingExams } from '../../lib/selectors.js'
import { formatMinutes, formatTime, shortDate, shortWeekday, todayISO } from '../../lib/dates.js'
import { say } from '../../yuuki/state.js'
import { YuukiPose } from '../../yuuki/Yuuki.jsx'

const VERDICT = {
  feasible: { label: 'Fits', color: 'var(--mint)', pose: 'thumbs' },
  tight: { label: 'Tight', color: 'var(--gold)', pose: 'think' },
  infeasible: { label: "Doesn't fit", color: 'var(--coral)', pose: 'worried' },
}
const KIND_COLOR = { unit: 'var(--gold)', practice: 'var(--teal)', revision: 'var(--mint)', exam: 'var(--rose)', assignment: 'var(--coral)', checkpoint: 'var(--lime)' }
const LEVEL = { high: 'var(--danger)', medium: 'var(--warning)', low: 'var(--muted)' }
const errText = (e) => e?.message || 'Something went wrong.'

/* ---------- risk radar (in the browser, free) ---------- */
function RiskRadar({ onPlan }) {
  const data = useStore()
  const risks = useMemo(() => analyzeRisks(data, { today: todayISO() }), [data])
  return (
    <Card accent="var(--coral)" className="p-6">
      <CardHeader title="Risk radar" icon={AlertTriangle} sub="What could go wrong soon, and why. Worked out from your own data." />
      {risks.length === 0 ? (
        <Empty compact pose="thumbs" className="mt-4" title="Nothing worrying right now" text="No close exams at low readiness, nothing overdue, no pile-up of deadlines." />
      ) : (
        <ul className="mt-4 space-y-2">
          {risks.slice(0, 6).map((r, i) => (
            <motion.li key={r.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="rounded-2xl border border-line p-3.5">
              <div className="flex items-start gap-3">
                <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: LEVEL[r.level] }} title={`${r.level} risk`} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{r.title}</p>
                  <p className="mt-0.5 text-[0.82rem] text-muted">{r.reason}</p>
                  {r.next?.plan ? (
                    <Button variant="ghost" size="sm" className="-ml-2.5 mt-1" onClick={() => onPlan(r.next.plan, r.next.scenarios)}>
                      {r.next.label} <ArrowRight />
                    </Button>
                  ) : r.next?.to ? (
                    <Link to={r.next.to} className="-ml-2.5 mt-1 inline-block">
                      <Button variant="ghost" size="sm">
                        {r.next.label} <ArrowRight />
                      </Button>
                    </Link>
                  ) : null}
                </div>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/* ---------- composer ---------- */
const HOURS = [60, 90, 120, 180, 240, 300]

function Composer({ preset, onDraft, onCompare, busy, maxVariants }) {
  const exams = useStore((s) => s.exams)
  const dailyGoal = useStore((s) => s.prefs.dailyGoal)
  const upcoming = useMemo(() => upcomingExams({ exams }), [exams])
  const [goal, setGoal] = useState({ type: 'week' })
  const [daily, setDaily] = useState(dailyGoal || 180)
  const [weekendOn, setWeekendOn] = useState(false)
  const [weekend, setWeekend] = useState(240)
  const [perTopic, setPerTopic] = useState(45)
  const [strategy, setStrategy] = useState('deadline')
  const [buffer, setBuffer] = useState('balanced')
  const [startTime, setStartTime] = useState('18:00')
  const [withAssignments, setWithAssignments] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!preset) return
    setGoal({ type: preset.type, exam: preset.exam, targetDate: preset.targetDate })
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [preset])

  const options = { dailyMinutes: daily, weekendMinutes: weekendOn ? weekend : undefined, minutesPerTopic: perTopic, strategy, buffer, startTime, ...(goal.type === 'exam' ? { includeAssignments: withAssignments } : {}) }
  const goalOut = { type: goal.type, exam: goal.type === 'exam' ? goal.exam || upcoming[0]?.id : undefined, withinDays: goal.type === 'exams' ? goal.withinDays || 14 : undefined, targetDate: ['semester', 'recovery'].includes(goal.type) ? goal.targetDate || undefined : undefined }
  const variants = [
    { label: `${formatMinutes(daily)} a day (yours)`, options: {} },
    { label: `${formatMinutes(daily + 60)} a day`, options: { dailyMinutes: daily + 60 } },
    { label: `${formatMinutes(Math.max(45, daily - 60))} a day`, options: { dailyMinutes: Math.max(45, daily - 60) } },
    { label: 'Spread across everything', options: { strategy: strategy === 'spread' ? 'deadline' : 'spread' } },
  ].slice(0, maxVariants || 2)

  return (
    <Card accent="var(--teal)" className="scroll-mt-24 p-6" ref={ref}>
      <CardHeader title="New mission" icon={Wand} sub="Tell me the goal and how much time you really have. I'll draft a plan you can check before anything is added." action={<Allowance id="planner.generate" />} />
      <div className="mt-5 space-y-5">
        <div>
          <span className="field-label">Goal</span>
          <Choice id="goal" label="Goal" value={goal.type} onChange={(type) => setGoal({ ...goal, type })} options={Object.entries(GOAL_TYPES).map(([value, label]) => ({ value, label }))} size="sm" />
        </div>
        {goal.type === 'exam' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Which exam">
              <select className="input" value={goal.exam || upcoming[0]?.id || ''} onChange={(e) => setGoal({ ...goal, exam: e.target.value })}>
                {upcoming.length === 0 && <option value="">No upcoming exams</option>}
                {upcoming.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} · {shortDate(e.date)}
                  </option>
                ))}
              </select>
            </Field>
            <div>
              <span className="field-label">Also plan assignments due before it</span>
              <Toggle label="Include assignments" checked={withAssignments} onChange={setWithAssignments} />
            </div>
          </div>
        )}
        {goal.type === 'exams' && (
          <Field label="Exams in the next" className="max-w-xs">
            <select className="input" value={goal.withinDays || 14} onChange={(e) => setGoal({ ...goal, withinDays: Number(e.target.value) })}>
              {[7, 14, 21, 30].map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </Field>
        )}
        {['semester', 'recovery'].includes(goal.type) && (
          <Field label={goal.type === 'semester' ? 'Plan until (default: your last exam)' : 'Catch up by (default: a week)'} className="max-w-xs">
            <input className="input num" type="date" min={todayISO()} value={goal.targetDate || ''} onChange={(e) => setGoal({ ...goal, targetDate: e.target.value })} />
          </Field>
        )}
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <span className="field-label">Study time on a normal day</span>
            <Choice id="daily" label="Daily study time" value={daily} onChange={setDaily} options={[...new Set([...HOURS, dailyGoal || 180])].sort((a, b) => a - b).map((m) => ({ value: m, label: formatMinutes(m) }))} size="sm" />
            <label className="mt-3 flex items-center gap-3 text-sm text-ink-2">
              <Toggle label="Different on weekends" checked={weekendOn} onChange={setWeekendOn} /> Different on weekends
            </label>
            {weekendOn && <Choice id="weekend" label="Weekend study time" value={weekend} onChange={setWeekend} options={[0, ...HOURS].map((m) => ({ value: m, label: m ? formatMinutes(m) : 'Off' }))} size="sm" className="mt-2" />}
          </div>
          <div>
            <span className="field-label">One topic usually takes me</span>
            <Choice id="topic" label="Minutes per topic" value={perTopic} onChange={setPerTopic} options={[30, 45, 60, 90].map((m) => ({ value: m, label: formatMinutes(m) }))} size="sm" />
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
          <div>
            <span className="field-label">Order</span>
            <Choice id="strategy" label="Strategy" value={strategy} onChange={setStrategy} options={[{ value: 'deadline', label: 'Soonest first' }, { value: 'spread', label: 'Spread out' }]} size="sm" />
          </div>
          <div>
            <span className="field-label">Free time kept</span>
            <Choice id="buffer" label="Buffer" value={buffer} onChange={setBuffer} options={[{ value: 'relaxed', label: '25%' }, { value: 'balanced', label: '15%' }, { value: 'intensive', label: '5%' }]} size="sm" />
          </div>
          <Field label="I usually start at" className="w-[9.5rem]">
            <input className="input num" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
          <Button variant="primary" onClick={() => onDraft(goalOut, options)} disabled={busy}>
            <Route /> {busy === 'draft' ? 'Drafting…' : 'Draft my plan'}
          </Button>
          <Button variant="outline" onClick={() => onCompare(goalOut, options, variants)} disabled={busy}>
            <BarChart3 /> {busy === 'compare' ? 'Comparing…' : 'Compare study times'}
          </Button>
          <Allowance id="planner.scenarios" className="ml-1" />
        </div>
      </div>
    </Card>
  )
}

/* ---------- plan view ---------- */
function Verdict({ plan }) {
  const v = VERDICT[plan.feasibility.verdict]
  const f = plan.feasibility
  const pct = f.capacityMinutes ? Math.min(100, Math.round((f.scheduledMinutes / f.capacityMinutes) * 100)) : 0
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border p-4" style={{ borderColor: `color-mix(in srgb, ${v.color} 40%, transparent)` }}>
      <YuukiPose name={v.pose} className="w-16" />
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-bold" style={{ color: v.color }}>
          {v.label}
        </p>
        <p className="text-sm text-ink-2">{f.summary}</p>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
            <motion.div className="h-full rounded-full" style={{ background: v.color }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} />
          </div>
          <span className="num shrink-0 text-[0.75rem] text-muted">
            {formatMinutes(f.scheduledMinutes)} of {formatMinutes(f.capacityMinutes)} free time
          </span>
        </div>
      </div>
    </div>
  )
}

function Milestones({ items, progress }) {
  const state = (m) => progress?.milestones?.find((x) => x.key === m.key)?.state
  if (!items.length) return <p className="text-sm text-muted">No milestones in this plan.</p>
  return (
    <ol className="relative space-y-3 pl-5">
      <span className="absolute top-1 bottom-1 left-[5px] w-px bg-line-strong" aria-hidden="true" />
      {items.map((m) => {
        const st = state(m)
        return (
          <li key={m.key} className="relative">
            <span className="absolute top-1.5 -left-5 size-[11px] rounded-full border-2 bg-black" style={{ borderColor: KIND_COLOR[m.kind] || 'var(--ink-2)', background: st === 'met' ? KIND_COLOR[m.kind] : '#000' }} />
            <p className="text-sm text-ink">
              <span className="num mr-2 font-mono text-[0.75rem] text-muted">{shortDate(m.date)}</span>
              {m.title}
              {m.atRisk && <Badge tone="warn" className="ml-2">at risk</Badge>}
              {st === 'met' && <Badge tone="good" className="ml-2">done</Badge>}
              {st === 'missed' && <Badge tone="bad" className="ml-2">missed</Badge>}
            </p>
          </li>
        )
      })}
    </ol>
  )
}

function Days({ days, progress }) {
  const [all, setAll] = useState(false)
  const subjects = useStore((s) => s.subjects)
  const withWork = days.filter((d) => d.tasks.length || d.exam)
  const shown = all ? withWork : withWork.slice(0, 7)
  const statusOf = (id) => progress?.tasks?.find((t) => t.id === id)?.status
  return (
    <div className="space-y-2">
      {shown.map((d) => (
        <div key={d.date} className="rounded-2xl border border-line p-3">
          <div className="flex items-center gap-3">
            <p className="w-24 shrink-0 text-sm font-semibold text-ink">
              {d.date === todayISO() ? 'Today' : `${shortWeekday(d.date)} ${shortDate(d.date)}`}
            </p>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3" title={`${formatMinutes(d.planned)} planned of ${formatMinutes(d.capacity)} free`}>
              <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${d.capacity ? Math.min(100, (d.planned / d.capacity) * 100) : 0}%` }} />
            </div>
            <span className="num w-20 shrink-0 text-right text-[0.75rem] text-muted">{formatMinutes(d.planned)}</span>
          </div>
          {d.exam && d.tasks.length === 0 && <p className="mt-2 text-[0.8rem] text-rose">Exam day</p>}
          <ul className="mt-2 space-y-1">
            {d.tasks.map((t) => {
              const st = statusOf(t.id)
              const c = colorOf(subjects.find((s) => s.id === t.subjectId)?.color)
              return (
                <li key={t.id} className="flex items-center gap-2 text-[0.84rem]">
                  <span className="num w-16 shrink-0 font-mono text-[0.72rem] text-muted">{formatTime(t.start)}</span>
                  <span className="size-1.5 shrink-0 rounded-full" style={{ background: c }} />
                  <span className={cn('min-w-0 flex-1 truncate', st === 'done' ? 'text-muted line-through' : 'text-ink-2')}>{t.title}</span>
                  {st === 'missed' && <Badge tone="bad">missed</Badge>}
                  <span className="num shrink-0 text-[0.72rem] text-muted">{t.minutes}m</span>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      {withWork.length > 7 && (
        <Button variant="ghost" size="sm" onClick={() => setAll(!all)}>
          <ChevronDown /> {all ? 'Show fewer days' : `Show all ${withWork.length} days`}
        </Button>
      )}
    </div>
  )
}

function Lines({ title, items, icon: Icon, color }) {
  if (!items?.length) return null
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[0.78rem] font-bold tracking-wide" style={{ color }}>
        <Icon className="size-4" /> {title}
      </p>
      <ul className="space-y-1 text-sm text-ink-2">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-current opacity-60" />
            {t}
          </li>
        ))}
      </ul>
    </div>
  )
}

function PlanView({ stored, progress, onApprove, onRepair, onStatus, onRedraft, busy }) {
  const latest = stored.revisions.at(-1)
  const active = stored.revisions.find((r) => r.rev === stored.activeRev)
  const proposal = latest.state === 'proposed' ? latest : null
  const shown = proposal || active || latest
  const plan = shown.plan
  const [openMore, setOpenMore] = useState(false)
  const [answers, setAnswers] = useState({})
  const [repairMinutes, setRepairMinutes] = useState(null)
  const blocks = plan.days.reduce((n, d) => n + d.tasks.length, 0)

  return (
    <Card accent="var(--gold)" className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[0.78rem] text-muted">
            <Badge tone={stored.status === 'active' ? 'good' : stored.status === 'draft' ? 'warn' : 'neutral'}>{stored.status === 'draft' ? 'Draft' : stored.status === 'active' ? 'Active' : 'Archived'}</Badge>
            {stored.createdBy === 'mcp' && <Badge>From your AI app</Badge>}
            {proposal && stored.status === 'active' && <Badge tone="warn">Changes waiting for you</Badge>}
            <span>
              {shortDate(plan.start)} to {shortDate(plan.end)} · revision {shown.rev}
            </span>
          </p>
          <h2 className="mt-1.5 font-display text-2xl font-bold text-ink">{plan.title}</h2>
        </div>
      </div>

      <div className="mt-4">
        <Verdict plan={plan} />
      </div>

      {proposal?.diff && (
        <div className="mt-4 rounded-2xl border border-line p-4">
          <p className="mb-2 font-semibold text-ink">What changes</p>
          <ul className="space-y-1 text-sm text-ink-2">
            {proposal.diff.summary.map((t, i) => (
              <li key={i} className="flex gap-2">
                <ArrowRight className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.78rem] text-muted">
            Finished work stays as it is. {proposal.diff.removeBlocks.length} unfinished block{proposal.diff.removeBlocks.length === 1 ? '' : 's'} from this plan will be replaced; blocks you planned yourself are not touched.
          </p>
        </div>
      )}

      {plan.questions?.length > 0 && stored.status === 'draft' && (
        <div className="mt-4 rounded-2xl border border-dashed border-line-strong p-4">
          <p className="mb-2 flex items-center gap-2 font-semibold text-ink">
            <Lightbulb className="size-4 text-gold" /> A few things I guessed
          </p>
          <div className="space-y-3">
            {plan.questions.map((q) => (
              <div key={q.id}>
                <p className="text-sm text-ink-2">{q.question}</p>
                {q.choices && (
                  <Choice id={`q-${q.id}`} label={q.question} size="sm" className="mt-1.5 w-fit" value={answers[q.id] ?? q.default} onChange={(v) => setAnswers({ ...answers, [q.id]: v })} options={q.choices.map((c) => ({ value: c, label: formatMinutes(c) }))} />
                )}
                {q.action?.open && (
                  <Link to={q.action.open} className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink">
                    Open it <ArrowRight className="size-4" />
                  </Link>
                )}
              </div>
            ))}
          </div>
          {Object.keys(answers).length > 0 && (
            <Button variant="soft" size="sm" className="mt-3" onClick={() => onRedraft(stored, answers)} disabled={busy}>
              <Refresh /> Redraft with my answers
            </Button>
          )}
        </div>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-5">
          <div>
            <p className="mb-3 flex items-center gap-2 font-semibold text-ink">
              <Flag className="size-4 text-[var(--accent)]" /> Milestones
            </p>
            <Milestones items={plan.milestones} progress={stored.status === 'active' && !proposal ? progress : null} />
          </div>
          <Lines title="WHAT COMES FIRST" icon={Target} color="var(--mint)" items={plan.priorities.prioritized} />
          <Lines title="DOESN'T FIT" icon={AlertTriangle} color="var(--coral)" items={plan.priorities.deferred} />
          <Lines title="CARRIES ON AFTER THIS PLAN" icon={ArrowRight} color="var(--muted)" items={plan.priorities.carried} />
          <Lines title="HEADS UP" icon={AlertTriangle} color="var(--warning)" items={plan.warnings.map((w) => w.message)} />
          <button type="button" onClick={() => setOpenMore(!openMore)} className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
            <motion.span animate={{ rotate: openMore ? 180 : 0 }}>
              <ChevronDown className="size-4" />
            </motion.span>
            Assumptions and how you'll know it's done
          </button>
          <AnimatePresence initial={false}>
            {openMore && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-4 overflow-hidden">
                <Lines title="ASSUMPTIONS" icon={Lightbulb} color="var(--gold)" items={plan.assumptions} />
                <Lines title="DONE WHEN" icon={Check} color="var(--mint)" items={plan.completion} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div>
          <p className="mb-3 flex items-center gap-2 font-semibold text-ink">
            <CalendarCheck2 className="size-4 text-[var(--accent)]" /> Day by day
          </p>
          <Days days={plan.days} progress={stored.status === 'active' && !proposal ? progress : null} />
        </div>
      </div>

      {stored.status === 'active' && !proposal && progress?.counts && (
        <div className="mt-5 rounded-2xl border border-line p-4">
          <p className="mb-2 font-semibold text-ink">Plan versus reality</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-mint">{progress.counts.done} done</span>
            <span className="text-danger">{progress.counts.missed} missed</span>
            <span className="text-ink-2">{progress.counts.pending} to go</span>
            {progress.counts.removed > 0 && <span className="text-muted">{progress.counts.removed} removed by you</span>}
          </div>
          {progress.slipping.length > 0 && <p className="mt-2 text-[0.82rem] text-muted">Keeps slipping: {progress.slipping.map((s) => `${s.subject} (${s.missed} missed)`).join(', ')}. No judgement; maybe those need a different time of day.</p>}
          {progress.underestimated.length > 0 && <p className="mt-1 text-[0.82rem] text-muted">Takes longer than planned: {progress.underestimated.map((s) => `${s.subject} (about ${Math.round((s.ratio - 1) * 100)}% more)`).join(', ')}.</p>}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-5">
        {(stored.status === 'draft' || proposal) && (
          <Button variant="primary" onClick={() => onApprove(stored, shown.rev)} disabled={busy || !blocks}>
            <Check /> {proposal && stored.status === 'active' ? 'Apply these changes' : `Approve and add ${blocks} study block${blocks === 1 ? '' : 's'}`}
          </Button>
        )}
        {stored.status === 'draft' && (
          <Button variant="ghost" onClick={() => onStatus(stored, 'deleted')} disabled={busy}>
            <Trash2 /> Discard draft
          </Button>
        )}
        {stored.status === 'active' && !proposal && (
          <>
            <Button variant="outline" onClick={() => onRepair(stored, repairMinutes ? { dailyMinutes: repairMinutes } : {})} disabled={busy}>
              <Refresh /> Repair from today
            </Button>
            <select className="input h-9 w-auto min-w-0 py-0 text-[0.8rem]" value={repairMinutes || ''} onChange={(e) => setRepairMinutes(e.target.value ? Number(e.target.value) : null)} aria-label="New daily study time">
              <option value="">Same study time</option>
              {HOURS.map((m) => (
                <option key={m} value={m}>
                  {formatMinutes(m)} a day
                </option>
              ))}
            </select>
            <Allowance id="planner.repair" />
            <Button variant="ghost" className="ml-auto" onClick={() => onStatus(stored, 'archived')} disabled={busy}>
              Archive
            </Button>
          </>
        )}
        {stored.status === 'archived' && (
          <Button variant="ghost" onClick={() => onStatus(stored, 'active')} disabled={busy}>
            Make active again
          </Button>
        )}
      </div>
    </Card>
  )
}

/* ---------- scenarios ---------- */
function Scenarios({ rows, replaces, onClose }) {
  const sub = `Same goal, different assumptions. Nothing was saved.${replaces?.length ? ` Your active mission "${replaces[0].title}" is treated as free time, as if you re-planned it.` : ''}`
  return (
    <Card accent="var(--teal)" className="p-6">
      <CardHeader title="Compare study times" icon={BarChart3} sub={sub} action={<Button variant="ghost" size="sm" onClick={onClose}>Close</Button>} />
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {rows.map((r, i) => {
          const v = VERDICT[r.verdict] || VERDICT.feasible
          return (
            <motion.div key={r.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="rounded-2xl border p-4" style={{ borderColor: `color-mix(in srgb, ${v.color} 35%, transparent)` }}>
              <p className="font-semibold text-ink">{r.label}</p>
              {r.empty ? (
                <p className="mt-2 text-sm text-muted">{r.reason}</p>
              ) : (
                <>
                  <p className="mt-1 font-display text-lg font-bold" style={{ color: v.color }}>
                    {v.label}
                  </p>
                  <p className="text-[0.82rem] text-ink-2">{formatMinutes(r.scheduledMinutes)} over {r.studyDays} days</p>
                  {r.shortfallMinutes > 0 && <p className="text-[0.82rem] text-coral">{formatMinutes(r.shortfallMinutes)} won't fit</p>}
                  <ul className="mt-2 space-y-0.5 text-[0.78rem] text-muted">
                    {r.examCoverage.map((e) => (
                      <li key={e.exam}>
                        {e.exam}: {e.topicsPlanned} of {e.topicsLeft} topics
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </motion.div>
          )
        })}
      </div>
    </Card>
  )
}

/* ---------- weekly review ---------- */
function Review({ account, onPlan }) {
  const [review, setReview] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const included = account?.entitlements?.find((e) => e.id === 'review.weekly')?.included
  const run = async () => {
    setBusy(true)
    try {
      setReview(await api('/planner/review'))
      setError(null)
      loadAccount()
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card accent="var(--lime)" className="p-6">
      <CardHeader title="Weekly review" icon={ListChecks} sub="The last seven days, what's next, and what to adjust." action={included ? <Allowance id="review.weekly" /> : null} />
      {!included ? (
        <UpgradeNote className="mt-4" message="Weekly reviews are part of StudySync Plus." upgradeTo="plus" />
      ) : error ? (
        <p className="mt-4 text-sm text-danger">{errText(error)}</p>
      ) : !review ? (
        <Button variant="outline" className="mt-4" onClick={run} disabled={busy}>
          {busy ? 'Reviewing…' : 'Review my week'}
        </Button>
      ) : (
        <div className="mt-4 space-y-3 text-sm">
          <p className="font-semibold text-ink">{review.headline}</p>
          <div className="flex flex-wrap gap-4 text-ink-2">
            <span>{formatMinutes(review.studiedMinutes)} studied</span>
            <span>
              {review.blocks.done}/{review.blocks.planned} blocks
            </span>
            <span>{review.topicsTicked} topics ticked</span>
            <span>{review.goalDays} days at goal</span>
          </div>
          {review.suggestions.length > 0 && (
            <ul className="space-y-1.5">
              {review.suggestions.map((s, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 text-ink-2">
                  <ArrowRight className="size-4 text-lime" /> {s.text}
                  {s.next?.plan ? (
                    <Button variant="ghost" size="sm" onClick={() => onPlan(s.next.plan)}>
                      {s.next.label}
                    </Button>
                  ) : s.next?.to ? (
                    <Link to={s.next.to}>
                      <Button variant="ghost" size="sm">
                        {s.next.label}
                      </Button>
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}

/* ---------- page ---------- */
export default function Missions() {
  const health = useSync((s) => s.health)
  const syncStatus = useSync((s) => s.status)
  const account = useAccount((s) => s.summary)
  const toast = useToast()
  const [plans, setPlans] = useState([])
  const [selected, setSelected] = useState(null) // { plan, progress }
  const [scenarios, setScenarios] = useState(null)
  const [preset, setPreset] = useState(null)
  const [busy, setBusy] = useState(false)
  const [limit, setLimit] = useState(null)
  const [error, setError] = useState(null)
  const viewRef = useRef(null)
  const online = Boolean(health?.sync) && syncStatus !== 'signed-out'

  const refresh = useCallback(async () => {
    try {
      const { plans: list } = await api('/plans')
      setPlans(list)
      return list
    } catch {
      return []
    }
  }, [])

  const open = useCallback(async (id, scroll = true) => {
    try {
      const out = await api(`/plans/${id}`)
      setSelected(out)
      if (scroll) setTimeout(() => viewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    } catch (e) {
      toast(errText(e))
    }
  }, [toast])

  useEffect(() => {
    if (!online) return
    loadAccount()
    refresh().then((list) => {
      const pick = list.find((p) => p.pendingRev) || list.find((p) => p.status === 'active') || list[0]
      if (pick) open(pick.id, false)
    })
  }, [online, refresh, open])

  const guard = async (kind, fn) => {
    setBusy(kind)
    setLimit(null)
    setError(null)
    try {
      await fn()
    } catch (e) {
      if (e.status === 402) setLimit({ message: e.message, upgradeTo: e.data?.entitlement?.upgradeTo })
      else if (e.status === 409 && e.data?.errors) setError({ message: e.message, errors: e.data.errors })
      else setError({ message: errText(e) })
    } finally {
      setBusy(false)
      loadAccount()
    }
  }

  const draft = (goal, options) =>
    guard('draft', async () => {
      say({ pose: 'think', text: 'Give me a second, I am fitting everything around your calendar...', duration: 2500 })
      const out = await api('/planner/draft', { method: 'POST', body: { goal, options }, timeout: 30000 })
      if (out.empty) {
        say({ force: true, pose: 'oops', text: out.reason })
        return
      }
      await refresh()
      await open(out.plan.id)
      const v = out.plan.revisions[0].plan.feasibility.verdict
      say({ force: true, pose: VERDICT[v].pose, text: v === 'feasible' ? 'It fits! Check it, then approve when you are happy.' : v === 'tight' ? 'It fits, but only just. A buffer day would help if you can find one.' : "Honestly? Not all of it fits. Look at what's deferred, or compare more study time." })
      if (out.upgradeHint) toast(out.upgradeHint)
    })

  const compare = (goal, options, variants) =>
    guard('compare', async () => {
      const out = await api('/planner/scenarios', { method: 'POST', body: { goal, options, variants }, timeout: 30000 })
      setScenarios({ rows: out.scenarios, replaces: out.replaces })
    })

  const approve = (stored, rev) =>
    guard('approve', async () => {
      const out = await api(`/plans/${stored.id}/approve`, { method: 'POST', body: { revision: rev } })
      toast(out.already ? 'Already on your calendar' : `Added ${out.added} study blocks${out.removed ? `, replaced ${out.removed}` : ''}`)
      if (!out.already) say({ force: true, pose: 'jump', text: `Mission on! ${out.added} blocks are in your planner. I'll keep an eye on how it goes.` })
      await refresh()
      await open(stored.id, false)
    })

  const repair = (stored, changes) =>
    guard('repair', async () => {
      await api(`/plans/${stored.id}/repair`, { method: 'POST', body: { changes, reason: 'Repaired from the app' }, timeout: 30000 })
      await refresh()
      await open(stored.id, false)
      say({ force: true, pose: 'clipboard', text: 'Here is the repaired plan. Nothing changes until you apply it.' })
    })

  const setStatus = (stored, status) =>
    guard('status', async () => {
      await api(`/plans/${stored.id}/status`, { method: 'POST', body: { status } })
      if (status === 'deleted') setSelected(null)
      const list = await refresh()
      if (status !== 'deleted') await open(stored.id, false)
      else if (list[0]) await open(list[0].id, false)
    })

  const redraft = (stored, answers) => {
    const rev = stored.revisions.at(-1)
    const goal = { type: stored.goal.type, exams: stored.goal.examIds, exam: stored.goal.examIds?.[0], targetDate: stored.goal.type === 'week' ? undefined : stored.goal.end }
    return guard('draft', async () => {
      const out = await api('/planner/draft', { method: 'POST', body: { goal, options: { ...(rev.inputOptions || {}), ...answers } } })
      if (out.plan) {
        await api(`/plans/${stored.id}/status`, { method: 'POST', body: { status: 'deleted' } })
        await refresh()
        await open(out.plan.id, false)
      }
    })
  }

  const planFromRisk = (goal, scenariosToo) => {
    setPreset({ ...goal, at: Date.now() })
    if (scenariosToo) toast('Set your study time, then press "Compare study times".')
  }

  const maxVariants = account?.entitlements?.find((e) => e.id === 'planner.scenarios')?.limits?.maxVariants || 2

  return (
    <>
      <PageHeader eyebrowIcon={Route} title="Mission Planner" sub="Plans built from your real syllabus, exams and deadlines: checked for what fits, approved by you, repaired when life happens." actions={<PlanBadge />} />

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          {!online ? (
            <Card accent="var(--warning)" className="p-6">
              <div className="flex flex-wrap items-center gap-4">
                <YuukiPose name="sleepy" className="w-20" />
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-lg font-bold text-ink">{health ? 'Log in again to plan missions' : 'Mission Planner needs the StudySync server'}</h2>
                  <p className="mt-1 text-sm text-ink-2">{health ? 'You logged in while the server was off. Log out and back in.' : 'Plans are drafted and saved by the server on this computer. Start StudySync with npm run dev. The risk radar below still works.'}</p>
                </div>
              </div>
            </Card>
          ) : (
            <Composer preset={preset} onDraft={draft} onCompare={compare} busy={busy} maxVariants={maxVariants} />
          )}
          {limit && <UpgradeNote message={limit.message} upgradeTo={limit.upgradeTo} />}
          {error && (
            <div className="rounded-2xl border border-danger/40 p-4 text-sm">
              <p className="font-semibold text-danger">{error.message}</p>
              {error.errors && (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-ink-2">
                  {error.errors.slice(0, 6).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <AnimatePresence>{scenarios && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><Scenarios rows={scenarios.rows} replaces={scenarios.replaces} onClose={() => setScenarios(null)} /></motion.div>}</AnimatePresence>
          <div ref={viewRef} className="scroll-mt-24">
            {selected && <PlanView key={`${selected.plan.id}-${selected.plan.revisions.length}-${selected.plan.status}`} stored={selected.plan} progress={selected.progress} onApprove={approve} onRepair={repair} onStatus={setStatus} onRedraft={redraft} busy={busy} />}
          </div>
        </div>

        <div className="space-y-5">
          <RiskRadar onPlan={planFromRisk} />
          {online && (
            <Card accent="var(--rose)" className="p-6">
              <CardHeader title="Your missions" icon={Sparkles} sub={plans.length ? `${plans.filter((p) => p.status === 'active').length} active` : 'Drafts and plans appear here.'} />
              {plans.length === 0 ? (
                <Empty compact pose="clipboard" className="mt-4" title="No missions yet" text="Draft one on the left, or ask a connected AI app to plan your week." />
              ) : (
                <ul className="mt-4 space-y-2">
                  {plans.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => open(p.id)} className={cn('w-full rounded-2xl border p-3.5 text-left transition-colors hover:border-line-strong', selected?.plan.id === p.id ? 'border-[color-mix(in_srgb,var(--accent)_55%,transparent)]' : 'border-line')}>
                        <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                          <span className="size-2 rounded-full" style={{ background: VERDICT[p.verdict]?.color || 'var(--muted)' }} />
                          {p.title}
                        </p>
                        <p className="mt-1 flex flex-wrap gap-2 text-[0.75rem] text-muted">
                          <span>{p.status === 'draft' ? 'Draft' : p.status === 'active' ? 'Active' : 'Archived'}</span>·<span>{shortDate(p.start)} to {shortDate(p.end)}</span>·<span>{p.tasks} blocks</span>
                          {p.createdBy === 'mcp' && <span className="text-[var(--accent)]">from your AI app</span>}
                          {p.pendingRev && p.status === 'active' && <span className="text-warning">changes waiting</span>}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
          {online && <Review account={account} onPlan={planFromRisk} />}
          <Card accent="var(--sand)" className="p-6">
            <CardHeader title="How it works" icon={GraduationCap} />
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink-2">
              <li>It reads your remaining topics, exam dates, deadlines and the study blocks you already have.</li>
              <li>It fits the work into the time you said you have, keeping a buffer, soonest deadline first.</li>
              <li>It tells you honestly if it fits, what it assumed, and what it had to leave out.</li>
              <li>Nothing touches your calendar until you approve. Missed days? Repair it from today.</li>
            </ol>
            <p className="mt-3 text-[0.78rem] text-muted">Ticking every topic means you covered it, not that you mastered it. No plan can promise marks.</p>
          </Card>
        </div>
      </div>
    </>
  )
}
