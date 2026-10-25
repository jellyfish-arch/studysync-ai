// Yuuki's chat brain.
// When the StudySync server has AI set up she uses a free model and can act on
// your data through the same tools the MCP server offers (her personality and
// tool choice live in persona.js). Without it she still answers the common
// questions from your data.
import { api, ApiError } from '../lib/api.js'
import { pickData, useStore } from '../lib/store.js'
import { TOOL_MAP, callTool } from '../lib/tools.js'
import { PLANNER_TOOLS, PLANNER_TOOL_NAMES, systemPrompt, toolsFor } from './persona.js'
import { useAccount } from '../lib/account.js'
import { examReadiness, nextPriority, openAssignments, streak, upcomingExams, minutesOn } from '../lib/selectors.js'
import { formatMinutes, formatTime, relativeDays, todayISO } from '../lib/dates.js'

const WRITE = (name) => Boolean(TOOL_MAP[name]?.write)

const PLANNER_TITLES = Object.fromEntries(PLANNER_TOOLS.map((t) => [t.name, t.title]))

export function actionLabel(a) {
  const t = TOOL_MAP[a.name] || (PLANNER_TITLES[a.name] && { title: PLANNER_TITLES[a.name] })
  const o = a.output || {}
  if (o.error) return { text: `${t?.title || a.name} failed`, error: true }
  const detail =
    o.added?.name ||
    o.added?.title ||
    (Array.isArray(o.added) ? `${o.added.length} block${o.added.length === 1 ? '' : 's'}` : '') ||
    (typeof o.added === 'number' ? `${o.added}` : '') ||
    o.deleted ||
    o.topic ||
    o.done ||
    (o.logged ? formatMinutes(o.logged) : '') ||
    o.result?.title ||
    o.result?.name ||
    o.title ||
    ''
  return { text: `${t?.title || a.name}${detail ? ` · ${detail}` : ''}` }
}

// Mission Planner tools run on the server, which checks the plan's limits.
// Drafts and repairs are proposals: the student approves them in Mission Planner.
async function runPlannerTool(name, args) {
  try {
    if (name === 'draft_mission_plan') {
      const out = await api('/planner/draft', { method: 'POST', body: { goal: { type: args.goal, exam: args.exam }, options: args.daily_minutes ? { dailyMinutes: args.daily_minutes } : {} }, timeout: 30000 })
      if (out.empty) return { ok: false, reason: out.reason }
      const p = out.plan.revisions[0].plan
      return {
        ok: true,
        saved_as: "a draft in Mission Planner, waiting for the student's approval. Nothing is on the calendar yet.",
        title: p.title,
        from: p.start,
        to: p.end,
        verdict: p.feasibility.verdict,
        summary: p.feasibility.summary,
        study_blocks: p.stats.tasks,
        doesnt_fit: p.priorities.deferred.slice(0, 3),
        heads_up: p.warnings.map((w) => w.message).slice(0, 3),
      }
    }
    if (name === 'repair_mission') {
      const { plans } = await api('/plans')
      const active = plans.find((p) => p.status === 'active')
      if (!active) return { error: 'There is no active mission to repair. Draft one first.' }
      const out = await api(`/plans/${active.id}/repair`, { method: 'POST', body: { changes: args.daily_minutes ? { dailyMinutes: args.daily_minutes } : {}, reason: 'Repaired by Yuuki' }, timeout: 30000 })
      if (out.empty) return { ok: false, reason: out.reason }
      const p = out.plan.revisions.at(-1).plan
      return { ok: true, title: active.title, saved_as: "a proposal in Mission Planner, waiting for the student's approval.", what_changes: out.diff?.summary?.slice(0, 5), verdict: p.feasibility.verdict, summary: p.feasibility.summary }
    }
    if (name === 'weekly_review') {
      const r = await api('/planner/review')
      return { headline: r.headline, studied_minutes: r.studiedMinutes, blocks_done: `${r.blocks.done} of ${r.blocks.planned}`, topics_ticked: r.topicsTicked, days_at_goal: r.goalDays, suggestions: r.suggestions.map((x) => x.text) }
    }
    return { error: `Unknown tool ${name}.` }
  } catch (e) {
    if (e.status === 402) return { error: e.message, note: "This is a plan limit. Tell the student kindly; don't push them to upgrade." }
    if (e.status === 0) return { error: "StudySync's server isn't reachable, so planning tools are unavailable right now." }
    return { error: e.message }
  }
}

// Returns { text, actions, before }.
export async function askAI(history) {
  const s = useStore.getState()
  const before = pickData(s)
  const plan = useAccount.getState().summary?.plan || 'free'
  const messages = [{ role: 'system', content: systemPrompt(s, { plan }) }, ...history.slice(-8).map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }))]
  const actions = []
  // Her previous message counts too: a "yes" to "Want me to add it?" is an action.
  const tools = toolsFor(history.at(-1)?.text, { plan, context: history.at(-2)?.role === 'yuuki' ? history.at(-2).text : '' })
  // Every round for this one message shares one allowance on the server.
  const turn = crypto.randomUUID()
  let res = null
  for (let round = 0; round < 6; round++) {
    try {
      res = await api('/yuuki', { method: 'POST', body: { messages, tools, turn }, timeout: 70000 })
    } catch (e) {
      // Things already done must not disappear behind an error message.
      const done = actions.filter((a) => !a.output?.error)
      if (!done.length) throw e
      return { text: `Done what I could: ${done.map((a) => actionLabel(a).text).join('; ')}. My brain got busy before I could say more, so have a look and ask me again in a minute.`, actions, before: actions.some((a) => WRITE(a.name) && !a.output?.error) ? before : null }
    }
    const msg = res.message
    if (!msg.tool_calls?.length) {
      return { text: (msg.content || '').trim() || 'Done!', actions, before: actions.some((a) => WRITE(a.name) && !a.output?.error) ? before : null }
    }
    messages.push({ role: 'assistant', content: msg.content || null, tool_calls: msg.tool_calls })
    for (const call of msg.tool_calls) {
      let args = {}
      try {
        args = JSON.parse(call.function?.arguments || '{}') || {}
      } catch {
        args = {}
      }
      const name = call.function?.name
      let output
      if (PLANNER_TOOL_NAMES.has(name)) output = await runPlannerTool(name, args)
      else {
        const r = callTool(pickData(useStore.getState()), name, args)
        if (r.data) useStore.getState().replaceAll(r.data)
        output = r.output
      }
      actions.push({ name, args, output })
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(output).slice(0, 8000) })
    }
  }
  return { text: 'That took a lot of steps! Have a look at what changed.', actions, before }
}

// No AI available: answer from the data with simple matching.
export function localAnswer(text) {
  const s = useStore.getState()
  const q = text.toLowerCase()
  const name = (s.profile.name || s.user || '').split(' ')[0]
  const today = todayISO()

  if (/\b(what|which).*(study|do|next)|\bnext\b|\bnow\b/.test(q)) {
    const p = nextPriority(s, today)
    if (!p) return { text: `Nothing urgent, ${name}! No blocks today, no overdue work. Plan a block, or revise something you like.`, quick: ['plan'] }
    const why =
      p.kind === 'block' ? `it's on your plan at ${formatTime(p.block.start)}` : p.kind === 'assignment' ? `it's due ${relativeDays(p.assignment.due, today)}` : `it's in your ${p.exam.title} (${relativeDays(p.exam.date, today)}) and not covered yet`
    return { text: `I'd do "${p.title}" next, because ${why}.`, quick: ['focus'] }
  }
  if (/ready|exam|quiz|test|internal/.test(q)) {
    const list = upcomingExams(s, today).slice(0, 4)
    if (!list.length) return { text: 'No exams on the calendar yet. Add one and I will start counting down.', quick: ['exam'] }
    return { text: list.map((e) => `${e.title}: ${relativeDays(e.date, today)}, ${examReadiness(s, e).pct}% ready`).join('\n') }
  }
  if (/due|assignment|deadline|homework|lab/.test(q)) {
    const list = openAssignments(s).slice(0, 5)
    if (!list.length) return { text: 'Nothing open on your board. Enjoy it while it lasts!', quick: ['assignment'] }
    return { text: list.map((a) => `${a.title}: due ${relativeDays(a.due, today)}`).join('\n') }
  }
  if (/streak|how much|hours|studied|time/.test(q)) {
    return { text: `You've studied ${formatMinutes(minutesOn(s, today))} today and your streak is ${streak(s, today)} day${streak(s, today) === 1 ? '' : 's'}. Daily goal: ${formatMinutes(s.prefs.dailyGoal)}.` }
  }
  if (/tour|show me around|how (do|does)|help/.test(q)) {
    return { text: 'I can walk you through everything again, or you can ask me something like "what should I study now?"', quick: ['tour'] }
  }
  if (/add|create|new|plan/.test(q)) {
    return { text: 'Pick what to add and I will open the form for you:', quick: ['subject', 'exam', 'assignment', 'plan'] }
  }
  return {
    text: `My AI brain is resting right now, so I can only do the basics, ${name}. Try "what should I study now?", "how ready am I?" or "what's due?".`,
    quick: ['subject', 'plan'],
    fallback: true,
  }
}

export function describeError(e) {
  if (e instanceof ApiError) {
    if (e.status === 0) return "I can't reach StudySync right now, so my AI is asleep. Check your connection and try again."
    if (e.status === 401) return 'You need to log in again before I can use my AI.'
    if (e.status === 429) return 'Phew, my brain is busy right now. Give me a minute and ask again!'
    if (e.status === 402) {
      const n = e.data?.entitlement?.limits?.perDay
      return `That's all my AI messages for today${n ? ` (your plan has ${n} a day)` : ''}. I can still help with the basics, and my AI is back tomorrow.`
    }
    if (e.status === 503) return "My AI brain isn't switched on here yet, so I'll stick to the basics."
    return "My AI hit a snag on that one. Try asking again in a different way?"
  }
  return 'Something went wrong on my side. Try again?'
}
