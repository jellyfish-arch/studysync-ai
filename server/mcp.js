// The StudySync MCP server: lets MCP clients (Claude Desktop, Claude Code,
// any MCP app) read and change ONE student's StudySync account, chosen
// by the connection key the student created in the app.
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, GetPromptRequestSchema, ListPromptsRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { todayISO } from '../src/lib/dates.js'

export const INSTRUCTIONS = `StudySync is a student's study tracker: subjects with a syllabus (units > topics), exams, assignments, planned study blocks and logged study time, plus Mission Planner for multi-day study plans.
- Start with get_overview (or build_academic_context for planning).
- Refer to subjects by name or code ("DBMS", "CS502"); other items by id from the read tools, or exact title.
- Dates are YYYY-MM-DD, times 24-hour HH:MM.
- Exam readiness = share of the exam's topics ticked. Ticked does not mean mastered; never promise marks.
- For plans use generate_mission_plan: it is checked against the real calendar and saved as a draft. Explain feasibility, assumptions and anything deferred, then apply it only after the student explicitly approves (apply_plan_changes with approved_by_student: true).
- If you write your own schedule, check it with validate_plan_feasibility first.
- After missed study or new deadlines use propose_plan_repair; it never touches finished work.
- If a tool says a feature needs a paid plan or a limit is reached, tell the student plainly; don't retry in a loop.
- Delete tools remove data for good; only use them when the student clearly asks.`

const PROMPTS = [
  {
    name: 'plan_my_week',
    title: 'Plan my week',
    description: 'Plan the next 7 days around real exams, deadlines and existing study blocks.',
    arguments: [{ name: 'hours_per_day', description: 'Study hours per day (optional)', required: false }],
    text: (a) =>
      `Plan my study for the next 7 days starting ${todayISO()}. Call build_academic_context with goal_type "week" first and tell me anything important you don't know (for example how much time I really have). ${a.hours_per_day ? `I can study about ${a.hours_per_day} hours a day.` : 'Ask me how many hours a day I can study before drafting.'} Then call generate_mission_plan, explain the feasibility, milestones, assumptions and anything deferred in a short table, and only apply it with apply_plan_changes after I say yes.`,
  },
  {
    name: 'exam_prep',
    title: 'Prepare for an exam',
    description: 'A plan for one exam from its remaining syllabus and the time left.',
    arguments: [{ name: 'exam', description: 'Exam title or subject', required: true }],
    text: (a) =>
      `Help me prepare for "${a.exam}". Use build_academic_context (goal_type "exam") to see what is left, then generate_mission_plan for it. If it's tight or infeasible, use simulate_schedule_scenarios to compare more study time with focusing on the most important units, and tell me the trade-offs honestly. Apply only after I approve.`,
  },
  {
    name: 'recover_missed_schedule',
    title: 'Recover after missed study',
    description: 'Fold missed study blocks back into the plan without losing finished work.',
    arguments: [{ name: 'what_happened', description: 'What got in the way (optional)', required: false }],
    text: (a) =>
      `I missed some planned study${a.what_happened ? ` (${a.what_happened})` : ''}. Check list_mission_plans and review_plan_outcomes. If I have an active plan, call propose_plan_repair for it; otherwise call generate_mission_plan with goal_type "recovery". Tell me what moves, what no longer fits and what I should drop first, without lecturing. Apply only after I approve.`,
  },
  {
    name: 'review_progress',
    title: 'Review my progress',
    description: 'Look back at the week and adjust priorities.',
    arguments: [],
    text: () =>
      `Review my progress. Call review_plan_outcomes with weekly_review true and analyze_academic_risks. Summarise what went well, what slipped (kindly), the biggest risks coming up, and 2 or 3 concrete adjustments. Offer to repair or draft a plan, but don't change anything until I agree.`,
  },
  {
    name: 'add_syllabus',
    title: 'Add a syllabus',
    description: 'Turn pasted syllabus text into units and topics for a subject.',
    arguments: [
      { name: 'subject', description: 'Subject name (created if missing)', required: true },
      { name: 'text', description: 'The syllabus text', required: true },
    ],
    text: (a) =>
      `Add this syllabus to my subject "${a.subject}" (create the subject with add_subject if it does not exist yet, otherwise use import_syllabus). Clean up the lines into "Unit N: Title" headings with one topic per line first, and show me the units you will create before adding them.\n\n${a.text}`,
  },
]

// listTools() -> tool descriptors for this connection; run(name, args) -> output.
export function createMcpServer({ run, listTools, version = '1.0.0', onInitialized }) {
  const server = new Server({ name: 'studysync', title: 'StudySync', version }, { capabilities: { tools: {}, prompts: {} }, instructions: INSTRUCTIONS })
  if (onInitialized) server.oninitialized = () => onInitialized(server.getClientVersion())

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: await listTools() }))

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params
    try {
      const output = await run(name, args || {})
      return { content: [{ type: 'text', text: JSON.stringify(output, null, 2) }], isError: Boolean(output?.error) }
    } catch (e) {
      return { content: [{ type: 'text', text: `StudySync error: ${e.message}` }], isError: true }
    }
  })

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: PROMPTS.map(({ name, title, description, arguments: a }) => ({ name, title, description, arguments: a })),
  }))

  server.setRequestHandler(GetPromptRequestSchema, async (req) => {
    const p = PROMPTS.find((x) => x.name === req.params.name)
    if (!p) throw new Error(`Unknown prompt ${req.params.name}`)
    return { description: p.description, messages: [{ role: 'user', content: { type: 'text', text: p.text(req.params.arguments || {}) } }] }
  })

  return server
}
