// Every change to a student's data goes through these pure functions.
// The app store, Yuuki's AI tools and the MCP server all call the same ones,
// so a subject added from Claude Desktop is exactly the same as one added by
// clicking "Add subject".
//
// Each op takes the whole data object and an args object and returns
// { data, result }. They never mutate. Bad input throws an OpError with a
// message written for the person (or AI) who sent it.
import { addDays, todayISO } from './dates.js'
import { parseSyllabus } from './ingest.js'

export class OpError extends Error {}
const fail = (msg) => {
  throw new OpError(msg)
}

// Colours that sit well on OLED black. No blue, no purple.
export const SUBJECT_COLORS = {
  gold: '#facc15',
  rose: '#ff4d8d',
  mint: '#34d399',
  coral: '#ff6b5b',
  teal: '#2dd4bf',
  lime: '#a3e635',
  orange: '#ff9f43',
  sand: '#d6c3a5',
  peach: '#ffb38a',
  red: '#f43f5e',
}
export const colorOf = (key) => SUBJECT_COLORS[key] || (typeof key === 'string' && key.startsWith('#') ? key : SUBJECT_COLORS.gold)

export const EXAM_TYPES = ['Quiz', 'Mid-sem', 'End-sem', 'Internal', 'Lab exam', 'Viva', 'Assignment test', 'Other']
export const PRIORITIES = ['low', 'medium', 'high']
export const STATUSES = ['todo', 'doing', 'done']

export const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)

export const defaultProfile = () => ({
  name: '',
  course: '',
  semester: '',
  college: '',
  about: '',
  avatar: 'yuuki',
  avatarColor: 'mint',
  joined: todayISO(),
})

export const defaultPrefs = () => ({
  dailyGoal: 180,
  weekStartsOn: 'mon',
  timeFormat: '12h',
  focusLength: 45,
  breakReminder: true,
  yuukiTips: true,
  yuukiStyle: 'chatty',
  aiProvider: 'auto',
  cursor: true,
  motion: 'system',
  celebrations: true,
  sounds: false,
})

export const defaultGuide = () => ({ introduced: false, tour: 0, tourDone: false, seen: [] })

export const emptyData = () => ({
  profile: defaultProfile(),
  prefs: defaultPrefs(),
  guide: defaultGuide(),
  subjects: [],
  units: [],
  topics: [],
  exams: [],
  assignments: [],
  blocks: [],
  sessions: [],
})

export const DATA_KEYS = ['profile', 'prefs', 'guide', 'subjects', 'units', 'topics', 'exams', 'assignments', 'blocks', 'sessions']
export const LIST_KEYS = ['subjects', 'units', 'topics', 'exams', 'assignments', 'blocks', 'sessions']

// Fill in anything missing so old or hand-written data still works.
export function normalize(d) {
  const base = emptyData()
  if (!d || typeof d !== 'object') return base
  const out = { ...base }
  out.profile = { ...base.profile, ...(d.profile || {}) }
  out.prefs = { ...base.prefs, ...(d.prefs || {}) }
  // daily goal used to live on the profile
  if (d.profile?.dailyGoal && !d.prefs?.dailyGoal) out.prefs.dailyGoal = d.profile.dailyGoal
  delete out.profile.dailyGoal
  delete out.profile.isDemo
  out.guide = { ...base.guide, ...(d.guide || {}) }
  for (const k of LIST_KEYS) out[k] = Array.isArray(d[k]) ? d[k].filter((x) => x && typeof x === 'object' && x.id) : []
  return out
}

/* ---------- small validators ---------- */
const ISO = /^\d{4}-\d{2}-\d{2}$/
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const str = (v, max = 200) => (v == null ? '' : String(v).trim().slice(0, max))

function date(v, label, fallback) {
  if (v == null || v === '') {
    if (fallback !== undefined) return fallback
    fail(`${label} is required (YYYY-MM-DD).`)
  }
  const s = String(v).trim()
  if (/^today$/i.test(s)) return todayISO()
  if (/^tomorrow$/i.test(s)) return addDays(todayISO(), 1)
  if (!ISO.test(s) || Number.isNaN(Date.parse(s))) fail(`${label} must be a date like 2026-11-04, got "${s}".`)
  return s
}

function time(v, label, fallback = '') {
  if (v == null || v === '') return fallback
  let s = String(v).trim().toLowerCase()
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (m) {
    let h = Number(m[1])
    const min = Number(m[2] || 0)
    if (m[3] === 'pm' && h < 12) h += 12
    if (m[3] === 'am' && h === 12) h = 0
    s = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
  }
  if (!HHMM.test(s)) fail(`${label} must be a 24-hour time like 18:30, got "${v}".`)
  return s
}

function minutes(v, label, { min = 1, max = 720, fallback } = {}) {
  if (v == null || v === '') {
    if (fallback !== undefined) return fallback
    fail(`${label} is required.`)
  }
  const n = Math.round(Number(v))
  if (!Number.isFinite(n) || n < min || n > max) fail(`${label} must be between ${min} and ${max} minutes.`)
  return n
}

function oneOf(v, list, label, fallback) {
  if (v == null || v === '') return fallback
  const hit = list.find((x) => x.toLowerCase() === String(v).trim().toLowerCase())
  if (!hit) fail(`${label} must be one of: ${list.join(', ')}.`)
  return hit
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/* ---------- finding things by id, code or name ---------- */

// Accepts an id, a subject code ("CS501") or a name ("operating systems",
// "OS" partial). People and AIs rarely know internal ids.
export function findSubject(data, ref) {
  if (!ref) return null
  const r = String(ref).trim()
  const list = data.subjects
  // "Database Management Systems (CS502)", the way summaries write subjects.
  const both = r.match(/^(.+?)\s*\(([^()]+)\)$/)
  if (both) return findSubject(data, both[2]) || findSubject(data, both[1])
  return (
    list.find((s) => s.id === r) ||
    list.find((s) => s.code && s.code.toLowerCase() === r.toLowerCase()) ||
    list.find((s) => norm(s.name) === norm(r)) ||
    list.find((s) => norm(s.name).startsWith(norm(r))) ||
    list.find((s) => norm(s.name).includes(norm(r))) ||
    list.find((s) => initials(s.name) === r.toLowerCase()) ||
    acronym(list, r) ||
    null
  )
}

// "DBMS" -> "Database Management Systems": the letters appear in order,
// starting with the first letter. Only used when exactly one subject fits.
function acronym(list, ref) {
  const want = ref.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (want.length < 2 || want.length > 8) return null
  const fits = list.filter((s) => {
    const name = norm(s.name).replace(/ /g, '')
    if (name[0] !== want[0]) return false
    let i = 0
    for (const ch of name) if (ch === want[i]) i++
    return i === want.length
  })
  return fits.length === 1 ? fits[0] : null
}
const initials = (name) =>
  norm(name)
    .split(' ')
    .filter((w) => !['and', 'of', 'the', 'in', 'to'].includes(w))
    .map((w) => w[0])
    .join('')

function subjectOrFail(data, ref) {
  const s = findSubject(data, ref)
  if (!s) {
    const names = data.subjects.map((x) => (x.code ? `${x.name} (${x.code})` : x.name)).join(', ')
    fail(ref ? `No subject matches "${ref}". ${names ? `Subjects: ${names}.` : 'There are no subjects yet; add one first.'}` : 'Say which subject.')
  }
  return s
}

// A unit by id, by title, or by number ("3", "Unit 3") inside a subject.
export function findUnit(data, ref, subjectRef) {
  if (!ref) return null
  const r = String(ref).trim()
  const byId = data.units.find((u) => u.id === r)
  if (byId) return byId
  const subject = subjectRef ? findSubject(data, subjectRef) : null
  const pool = data.units.filter((u) => !subject || u.subjectId === subject.id).sort((a, b) => a.order - b.order)
  const num = r.match(/^(?:unit|module|chapter|u)?\s*(\d+)$/i)
  if (num && subject) return pool[Number(num[1]) - 1] || null
  return pool.find((u) => norm(u.title) === norm(r)) || pool.find((u) => norm(u.title).includes(norm(r))) || null
}

function unitOrFail(data, ref, subjectRef) {
  const u = findUnit(data, ref, subjectRef)
  if (!u) fail(`No unit matches "${ref}"${subjectRef ? ` in ${subjectRef}` : ''}. Pass the unit id, or the subject plus the unit title or number.`)
  return u
}

function byId(list, id, what) {
  const item = list.find((x) => x.id === id)
  if (!item) fail(`No ${what} with id "${id}".`)
  return item
}

// Find a topic/exam/assignment/block by id or (for AIs) by its title.
function byIdOrTitle(list, ref, what) {
  if (!ref) fail(`Say which ${what}.`)
  const r = String(ref).trim()
  const hit = list.find((x) => x.id === r) || list.find((x) => norm(x.title) === norm(r)) || list.find((x) => norm(x.title).includes(norm(r)))
  if (!hit) fail(`No ${what} matches "${r}".`)
  return hit
}

const without = (list, id) => list.filter((x) => x.id !== id)
const patch = (list, id, changes) => list.map((x) => (x.id === id ? { ...x, ...changes } : x))
const ok = (data, result) => ({ data, result })

function nextColor(data) {
  const used = new Set(data.subjects.map((s) => s.color))
  return Object.keys(SUBJECT_COLORS).find((c) => !used.has(c)) || Object.keys(SUBJECT_COLORS)[data.subjects.length % 10]
}

/* ---------- profile and preferences ---------- */

const PROFILE_FIELDS = { name: 60, course: 60, semester: 30, college: 80, about: 280, avatar: 20, avatarColor: 20 }

export function updateProfile(data, changes = {}) {
  const clean = {}
  for (const [k, max] of Object.entries(PROFILE_FIELDS)) if (k in changes) clean[k] = str(changes[k], max)
  return ok({ ...data, profile: { ...data.profile, ...clean } }, { ...data.profile, ...clean })
}

export function updatePrefs(data, changes = {}) {
  const p = { ...data.prefs }
  if ('dailyGoal' in changes) p.dailyGoal = minutes(changes.dailyGoal, 'Daily goal', { min: 15, max: 960 })
  if ('weekStartsOn' in changes) p.weekStartsOn = oneOf(changes.weekStartsOn, ['mon', 'sun'], 'Week start', p.weekStartsOn)
  if ('timeFormat' in changes) p.timeFormat = oneOf(changes.timeFormat, ['12h', '24h'], 'Time format', p.timeFormat)
  if ('focusLength' in changes) p.focusLength = minutes(changes.focusLength, 'Focus length', { min: 5, max: 240 })
  if ('motion' in changes) p.motion = oneOf(changes.motion, ['system', 'full', 'reduced'], 'Motion', p.motion)
  if ('yuukiStyle' in changes) p.yuukiStyle = oneOf(changes.yuukiStyle, ['chatty', 'brief'], 'Yuuki style', p.yuukiStyle)
  if ('aiProvider' in changes) p.aiProvider = oneOf(changes.aiProvider, ['auto', 'groq', 'gemini', 'openrouter'], 'AI provider', p.aiProvider)
  for (const k of ['yuukiTips', 'cursor', 'celebrations', 'sounds', 'breakReminder']) if (k in changes) p[k] = Boolean(changes[k])
  return ok({ ...data, prefs: p }, p)
}

export function updateGuide(data, changes = {}) {
  return ok({ ...data, guide: { ...data.guide, ...changes } }, null)
}

/* ---------- subjects ---------- */

export function addSubject(data, { name, code = '', color, teacher = '' } = {}) {
  const n = str(name, 80)
  if (!n) fail('A subject needs a name.')
  if (data.subjects.some((s) => norm(s.name) === norm(n))) fail(`There is already a subject called "${n}".`)
  const c = color && (SUBJECT_COLORS[color] || /^#[0-9a-f]{6}$/i.test(color)) ? color : nextColor(data)
  const subject = { id: uid(), name: n, code: str(code, 12).toUpperCase(), color: c, teacher: str(teacher, 60), created: todayISO() }
  return ok({ ...data, subjects: [...data.subjects, subject] }, subject)
}

export function updateSubject(data, { id, subject: ref, ...changes } = {}) {
  const s = subjectOrFail(data, id || ref)
  const clean = {}
  if ('name' in changes) {
    clean.name = str(changes.name, 80)
    if (!clean.name) fail('A subject needs a name.')
  }
  if ('code' in changes) clean.code = str(changes.code, 12).toUpperCase()
  if ('teacher' in changes) clean.teacher = str(changes.teacher, 60)
  if ('color' in changes && (SUBJECT_COLORS[changes.color] || /^#[0-9a-f]{6}$/i.test(changes.color))) clean.color = changes.color
  return ok({ ...data, subjects: patch(data.subjects, s.id, clean) }, { ...s, ...clean })
}

export function deleteSubject(data, { id, subject: ref } = {}) {
  const s = subjectOrFail(data, id || ref)
  const keep = (x) => x.subjectId !== s.id
  return ok(
    {
      ...data,
      subjects: without(data.subjects, s.id),
      units: data.units.filter(keep),
      topics: data.topics.filter(keep),
      exams: data.exams.filter(keep),
      assignments: data.assignments.filter(keep),
      blocks: data.blocks.filter(keep),
      sessions: data.sessions.filter(keep),
    },
    s,
  )
}

/* ---------- syllabus ---------- */

export function addUnit(data, { subjectId, subject: ref, title } = {}) {
  const s = subjectOrFail(data, subjectId || ref)
  const t = str(title, 120)
  if (!t) fail('A unit needs a title.')
  const order = data.units.filter((u) => u.subjectId === s.id).length
  const unit = { id: uid(), subjectId: s.id, title: t, order }
  return ok({ ...data, units: [...data.units, unit] }, unit)
}

export function updateUnit(data, { id, title } = {}) {
  const u = byId(data.units, id, 'unit')
  const t = str(title, 120)
  if (!t) fail('A unit needs a title.')
  return ok({ ...data, units: patch(data.units, id, { title: t }) }, { ...u, title: t })
}

export function deleteUnit(data, { id, unit: ref, subject } = {}) {
  const u = id ? byId(data.units, id, 'unit') : unitOrFail(data, ref, subject)
  return ok(
    {
      ...data,
      units: without(data.units, u.id),
      topics: data.topics.filter((t) => t.unitId !== u.id),
      exams: data.exams.map((e) => ({ ...e, unitIds: (e.unitIds || []).filter((x) => x !== u.id) })),
    },
    u,
  )
}

// One title or many (array, or text split on new lines and semicolons).
export function addTopics(data, { unitId, unit: ref, subject, titles, title } = {}) {
  const u = unitId ? byId(data.units, unitId, 'unit') : unitOrFail(data, ref, subject)
  let list = titles ?? title
  if (typeof list === 'string') list = list.split(/\n|;|,(?![^()]*\))/)
  list = (list || []).map((t) => str(t, 160)).filter(Boolean)
  if (!list.length) fail('Give at least one topic title.')
  const made = list.map((t) => ({ id: uid(), unitId: u.id, subjectId: u.subjectId, title: t, done: false, doneOn: null }))
  return ok({ ...data, topics: [...data.topics, ...made] }, made)
}

export function setTopicDone(data, { id, topic: ref, done = true } = {}) {
  const t = byIdOrTitle(data.topics, id || ref, 'topic')
  const on = Boolean(done)
  const next = { done: on, doneOn: on ? t.doneOn || todayISO() : null }
  return ok({ ...data, topics: patch(data.topics, t.id, next) }, { ...t, ...next })
}

// How sure the student feels about a ticked topic. Rating a topic also
// counts as covering it.
export const CONFIDENCE_LEVELS = ['shaky', 'ok', 'solid']

export function rateTopic(data, { id, topic: ref, confidence } = {}) {
  const t = byIdOrTitle(data.topics, id || ref, 'topic')
  const c = oneOf(confidence, CONFIDENCE_LEVELS, 'Confidence', null)
  if (!c) fail('Confidence must be shaky, ok or solid.')
  const next = { confidence: c, done: true, doneOn: t.doneOn || todayISO() }
  return ok({ ...data, topics: patch(data.topics, t.id, next) }, { ...t, ...next })
}

// A revision session for a topic: records the day and, optionally, how it went.
export function reviseTopic(data, { id, topic: ref, confidence } = {}) {
  const t = byIdOrTitle(data.topics, id || ref, 'topic')
  const c = confidence == null || confidence === '' ? t.confidence || null : oneOf(confidence, CONFIDENCE_LEVELS, 'Confidence', null)
  const next = { done: true, doneOn: t.doneOn || todayISO(), revisedOn: todayISO(), revisions: (t.revisions || 0) + 1, confidence: c }
  return ok({ ...data, topics: patch(data.topics, t.id, next) }, { ...t, ...next })
}

// A practice quiz on a topic: its score is evidence of how well it's known.
// It counts as a revision, and sets confidence from the score.
export function recordQuiz(data, { id, topic: ref, correct, total } = {}) {
  const t = byIdOrTitle(data.topics, id || ref, 'topic')
  const n = Math.max(1, Math.round(Number(total) || 0))
  const c = Math.min(n, Math.max(0, Math.round(Number(correct) || 0)))
  const pct = Math.round((c / n) * 100)
  const prev = t.quiz || { attempts: 0, best: 0 }
  const next = {
    done: true,
    doneOn: t.doneOn || todayISO(),
    revisedOn: todayISO(),
    revisions: (t.revisions || 0) + 1,
    confidence: pct >= 80 ? 'solid' : pct >= 50 ? 'ok' : 'shaky',
    quiz: { attempts: prev.attempts + 1, last: pct, best: Math.max(prev.best || 0, pct), on: todayISO() },
  }
  return ok({ ...data, topics: patch(data.topics, t.id, next) }, { ...t, ...next })
}

export function toggleTopic(data, { id } = {}) {
  const t = byId(data.topics, id, 'topic')
  return setTopicDone(data, { id, done: !t.done })
}

export function updateTopic(data, { id, title } = {}) {
  const t = byId(data.topics, id, 'topic')
  const v = str(title, 160)
  if (!v) fail('A topic needs a title.')
  return ok({ ...data, topics: patch(data.topics, id, { title: v }) }, { ...t, title: v })
}

export function deleteTopic(data, { id, topic: ref } = {}) {
  const t = byIdOrTitle(data.topics, id || ref, 'topic')
  return ok({ ...data, topics: without(data.topics, t.id) }, t)
}

// "Unit 1: Intro" / "Module 2 - Trees" / "Chapter III" lines start a unit;
// every other non-empty line is a topic in the unit above it.
export function importSyllabus(data, { subjectId, subject: ref, text } = {}) {
  subjectOrFail(data, subjectId || ref)
  if (!str(text, 20000)) fail('Paste the syllabus text.')
  const parsed = parseSyllabus(String(text).slice(0, 20000))
  if (!parsed.units.length) fail('No units or topics found in that text.')
  const r = addSyllabus(data, { subjectId, subject: ref, units: parsed.units })
  return ok(r.data, parsed.notes.length ? { ...r.result, notes: parsed.notes } : r.result)
}

// Write units and topics the student reviewed (see lib/ingest.js).
export function addSyllabus(data, { subjectId, subject: ref, units } = {}) {
  const s = subjectOrFail(data, subjectId || ref)
  const list = (Array.isArray(units) ? units : []).slice(0, 40)
  if (!list.length) fail('Give at least one unit.')
  let d = data
  let made = 0
  let topics = 0
  for (const u of list) {
    const title = str(u?.title, 120)
    if (!title) continue
    const { data: d1, result: unit } = addUnit(d, { subjectId: s.id, title })
    d = d1
    made++
    const names = (Array.isArray(u.topics) ? u.topics : []).map((t) => str(t, 160)).filter(Boolean).slice(0, 80)
    if (names.length) {
      d = addTopics(d, { unitId: unit.id, titles: names }).data
      topics += names.length
    }
  }
  if (!made) fail('Every unit needs a title.')
  return ok(d, { units: made, topics })
}

/* ---------- exams ---------- */

export function addExam(data, { subjectId, subject: ref, type, title, date: dt, time: tm, venue, unitIds, units } = {}) {
  const s = subjectOrFail(data, subjectId || ref)
  const ty = oneOf(type, EXAM_TYPES, 'Exam type', 'Quiz')
  const ids = resolveUnitIds(data, s, unitIds || units)
  const exam = {
    id: uid(),
    subjectId: s.id,
    type: ty,
    title: str(title, 80) || ty,
    date: date(dt, 'Exam date'),
    time: time(tm, 'Exam time', ''),
    venue: str(venue, 60),
    unitIds: ids,
  }
  return ok({ ...data, exams: [...data.exams, exam] }, exam)
}

function resolveUnitIds(data, subject, refs) {
  if (!refs) return []
  const list = Array.isArray(refs) ? refs : String(refs).split(',')
  return list.map((r) => unitOrFail(data, String(r).trim(), subject.id)).filter((u) => u.subjectId === subject.id).map((u) => u.id)
}

export function updateExam(data, { id, exam: ref, ...c } = {}) {
  const e = byIdOrTitle(data.exams, id || ref, 'exam')
  const clean = {}
  let s = data.subjects.find((x) => x.id === e.subjectId)
  if ((c.subjectId || c.subject) && (c.subjectId || c.subject) !== e.subjectId) {
    s = subjectOrFail(data, c.subjectId || c.subject)
    if (s.id !== e.subjectId) {
      clean.subjectId = s.id
      clean.unitIds = []
    }
  }
  if ('title' in c) clean.title = str(c.title, 80) || e.type
  if ('type' in c) clean.type = oneOf(c.type, EXAM_TYPES, 'Exam type', e.type)
  if ('date' in c) clean.date = date(c.date, 'Exam date')
  if ('time' in c) clean.time = time(c.time, 'Exam time', '')
  if ('venue' in c) clean.venue = str(c.venue, 60)
  if ('unitIds' in c || 'units' in c) clean.unitIds = s ? resolveUnitIds(data, s, c.unitIds || c.units) : []
  return ok({ ...data, exams: patch(data.exams, e.id, clean) }, { ...e, ...clean })
}

export function deleteExam(data, { id, exam: ref } = {}) {
  const e = byIdOrTitle(data.exams, id || ref, 'exam')
  return ok({ ...data, exams: without(data.exams, e.id) }, e)
}

/* ---------- assignments ---------- */

export function addAssignment(data, { subjectId, subject: ref, title, due, priority, status, estimate, notes } = {}) {
  const s = subjectOrFail(data, subjectId || ref)
  const t = str(title, 120)
  if (!t) fail('An assignment needs a title.')
  const a = {
    id: uid(),
    subjectId: s.id,
    title: t,
    due: date(due, 'Due date'),
    priority: oneOf(priority, PRIORITIES, 'Priority', 'medium'),
    status: oneOf(status, STATUSES, 'Status', 'todo'),
    estimate: minutes(estimate, 'Estimate', { min: 0, max: 1440, fallback: 60 }),
    notes: str(notes, 1000),
  }
  return ok({ ...data, assignments: [...data.assignments, a] }, a)
}

export function updateAssignment(data, { id, assignment: ref, ...c } = {}) {
  const a = byIdOrTitle(data.assignments, id || ref, 'assignment')
  const clean = {}
  if ('title' in c) clean.title = str(c.title, 120) || a.title
  if ('due' in c) clean.due = date(c.due, 'Due date')
  if ('priority' in c) clean.priority = oneOf(c.priority, PRIORITIES, 'Priority', a.priority)
  if ('status' in c) clean.status = oneOf(c.status, STATUSES, 'Status', a.status)
  if ('estimate' in c) clean.estimate = minutes(c.estimate, 'Estimate', { min: 0, max: 1440 })
  if ('notes' in c) clean.notes = str(c.notes, 1000)
  if ('subjectId' in c) clean.subjectId = subjectOrFail(data, c.subjectId).id
  if (clean.status === 'done' && a.status !== 'done') clean.doneOn = todayISO()
  return ok({ ...data, assignments: patch(data.assignments, a.id, clean) }, { ...a, ...clean })
}

export function deleteAssignment(data, { id, assignment: ref } = {}) {
  const a = byIdOrTitle(data.assignments, id || ref, 'assignment')
  return ok({ ...data, assignments: without(data.assignments, a.id) }, a)
}

/* ---------- planned study blocks ---------- */

export function addBlock(data, { subjectId, subject: ref, title, date: dt, start, minutes: m, planId, planRev, taskId } = {}) {
  const s = subjectOrFail(data, subjectId || ref)
  const b = {
    id: uid(),
    subjectId: s.id,
    title: str(title, 120) || 'Study',
    date: date(dt, 'Day', todayISO()),
    start: time(start, 'Start time', '18:00'),
    minutes: minutes(m, 'Length', { min: 5, max: 480, fallback: data.prefs?.focusLength || 45 }),
    done: false,
  }
  // Blocks made by Mission Planner remember their plan task, so applying the
  // same plan twice never creates duplicates.
  if (planId) Object.assign(b, { planId: str(planId, 64), planRev: Number(planRev) || 1, taskId: str(taskId, 96) })
  return ok({ ...data, blocks: [...data.blocks, b] }, b)
}

export function updateBlock(data, { id, block: ref, ...c } = {}) {
  const b = byIdOrTitle(data.blocks, id || ref, 'study block')
  const clean = {}
  if ('title' in c) clean.title = str(c.title, 120) || b.title
  if ('date' in c) clean.date = date(c.date, 'Day')
  if ('start' in c) clean.start = time(c.start, 'Start time', b.start)
  if ('minutes' in c) clean.minutes = minutes(c.minutes, 'Length', { min: 5, max: 480 })
  if ('subjectId' in c) clean.subjectId = subjectOrFail(data, c.subjectId).id
  return ok({ ...data, blocks: patch(data.blocks, b.id, clean) }, { ...b, ...clean })
}

export function deleteBlock(data, { id, block: ref } = {}) {
  const b = byIdOrTitle(data.blocks, id || ref, 'study block')
  return ok({ ...data, blocks: without(data.blocks, b.id), sessions: data.sessions.filter((x) => x.blockId !== b.id) }, b)
}

// Ticking a block also logs its time, so streaks and charts move.
export function completeBlock(data, { id, block: ref, minutes: m } = {}) {
  const b = byIdOrTitle(data.blocks, id || ref, 'study block')
  if (b.done) return ok(data, b)
  const session = {
    id: uid(),
    subjectId: b.subjectId,
    minutes: minutes(m, 'Minutes', { fallback: b.minutes }),
    date: b.date > todayISO() ? todayISO() : b.date,
    note: b.title,
    blockId: b.id,
  }
  return ok({ ...data, blocks: patch(data.blocks, b.id, { done: true }), sessions: [session, ...data.sessions] }, { ...b, done: true })
}

export function reopenBlock(data, { id } = {}) {
  const b = byId(data.blocks, id, 'study block')
  return ok({ ...data, blocks: patch(data.blocks, id, { done: false }), sessions: data.sessions.filter((x) => x.blockId !== id) }, { ...b, done: false })
}

/* ---------- logged study time ---------- */

export function logSession(data, { subjectId, subject: ref, minutes: m, date: dt, note } = {}) {
  const s = subjectOrFail(data, subjectId || ref)
  const day = date(dt, 'Day', todayISO())
  if (day > todayISO()) fail('You can only log time for today or earlier.')
  const session = { id: uid(), subjectId: s.id, minutes: minutes(m, 'Minutes'), date: day, note: str(note, 120) }
  return ok({ ...data, sessions: [session, ...data.sessions] }, session)
}

export function deleteSession(data, { id } = {}) {
  const x = byId(data.sessions, id, 'study session')
  return ok({ ...data, sessions: without(data.sessions, id) }, x)
}

/* ---------- registry ---------- */

export const OPS = {
  updateProfile,
  updatePrefs,
  updateGuide,
  addSubject,
  updateSubject,
  deleteSubject,
  addUnit,
  updateUnit,
  deleteUnit,
  addTopics,
  updateTopic,
  setTopicDone,
  toggleTopic,
  addSyllabus,
  rateTopic,
  reviseTopic,
  recordQuiz,
  deleteTopic,
  importSyllabus,
  addExam,
  updateExam,
  deleteExam,
  addAssignment,
  updateAssignment,
  deleteAssignment,
  addBlock,
  updateBlock,
  deleteBlock,
  completeBlock,
  reopenBlock,
  logSession,
  deleteSession,
}

export function runOp(data, name, args) {
  const op = OPS[name]
  if (!op) fail(`Unknown action "${name}".`)
  return op(normalize(data), args || {})
}
