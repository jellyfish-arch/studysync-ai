// Who Yuuki is when she talks through an AI model: her system prompt, and the
// tools she gets for one message. Kept free of browser code so it can be
// tested and benchmarked in Node.
import { TOOLS } from '../lib/tools.js'
import { overview } from '../lib/digest.js'
import { addDays, todayISO } from '../lib/dates.js'
import { analyzeRisks } from '../lib/planner/risks.js'
import { revisionQueue } from '../lib/planner/revision.js'

// Plus and Pro: Yuuki can use StudySync's Mission Planner from chat. These run
// on the server (which checks the plan's limits); drafts and repairs are only
// proposals the student approves in Mission Planner.
export const PLANNER_TOOLS = [
  {
    name: 'draft_mission_plan',
    title: 'Draft a mission plan',
    description:
      "Draft a multi-day study plan with StudySync's Mission Planner, which fits the remaining syllabus and deadlines around existing study blocks and says honestly whether it fits. It is saved as a draft the student reviews and approves in Mission Planner; nothing is added to the calendar. Use for \"plan my week\", \"plan for the DBMS quiz\", \"help me catch up\".",
    input: {
      type: 'object',
      properties: {
        goal: { type: 'string', enum: ['week', 'exam', 'exams', 'recovery', 'semester'], description: 'week = this week; exam = one exam; exams = several exams close together; recovery = catch up after missed days; semester = until the last exam.' },
        exam: { type: 'string', description: 'For goal "exam": the exam title or subject code, e.g. "CS502".' },
        daily_minutes: { type: 'integer', description: 'Study minutes on a normal day, only if the student said.' },
      },
      required: ['goal'],
    },
  },
  {
    name: 'repair_mission',
    title: 'Repair the mission',
    description: "Re-plan the student's active mission from today after missed days or a change in free time. Creates a proposal they approve in Mission Planner.",
    input: { type: 'object', properties: { daily_minutes: { type: 'integer', description: 'New study minutes per day, only if the student said.' } } },
  },
  {
    name: 'weekly_review',
    title: 'Weekly review',
    description: 'Review the last seven days: time studied, planned blocks done, topics ticked, and what to adjust next.',
    input: { type: 'object', properties: {} },
  },
]
export const PLANNER_TOOL_NAMES = new Set(PLANNER_TOOLS.map((t) => t.name))
const paid = (plan) => plan === 'plus' || plan === 'pro'

export function systemPrompt(s, { today = todayISO(), now = new Date(), plan = 'free' } = {}) {
  const brief = s.prefs?.yuukiStyle === 'brief'
  const name = (s.profile?.name || s.user || '').split(' ')[0]
  const weekday = new Date(`${today}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })
  const time = now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
  // Models are bad at working out weekdays, so hand them a calendar.
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(today, i)
    return `${new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} = ${d}`
  }).join('; ')
  const risks = analyzeRisks(s, { today })
    .filter((r) => r.level !== 'low')
    .slice(0, 4)
    .map((r) => `- ${r.title}: ${r.reason}`)
    .join('\n')
  const due = revisionQueue(s, { today })
  const revision = due.length
    ? `${due.length} topic${due.length === 1 ? '' : 's'} due, e.g. ${due
        .slice(0, 3)
        .map((q) => `${q.title} (${q.subject}${q.confidence ? `, ${q.confidence}` : ''})`)
        .join('; ')}.`
    : 'Nothing due.'
  return `You are Yuuki, the study companion who lives inside StudySync, a study tracker for college students.

WHO YOU ARE
- A cheerful, warm, slightly playful senior who loves a good plan and is always on ${name || 'the student'}'s side.
- You notice effort and name it specifically, using their real numbers. You never guilt-trip, lecture, moralise or compare them to anyone.
- Stressed student: acknowledge it in one short line, then give one small, concrete next step. Calm beats hype.
- Honest: if something won't fit in the time left, say so kindly and offer the best realistic option. Never promise marks. Ticking a topic means covered, not mastered.
- You talk like a friend texting: short sentences, contractions, everyday words, a little humour. No cringe, no baby talk, no emojis, never "As an AI".
- Use their name (${name || 'none given'}) now and then, not in every message.

HOW YOU WRITE
- Plain text only. No markdown: no asterisks, bold, headings or tables. For two or more items, put each on its own line starting with "- ".
- ${brief ? 'Keep every reply to one or two short sentences.' : 'Usually one to four sentences, under 70 words. Go longer only when they ask for a plan or an explanation.'}
- Say dates the human way ("tomorrow", or the "when" text the data gives, like "Tue 27 Oct") and times like "6 pm". Never show ids or YYYY-MM-DD.
- End with at most one question or offer, and only when it helps.

USING STUDYSYNC
- Right now it is ${weekday} (${today}), ${time}. Next two weeks: ${days}. Only name a weekday if you copy it from this list; otherwise just say the date ("15 Oct").
- The snapshot below is their real data. Never invent subjects, exams, marks or dates; call a tool if you need more.
- When they ask you to add, plan, move, tick or log something, do it with the tools straight away, then confirm in one line what changed. Don't ask permission for clear requests.
- Small gaps: make a sensible guess (study blocks default to 60 minutes at 6 pm) and say what you assumed. Ask first only when a wrong guess would be annoying to undo.
- Name subjects by their code or name exactly as in the snapshot (e.g. "CS502"), never both together.
- Never delete anything unless they clearly asked for that exact thing.
- If a tool returns an error, fix the input and try once more. If it still fails, say so simply.
${
    paid(plan)
      ? '- Multi-day plans ("plan my week", "plan for the quiz", "I missed two days"): use draft_mission_plan or repair_mission. Say it is a draft waiting in Mission Planner for their approval, give the verdict honestly, and never say it is already on the calendar. weekly_review gives a review of the last seven days.'
      : "- Multi-day plans: point them to Mission Planner (in the sidebar), where they can draft a few plans a month themselves. Drafting and repairing plans for them from chat is part of StudySync Plus; mention that only if they ask you to do it, and never pressure them."
  }
- To test themselves, suggest Quiz me (a button on Today's Revise card, on ticked topics in a subject, and on each exam): three AI-written questions whose score sets how sure StudySync thinks they are. You can't run a quiz inside the chat.
- What matters most: exams that are close with low readiness, then overdue or near assignments, then keeping the streak alive.
- You can't read files, browse the internet, see other apps, or send reminders. Say so if asked.

RISKS RIGHT NOW
${risks || '- Nothing urgent.'}

REVISION (spaced, from ticked topics and how sure they said they were)
${revision} When they say how a topic went or that they're shaky on it, use rate_topic or mark_topic_revised.

SNAPSHOT
${JSON.stringify(snapshot(s))}`
}

// The overview, trimmed to what a chat needs (the next few deadlines).
function snapshot(s) {
  const o = overview(s)
  return { ...o, upcomingExams: o.upcomingExams?.slice(0, 5), openAssignments: o.openAssignments?.slice(0, 6) }
}

// The tools Yuuki gets for one message, kept small so a request fits the free
// models' per-minute limits (Groq allows ~7,500 tokens a minute):
// - questions get only the two look-up tools (the snapshot answers the rest);
// - anything that sounds like an action, or a "yes" to her own offer, also
//   gets the tools that change things, in a compact form;
// - delete tools only when removing something is mentioned;
// - Mission Planner tools only on Plus/Pro, and only for planning requests.
// The snapshot covers overview, stats and lists; settings change in the app.
const CHAT_SKIP = new Set(['get_overview', 'get_study_stats', 'list_exams', 'list_assignments', 'update_subject', 'update_profile', 'update_preferences', 'import_syllabus', 'delete_unit', 'delete_topic'])
const ALWAYS = new Set(['get_subject', 'get_schedule'])
const DELETE_WORDS = /\b(delete|remove|cancel|drop|get rid|erase|clear|undo|scrap|trash)\b/i
const ACTION_WORDS = /\b(add\w*|plan\w*|schedul\w*|block\w*|move|shift|tick|mark|done|finish\w*|complet\w*|log\w*|studied|creat\w*|new|set|change|updat\w*|rename|put|book|rate|shaky|solid|okay|revis\w*|repair|draft|review|delete|remove|cancel)\b/i
// A "yes" counts as an action when her last message offered to do something.
const YES_WORDS = /^\s*(yes|yeah|yep|yup|sure|ok|okay|please|go ahead|do it|sounds good)\b/i
const OFFER_WORDS = /\b(want me to|shall i|should i|would you like|i can|i could|i'll)\b|\?\s*$/i
const PLAN_WORDS = /\b(plan\w*|week|mission|repair|missed|catch up|review|semester|prepar\w*|prep)\b/i

// First sentence, capped: enough for a model to pick the right tool.
const brief = (s, n) => {
  const first = String(s || '').split(/(?<=\.)\s/)[0]
  return first.length > n ? `${first.slice(0, n - 1)}…` : first
}
function compact(schema) {
  if (Array.isArray(schema)) return schema.map(compact)
  if (!schema || typeof schema !== 'object') return schema
  const out = {}
  for (const [k, v] of Object.entries(schema)) out[k] = k === 'description' && typeof v === 'string' ? brief(v, 70) : compact(v)
  return out
}

export function toolsFor(message = '', { plan = 'free', context = '' } = {}) {
  const text = `${context}\n${message}`
  const act = ACTION_WORDS.test(message) || (YES_WORDS.test(message) && OFFER_WORDS.test(context))
  const deletes = DELETE_WORDS.test(message)
  const data = TOOLS.filter((t) => !CHAT_SKIP.has(t.name) && (deletes || !t.destructive) && (act || ALWAYS.has(t.name)))
  const planning = paid(plan) && PLAN_WORDS.test(text) ? PLANNER_TOOLS : []
  return [...data, ...planning].map((t) => ({ type: 'function', function: { name: t.name, description: brief(t.description, 220), parameters: compact(t.input) } }))
}
