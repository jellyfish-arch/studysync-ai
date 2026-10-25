// Weekly academic review: what happened in the last seven days, what is
// coming, and suggested adjustments the student can accept or ignore.
import { addDays, formatMinutes, lastNDays, todayISO } from '../dates.js'
import { minutesOn } from '../selectors.js'
import { analyzeRisks } from './risks.js'
import { planProgress } from './progress.js'

export function weeklyReview(data, plans = [], { today = todayISO() } = {}) {
  const week = lastNDays(7, today)
  const set = new Set(week)
  const studied = week.reduce((m, d) => m + minutesOn(data, d), 0)
  const blocks = data.blocks.filter((b) => set.has(b.date) && b.date < today)
  const done = blocks.filter((b) => b.done)
  const plannedMin = blocks.reduce((m, b) => m + b.minutes, 0)
  const topicsTicked = data.topics.filter((t) => t.done && set.has(t.doneOn))
  const assignmentsDone = data.assignments.filter((a) => a.status === 'done' && a.doneOn && set.has(a.doneOn))
  const goal = data.prefs.dailyGoal || 180
  const goalDays = week.filter((d) => minutesOn(data, d) >= goal).length

  const planReports = plans
    .filter((p) => p.status === 'active')
    .map((p) => {
      const rev = p.revisions.find((r) => r.rev === p.activeRev)
      const pr = planProgress(data, p.id, rev.rev, rev.plan, { today })
      return { id: p.id, title: p.title, counts: pr.counts, milestonesMet: pr.milestones.filter((m) => m.state === 'met').length, milestonesMissed: pr.milestones.filter((m) => m.state === 'missed').map((m) => m.title), slipping: pr.slipping, underestimated: pr.underestimated }
    })

  const risks = analyzeRisks(data, { today }).slice(0, 5)
  const suggestions = []
  for (const p of planReports) if (p.counts.missed) suggestions.push({ kind: 'repair', planId: p.id, text: `Repair "${p.title}": ${p.counts.missed} block${p.counts.missed === 1 ? '' : 's'} missed.` })
  for (const p of planReports) for (const u of p.underestimated) suggestions.push({ kind: 'estimate', text: `${u.subject} work took about ${Math.round((u.ratio - 1) * 100)}% longer than planned. Plan longer topics for it next time.` })
  const avg = Math.round(studied / 7)
  if (avg && avg < goal * 0.6) suggestions.push({ kind: 'budget', text: `You averaged ${formatMinutes(avg)} a day against a ${formatMinutes(goal)} goal. A plan built on ${formatMinutes(Math.max(60, Math.round(avg / 15) * 15 + 30))} a day may be easier to keep.` })
  for (const r of risks.filter((x) => x.level === 'high').slice(0, 2)) suggestions.push({ kind: 'risk', text: `${r.title}.`, next: r.next })

  return {
    period: { from: week[0], to: addDays(today, -1) },
    studiedMinutes: studied,
    plannedMinutes: plannedMin,
    blocks: { planned: blocks.length, done: done.length, missed: blocks.length - done.length },
    goalDays,
    topicsTicked: topicsTicked.length,
    assignmentsDone: assignmentsDone.length,
    plans: planReports,
    risks,
    suggestions,
    headline:
      blocks.length && done.length === blocks.length
        ? 'Every planned block got done this week.'
        : studied
          ? `${formatMinutes(studied)} studied, ${done.length} of ${blocks.length} planned blocks done.`
          : 'No study logged this week yet. A small plan is a good restart.',
  }
}
