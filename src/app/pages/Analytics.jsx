import { useState } from 'react'
import { motion } from 'motion/react'
import { Activity, BarChart3, BookOpenCheck, CalendarCheck2, Clock3, Flame, Lightbulb, PieChart, Target } from '../../components/icons.jsx'
import RubberSegment from '../../components/rb/RubberSegment/RubberSegment.jsx'
import { Badge, Card, CardHeader, Count, Duration, Empty, PageHeader, ProgressBar, Stagger } from '../../components/ui.jsx'
import { DayBars, Heatmap, SubjectDonut } from '../../components/charts.jsx'
import { segProps } from './Assignments.jsx'
import { colorOf, useStore } from '../../lib/store.js'
import { examReadiness, longestStreak, minutesByDay, minutesBySubject, streak, subjectProgress, topicsDoneInRange, upcomingExams } from '../../lib/selectors.js'
import { formatDay, formatMinutes, lastNDays, todayISO } from '../../lib/dates.js'
import { YuukiPose } from '../../yuuki/Yuuki.jsx'

function Kpi({ icon: Icon, label, value, sub, color, index }) {
  return (
    <Card accent={color} className="draw relative overflow-hidden p-5">
      <motion.span
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 15, delay: 0.1 + index * 0.06 }}
        className="draw-now grid size-10 place-items-center rounded-xl border"
        style={{ color, borderColor: `color-mix(in srgb, ${color} 35%, transparent)` }}
      >
        <Icon className="size-5" />
      </motion.span>
      <p className="num mt-3 font-display text-3xl font-bold text-ink">{value}</p>
      <p className="text-sm font-medium text-ink-2">{label}</p>
      {sub && <p className="mt-0.5 text-[0.75rem] text-muted">{sub}</p>}
    </Card>
  )
}

export default function Analytics() {
  const data = useStore()
  const [range, setRange] = useState(7)
  const today = todayISO()
  const days = minutesByDay(data, range, today)
  const inRange = new Set(lastNDays(range, today))
  const total = days.reduce((s, d) => s + d.minutes, 0)
  const activeDays = days.filter((d) => d.minutes > 0).length
  const avg = activeDays ? Math.round(total / activeDays) : 0
  const blocks = data.blocks.filter((b) => inRange.has(b.date) && b.date <= today)
  const followed = blocks.length ? Math.round((blocks.filter((b) => b.done).length / blocks.length) * 100) : 0
  const bySubject = minutesBySubject(data, range, today)
  const rows = data.subjects.map((s) => ({ id: s.id, name: s.name, color: s.color, minutes: bySubject[s.id] || 0 })).sort((a, b) => b.minutes - a.minutes)
  const best = [...days].sort((a, b) => b.minutes - a.minutes)[0]
  const neglected = rows.filter((r) => r.minutes === 0)
  const nextExam = upcomingExams(data, today)[0]
  const goal = data.prefs.dailyGoal || 180
  const goalDays = days.filter((d) => d.minutes >= goal).length

  const insights = []
  if (rows[0]?.minutes) insights.push(`Most of your time went to ${rows[0].name}: ${formatMinutes(rows[0].minutes)}, ${Math.round((rows[0].minutes / Math.max(1, total)) * 100)}% of the total.`)
  if (best?.minutes) insights.push(`Your best day was ${formatDay(best.date)} with ${formatMinutes(best.minutes)}.`)
  if (neglected.length) insights.push(`${neglected.map((r) => r.name).join(', ')} had no study time in this period.`)
  if (nextExam) {
    const sub = data.subjects.find((s) => s.id === nextExam.subjectId)
    const r = examReadiness(data, nextExam)
    insights.push(`Next up is ${sub?.name}: ${nextExam.title}. ${r.pct}% of its topics are covered.`)
  }
  insights.push(`You hit your ${formatMinutes(goal)} daily goal on ${goalDays} of ${range} days.`)

  return (
    <>
      <PageHeader
        eyebrowIcon={BarChart3}
        title="Analytics"
        sub="Built only from the time you’ve logged and the topics you’ve ticked."
        actions={
          <RubberSegment
            {...segProps}
            aria-label="Range"
            items={[
              { value: 7, label: '7 days' },
              { value: 30, label: '30 days' },
              { value: 90, label: '90 days' },
            ]}
            value={range}
            onChange={setRange}
          />
        }
      />
      {data.sessions.length === 0 ? (
        <Empty pose="think" title="No study time logged yet" text="Finish a focus session or log time and your charts appear here. I'll start spotting patterns after a few days." />
      ) : (
        <Stagger className="grid grid-cols-1 gap-5 lg:grid-cols-12" key={range}>
          <div className="grid grid-cols-2 gap-4 lg:col-span-12 lg:grid-cols-5">
            <Kpi index={0} icon={Clock3} label="Time studied" value={<Duration minutes={total} />} sub={`Last ${range} days`} color="var(--lime)" />
            <Kpi index={1} icon={Activity} label="Daily average" value={<Duration minutes={avg} />} sub={`On ${activeDays} active days`} color="var(--teal)" />
            <Kpi
              index={2}
              icon={Flame}
              label="Current streak"
              value={
                <>
                  <Count value={streak(data, today)} /> <span className="text-base text-muted">days</span>
                </>
              }
              sub={`Longest: ${longestStreak(data)} days`}
              color="var(--orange)"
            />
            <Kpi index={3} icon={BookOpenCheck} label="Topics covered" value={<Count value={topicsDoneInRange(data, range, today)} />} sub={`In the last ${range} days`} color="var(--gold)" />
            <Kpi
              index={4}
              icon={CalendarCheck2}
              label="Plan followed"
              value={
                <>
                  <Count value={followed} />%
                </>
              }
              sub={`${blocks.filter((b) => b.done).length} of ${blocks.length} blocks done`}
              color="var(--mint)"
            />
          </div>

          <Card accent="var(--lime)" className="p-5 sm:p-6 lg:col-span-8">
            <CardHeader title="Daily study time" icon={BarChart3} sub="Dashed line is your daily goal" action={<Badge tone="primary">{formatMinutes(total)}</Badge>} />
            <div className="mt-8">
              <DayBars days={days.map((d) => ({ ...d, planned: 0 }))} showPlanned={false} goal={goal} height={210} />
            </div>
          </Card>

          <Card accent="var(--mint)" className="relative p-5 sm:p-6 lg:col-span-4">
            <div className="absolute -top-3 right-3 w-16">
              <YuukiPose name="think" className="w-full" />
            </div>
            <CardHeader title="Yuuki's notes" icon={Lightbulb} sub="What the numbers say" />
            <ul className="mt-4 space-y-3">
              {insights.map((t, i) => (
                <motion.li key={t} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.08 }} className="flex gap-3 rounded-xl border border-line p-3 text-sm text-ink-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-mint" />
                  {t}
                </motion.li>
              ))}
            </ul>
          </Card>

          <Card accent="var(--gold)" className="p-5 sm:p-6 lg:col-span-5">
            <CardHeader title="Time by subject" icon={PieChart} sub={`Last ${range} days`} />
            <div className="mt-5">
              <SubjectDonut rows={rows.filter((r) => r.minutes > 0)} />
            </div>
          </Card>

          <Card accent="var(--orange)" className="p-5 sm:p-6 lg:col-span-7">
            <CardHeader title="Study consistency" icon={Flame} sub="Each square is a day. Brighter means more study." />
            <div className="mt-5">
              <Heatmap sessions={data.sessions} weeks={20} />
            </div>
          </Card>

          <Card accent="var(--gold)" className="p-5 sm:p-6 lg:col-span-12">
            <CardHeader title="Syllabus coverage" icon={Target} sub="Topics ticked off, with readiness for each subject’s next exam" />
            <div className="mt-5 grid grid-cols-1 gap-x-10 gap-y-5 md:grid-cols-2">
              {data.subjects.map((s, i) => {
                const p = subjectProgress(data, s.id)
                const exam = upcomingExams(data, today).find((e) => e.subjectId === s.id)
                const r = exam ? examReadiness(data, exam) : null
                return (
                  <div key={s.id}>
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2 font-semibold text-ink">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorOf(s.color) }} />
                        <span className="truncate">{s.name}</span>
                      </span>
                      <span className="num shrink-0 text-muted">
                        {p.done}/{p.total} · <b className="text-ink">{p.pct}%</b>
                      </span>
                    </div>
                    <ProgressBar value={p.pct} color={colorOf(s.color)} delay={i * 0.06} />
                    {r && (
                      <p className="mt-1 text-[0.75rem] text-muted">
                        {exam.title}: {r.pct}% of its topics covered
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        </Stagger>
      )}
    </>
  )
}
