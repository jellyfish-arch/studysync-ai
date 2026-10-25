// The actions an AI can take on a StudySync account, described once and used
// in two places:
//   - Yuuki's chat in the app (OpenAI-style function calling, run in the browser)
//   - the MCP server (any MCP client: Claude Desktop, Claude Code, Cursor...)
// Schemas stick to the JSON Schema subset that Groq, Gemini and OpenRouter
// all accept.
import { EXAM_TYPES, OpError, PRIORITIES, STATUSES, SUBJECT_COLORS, runOp } from './ops.js'
import { overview, schedule, studyStats, subjectDetail } from './digest.js'
import { openAssignments, pastExams, upcomingExams } from './selectors.js'
import { todayISO } from './dates.js'

const S = (description, extra = {}) => ({ type: 'string', description, ...extra })
const N = (description, extra = {}) => ({ type: 'integer', description, ...extra })
const B = (description) => ({ type: 'boolean', description })
const obj = (properties, required = []) => ({ type: 'object', properties, required })

const SUBJECT = S('The subject: its id, code (e.g. "CS501") or name (e.g. "Operating Systems").')
const DATE = (what) => S(`${what}, as YYYY-MM-DD.`)
const TIME = (what) => S(`${what}, 24-hour HH:MM (e.g. "18:30").`)

const subjectName = (d, id) => d.subjects.find((s) => s.id === id)?.name

export const TOOLS = [
  /* ---------- read ---------- */
  {
    name: 'get_overview',
    title: 'Overview',
    description:
      "Read the student's whole situation: profile, today's date, study stats, subjects with syllabus progress, upcoming exams with readiness, open assignments and today's study plan. Call this first.",
    input: obj({}),
    read: (d) => overview(d),
  },
  {
    name: 'get_subject',
    title: 'Subject details',
    description: 'Read one subject in full: units with their topics (and which are done), exams, assignments and time studied. Use it before adding topics, exams on specific units, or ticking topics.',
    input: obj({ subject: SUBJECT }, ['subject']),
    read: (d, a) => subjectDetail(d, a.subject) || { error: `No subject matches "${a.subject}".` },
  },
  {
    name: 'get_schedule',
    title: 'Schedule',
    description: 'Read the day-by-day timeline between two dates: planned study blocks, exams, assignment deadlines and minutes studied. Defaults to the next 7 days.',
    input: obj({ from: DATE('First day (default today)'), to: DATE('Last day (default 6 days after from)') }),
    read: (d, a) => schedule(d, a.from || todayISO(), a.to || undefined),
  },
  {
    name: 'get_study_stats',
    title: 'Study stats',
    description: 'Read study time totals, active days, average per day, minutes per subject and streaks for the last N days.',
    input: obj({ days: N('How many days back, 1 to 365 (default 30).') }),
    read: (d, a) => studyStats(d, a.days || 30),
  },
  {
    name: 'list_exams',
    title: 'List exams',
    description: 'List exams with ids. Upcoming only unless include_past is true.',
    input: obj({ include_past: B('Also list exams that are over.') }),
    read: (d, a) =>
      [...upcomingExams(d), ...(a.include_past ? pastExams(d) : [])].map((e) => ({ id: e.id, subject: subjectName(d, e.subjectId), title: e.title, type: e.type, date: e.date, time: e.time || null, venue: e.venue || null })),
  },
  {
    name: 'list_assignments',
    title: 'List assignments',
    description: 'List assignments with ids. status: "open" (default), "done" or "all".',
    input: obj({ status: S('Which ones to list.', { enum: ['open', 'done', 'all'] }) }),
    read: (d, a) => {
      const st = a.status || 'open'
      const list = st === 'open' ? openAssignments(d) : st === 'done' ? d.assignments.filter((x) => x.status === 'done') : d.assignments
      return list.map((x) => ({ id: x.id, subject: subjectName(d, x.subjectId), title: x.title, due: x.due, status: x.status, priority: x.priority }))
    },
  },

  /* ---------- subjects and syllabus ---------- */
  {
    name: 'add_subject',
    title: 'Add subject',
    description:
      'Create a subject. Optionally pass the syllabus as text: lines starting with "Unit", "Module" or "Chapter" become units and the lines under them become topics.',
    input: obj(
      {
        name: S('Subject name, e.g. "Database Management Systems".'),
        code: S('Course code, e.g. "CS502". Optional.'),
        teacher: S('Faculty name. Optional.'),
        color: S('Colour. Optional; picked automatically.', { enum: Object.keys(SUBJECT_COLORS) }),
        syllabus: S('Optional syllabus text to import into units and topics.'),
      },
      ['name'],
    ),
    write: (d, a) => {
      let { data, result } = runOp(d, 'addSubject', a)
      let imported = null
      if (a.syllabus) ({ data, result: imported } = runOp(data, 'importSyllabus', { subjectId: result.id, text: a.syllabus }))
      return { data, output: { added: { id: result.id, name: result.name, code: result.code }, imported } }
    },
  },
  {
    name: 'update_subject',
    title: 'Edit subject',
    description: "Rename a subject or change its code, teacher or colour.",
    input: obj({ subject: SUBJECT, name: S('New name.'), code: S('New code.'), teacher: S('New teacher.'), color: S('New colour.', { enum: Object.keys(SUBJECT_COLORS) }) }, ['subject']),
    write: (d, a) => op(d, 'updateSubject', a),
  },
  {
    name: 'delete_subject',
    title: 'Delete subject',
    description: 'Delete a subject and EVERYTHING in it (units, topics, exams, assignments, study blocks, logged time). Only when the student clearly asks.',
    destructive: true,
    input: obj({ subject: SUBJECT }, ['subject']),
    write: (d, a) => op(d, 'deleteSubject', a, (s) => ({ deleted: s.name })),
  },
  {
    name: 'add_unit',
    title: 'Add unit',
    description: 'Add a unit (chapter/module) to a subject, optionally with its topics.',
    input: obj({ subject: SUBJECT, title: S('Unit title, e.g. "Normalisation".'), topics: { type: 'array', items: { type: 'string' }, description: 'Topic titles in this unit. Optional.' } }, ['subject', 'title']),
    write: (d, a) => {
      let { data, result } = runOp(d, 'addUnit', a)
      let topics = []
      if (a.topics?.length) ({ data, result: topics } = runOp(data, 'addTopics', { unitId: result.id, titles: a.topics }))
      return { data, output: { added: { id: result.id, title: result.title }, topics: topics.length } }
    },
  },
  {
    name: 'delete_unit',
    title: 'Delete unit',
    description: 'Delete a unit and its topics.',
    destructive: true,
    input: obj({ subject: SUBJECT, unit: S('Unit id, title or number ("3").') }, ['unit']),
    write: (d, a) => op(d, 'deleteUnit', a, (u) => ({ deleted: u.title })),
  },
  {
    name: 'add_topics',
    title: 'Add topics',
    description: 'Add one or more topics to a unit.',
    input: obj({ subject: SUBJECT, unit: S('Unit id, title or number ("3").'), topics: { type: 'array', items: { type: 'string' }, description: 'Topic titles.' } }, ['unit', 'topics']),
    write: (d, a) => op(d, 'addTopics', { ...a, titles: a.topics }, (list) => ({ added: list.length })),
  },
  {
    name: 'set_topic_done',
    title: 'Tick topic',
    description: 'Mark a syllabus topic as covered (done=true, the default) or not covered (done=false). Raises exam readiness.',
    input: obj({ topic: S('Topic id, or its exact title.'), done: B('true = covered (default), false = not yet.') }, ['topic']),
    write: (d, a) => op(d, 'setTopicDone', { topic: a.topic, done: a.done ?? true }, (t) => ({ topic: t.title, done: t.done })),
  },
  {
    name: 'rate_topic',
    title: 'Rate topic',
    description: 'Record how confident the student feels about a topic: shaky, ok or solid. Shaky topics come up for revision sooner and get revision time in mission plans. Also marks the topic as covered.',
    input: obj({ topic: S('Topic id, or its exact title.'), confidence: S('How sure they feel.', { enum: ['shaky', 'ok', 'solid'] }) }, ['topic', 'confidence']),
    write: (d, a) => op(d, 'rateTopic', a, (t) => ({ topic: t.title, confidence: t.confidence })),
  },
  {
    name: 'mark_topic_revised',
    title: 'Mark revised',
    description: 'Record that the student revised a topic today, optionally with how it went (shaky, ok or solid). Moves its next revision further out.',
    input: obj({ topic: S('Topic id, or its exact title.'), confidence: S('How it went. Optional.', { enum: ['shaky', 'ok', 'solid'] }) }, ['topic']),
    write: (d, a) => op(d, 'reviseTopic', a, (t) => ({ topic: t.title, revisions: t.revisions, confidence: t.confidence })),
  },
  {
    name: 'delete_topic',
    title: 'Delete topic',
    description: 'Delete a syllabus topic.',
    destructive: true,
    input: obj({ topic: S('Topic id or exact title.') }, ['topic']),
    write: (d, a) => op(d, 'deleteTopic', a, (t) => ({ deleted: t.title })),
  },
  {
    name: 'import_syllabus',
    title: 'Import syllabus',
    description: 'Paste a syllabus into an existing subject. Lines starting with Unit/Module/Chapter start a unit; other lines become topics in the unit above.',
    input: obj({ subject: SUBJECT, text: S('The syllabus text.') }, ['subject', 'text']),
    write: (d, a) => op(d, 'importSyllabus', a),
  },

  /* ---------- exams ---------- */
  {
    name: 'add_exam',
    title: 'Add exam',
    description: 'Add an exam, quiz, internal or viva. Pass the units it covers so readiness only counts those topics; leave units out for the whole subject.',
    input: obj(
      {
        subject: SUBJECT,
        type: S('Kind of exam.', { enum: EXAM_TYPES }),
        title: S('Short name, e.g. "Quiz 2: Normalisation". Optional.'),
        date: DATE('Exam day'),
        time: TIME('Start time. Optional'),
        venue: S('Room or hall. Optional.'),
        units: { type: 'array', items: { type: 'string' }, description: 'Unit ids, titles or numbers covered. Optional.' },
      },
      ['subject', 'date'],
    ),
    write: (d, a) => op(d, 'addExam', a, (e) => ({ added: { id: e.id, title: e.title, date: e.date } })),
  },
  {
    name: 'update_exam',
    title: 'Edit exam',
    description: 'Change an exam’s date, time, venue, title, type or units.',
    input: obj({ exam: S('Exam id or title.'), title: S('New title.'), type: S('New type.', { enum: EXAM_TYPES }), date: DATE('New day'), time: TIME('New time'), venue: S('New venue.'), units: { type: 'array', items: { type: 'string' }, description: 'Units covered.' } }, ['exam']),
    write: (d, a) => op(d, 'updateExam', a),
  },
  {
    name: 'delete_exam',
    title: 'Delete exam',
    description: 'Delete an exam.',
    destructive: true,
    input: obj({ exam: S('Exam id or title.') }, ['exam']),
    write: (d, a) => op(d, 'deleteExam', a, (e) => ({ deleted: e.title })),
  },

  /* ---------- assignments ---------- */
  {
    name: 'add_assignment',
    title: 'Add assignment',
    description: 'Add an assignment, lab record or project with a due date.',
    input: obj(
      {
        subject: SUBJECT,
        title: S('What it is, e.g. "Lab record: SQL joins".'),
        due: DATE('Due date'),
        priority: S('Priority (default medium).', { enum: PRIORITIES }),
        status: S('Status (default todo).', { enum: STATUSES }),
        estimate_minutes: N('Estimated work in minutes. Optional.'),
        notes: S('Notes. Optional.'),
      },
      ['subject', 'title', 'due'],
    ),
    write: (d, a) => op(d, 'addAssignment', { ...a, estimate: a.estimate_minutes }, (x) => ({ added: { id: x.id, title: x.title, due: x.due } })),
  },
  {
    name: 'update_assignment',
    title: 'Edit assignment',
    description: 'Change an assignment. Set status "done" to complete it, "doing" when started.',
    input: obj({ assignment: S('Assignment id or title.'), title: S('New title.'), due: DATE('New due date'), priority: S('New priority.', { enum: PRIORITIES }), status: S('New status.', { enum: STATUSES }), estimate_minutes: N('New estimate.'), notes: S('New notes.') }, ['assignment']),
    write: (d, a) => {
      const args = { ...a }
      if ('estimate_minutes' in a) args.estimate = a.estimate_minutes
      delete args.estimate_minutes
      return op(d, 'updateAssignment', args)
    },
  },
  {
    name: 'delete_assignment',
    title: 'Delete assignment',
    description: 'Delete an assignment.',
    destructive: true,
    input: obj({ assignment: S('Assignment id or title.') }, ['assignment']),
    write: (d, a) => op(d, 'deleteAssignment', a, (x) => ({ deleted: x.title })),
  },

  /* ---------- study timeline ---------- */
  {
    name: 'plan_study_blocks',
    title: 'Plan study blocks',
    description: 'Put one or more study blocks on the timeline (planner and calendar). Use it to build a study plan or revision timetable.',
    input: obj(
      {
        blocks: {
          type: 'array',
          description: 'Blocks to add.',
          items: obj({ subject: SUBJECT, title: S('What to study, e.g. "Unit 3 numericals".'), date: DATE('Day'), start: TIME('Start'), minutes: N('Length in minutes (default 45).') }, ['subject', 'date', 'start']),
        },
      },
      ['blocks'],
    ),
    write: (d, a) => {
      let data = d
      const added = []
      for (const b of a.blocks || []) {
        const r = runOp(data, 'addBlock', b)
        data = r.data
        added.push({ id: r.result.id, date: r.result.date, start: r.result.start, title: r.result.title })
      }
      if (!added.length) throw new OpError('Give at least one block.')
      return { data, output: { added } }
    },
  },
  {
    name: 'update_study_block',
    title: 'Move study block',
    description: 'Move or change a planned study block.',
    input: obj({ block: S('Block id or title.'), title: S('New title.'), date: DATE('New day'), start: TIME('New start'), minutes: N('New length.') }, ['block']),
    write: (d, a) => op(d, 'updateBlock', a),
  },
  {
    name: 'delete_study_block',
    title: 'Remove study block',
    description: 'Remove a planned study block.',
    destructive: true,
    input: obj({ block: S('Block id or title.') }, ['block']),
    write: (d, a) => op(d, 'deleteBlock', a, (b) => ({ deleted: b.title })),
  },
  {
    name: 'complete_study_block',
    title: 'Finish study block',
    description: 'Mark a study block as done; its time is logged.',
    input: obj({ block: S('Block id or title.'), minutes: N('Minutes actually studied (default: the block length).') }, ['block']),
    write: (d, a) => op(d, 'completeBlock', a, (b) => ({ done: b.title })),
  },
  {
    name: 'log_study_time',
    title: 'Log study time',
    description: 'Record time already studied (counts towards streaks and analytics).',
    input: obj({ subject: SUBJECT, minutes: N('Minutes studied.'), date: DATE('Day (default today)'), note: S('What was covered. Optional.') }, ['subject', 'minutes']),
    write: (d, a) => op(d, 'logSession', a, (x) => ({ logged: x.minutes, date: x.date })),
  },

  /* ---------- profile ---------- */
  {
    name: 'update_profile',
    title: 'Edit profile',
    description: "Update the student's name, course, semester, college or a short about line.",
    input: obj({ name: S('Display name.'), course: S('e.g. "B.Tech CSE".'), semester: S('e.g. "Semester 5".'), college: S('College or university.'), about: S('One line about them.') }),
    write: (d, a) => op(d, 'updateProfile', a),
  },
  {
    name: 'update_preferences',
    title: 'Study preferences',
    description: 'Change the daily study goal, default focus length, first day of the week or time format.',
    input: obj({ daily_goal_minutes: N('Daily goal in minutes.'), focus_length_minutes: N('Default focus session length.'), week_starts_on: S('First day of the week.', { enum: ['mon', 'sun'] }), time_format: S('Clock style.', { enum: ['12h', '24h'] }) }),
    write: (d, a) => {
      const c = {}
      if (a.daily_goal_minutes != null) c.dailyGoal = a.daily_goal_minutes
      if (a.focus_length_minutes != null) c.focusLength = a.focus_length_minutes
      if (a.week_starts_on) c.weekStartsOn = a.week_starts_on
      if (a.time_format) c.timeFormat = a.time_format
      return op(d, 'updatePrefs', c)
    },
  },
]

function op(d, name, args, shape) {
  const { data, result } = runOp(d, name, args)
  return { data, output: shape ? shape(result) : { ok: true, result } }
}

export const TOOL_MAP = Object.fromEntries(TOOLS.map((t) => [t.name, t]))

// Run one tool against a data snapshot. Never throws for bad input: errors come
// back as { error } so the model can correct itself.
export function callTool(data, name, args = {}) {
  const tool = TOOL_MAP[name]
  if (!tool) return { data: null, output: { error: `Unknown tool "${name}".` } }
  try {
    if (tool.read) return { data: null, output: tool.read(data, args || {}) }
    const { data: next, output } = tool.write(data, args || {})
    return { data: next, output: { ok: true, ...output } }
  } catch (e) {
    if (e instanceof OpError) return { data: null, output: { error: e.message } }
    throw e
  }
}

// OpenAI-style tool list for chat completions.
export function chatTools(filter = () => true) {
  return TOOLS.filter(filter).map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input } }))
}
