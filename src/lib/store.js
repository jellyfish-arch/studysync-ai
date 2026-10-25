// The logged-in student's data. Each account has its own copy in this browser
// (localStorage); when the StudySync server is running it is also synced
// there (see sync.js), which is what lets MCP clients and Yuuki's AI work on
// the same data. Every change goes through ops.js.
import { create } from 'zustand'
import * as O from './ops.js'

export { SUBJECT_COLORS, colorOf, EXAM_TYPES, PRIORITIES, uid, DATA_KEYS } from './ops.js'

const dataKey = (u) => `studysync:data:${u}`
const timerKey = (u) => `studysync:timer:${u}`

/* ---------- events: Yuuki listens to these ---------- */
const listeners = new Set()
export function onOp(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export const emitOp = (event) => listeners.forEach((fn) => fn(event))

let errorHandler = (msg) => console.warn(msg)
export const setOpErrorHandler = (fn) => {
  errorHandler = fn
}

export const pickData = (s) => Object.fromEntries(O.DATA_KEYS.map((k) => [k, s[k]]))

function readJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}

export const useStore = create((set, get) => {
  const run = (name, args, { quiet = false } = {}) => {
    try {
      const { data, result } = O.runOp(pickData(get()), name, args)
      set(data)
      if (!quiet) emitOp({ name, args, result, source: 'app' })
      return result
    } catch (e) {
      if (e instanceof O.OpError) {
        errorHandler(e.message)
        return null
      }
      throw e
    }
  }

  return {
    user: null,
    ...O.emptyData(),
    timer: null,

    run,

    // ---------- profile, preferences, Yuuki's guide ----------
    updateProfile: (c) => run('updateProfile', c),
    updatePrefs: (c) => run('updatePrefs', c),
    updateGuide: (c) => run('updateGuide', c, { quiet: true }),

    // ---------- subjects ----------
    addSubject: (s) => run('addSubject', s),
    updateSubject: (id, c) => run('updateSubject', { ...c, id }),
    deleteSubject: (id) => run('deleteSubject', { id }),

    // ---------- syllabus ----------
    addUnit: (subjectId, title) => run('addUnit', { subjectId, title }),
    updateUnit: (id, c) => run('updateUnit', { ...c, id }),
    deleteUnit: (id) => run('deleteUnit', { id }),
    addTopic: (unitId, title) => run('addTopics', { unitId, titles: [title] }),
    addTopics: (unitId, titles) => run('addTopics', { unitId, titles }),
    updateTopic: (id, title) => run('updateTopic', { id, title }),
    toggleTopic: (id) => run('toggleTopic', { id }),
    rateTopic: (id, confidence) => run('rateTopic', { id, confidence }),
    addSyllabus: (subjectId, units) => run('addSyllabus', { subjectId, units }),
    reviseTopic: (id, confidence) => run('reviseTopic', { id, confidence }),
    recordQuiz: (id, correct, total) => run('recordQuiz', { id, correct, total }),
    deleteTopic: (id) => run('deleteTopic', { id }),
    importSyllabus: (subjectId, text) => run('importSyllabus', { subjectId, text }),

    // ---------- exams ----------
    addExam: (e) => run('addExam', e),
    updateExam: (id, c) => run('updateExam', { ...c, id }),
    deleteExam: (id) => run('deleteExam', { id }),

    // ---------- assignments ----------
    addAssignment: (a) => run('addAssignment', a),
    updateAssignment: (id, c) => run('updateAssignment', { ...c, id }),
    deleteAssignment: (id) => run('deleteAssignment', { id }),

    // ---------- planned study blocks ----------
    addBlock: (b) => run('addBlock', b),
    updateBlock: (id, c) => run('updateBlock', { ...c, id }),
    deleteBlock: (id) => run('deleteBlock', { id }),
    completeBlock: (id, minutes) => run('completeBlock', { id, minutes }),
    reopenBlock: (id) => run('reopenBlock', { id }),

    // ---------- logged time ----------
    logSession: (s) => run('logSession', s),
    deleteSession: (id) => run('deleteSession', { id }),

    // ---------- focus timer (kept on this device only) ----------
    startTimer: ({ subjectId, blockId = null, title = '', planned }) =>
      set({ timer: { subjectId, blockId, title, planned: planned || get().prefs.focusLength || 45, startedAt: Date.now(), pausedAt: null, pausedMs: 0 } }),
    pauseTimer: () => set((s) => (s.timer && !s.timer.pausedAt ? { timer: { ...s.timer, pausedAt: Date.now() } } : {})),
    resumeTimer: () =>
      set((s) => (s.timer?.pausedAt ? { timer: { ...s.timer, pausedMs: s.timer.pausedMs + (Date.now() - s.timer.pausedAt), pausedAt: null } } : {})),
    finishTimer: () => {
      const t = get().timer
      if (!t) return 0
      const end = t.pausedAt || Date.now()
      const minutes = Math.min(720, Math.max(1, Math.round((end - t.startedAt - t.pausedMs) / 60000)))
      if (t.blockId && get().blocks.some((b) => b.id === t.blockId && !b.done)) get().completeBlock(t.blockId, minutes)
      else get().logSession({ subjectId: t.subjectId, minutes, note: t.title })
      set({ timer: null })
      return minutes
    },
    cancelTimer: () => set({ timer: null }),

    // ---------- account ----------
    login: (username) => {
      try {
        localStorage.removeItem('studysync') // the old single-user demo from v0.2
      } catch {
        /* ignore */
      }
      const data = O.normalize(readJSON(dataKey(username)))
      set({ user: username, ...data, timer: readJSON(timerKey(username)) })
    },
    logout: () => {
      flush()
      set({ user: null, ...O.emptyData(), timer: null })
    },
    // Keep who you are and your settings; drop all study data.
    eraseAll: () => set({ subjects: [], units: [], topics: [], exams: [], assignments: [], blocks: [], sessions: [], timer: null }),
    replaceAll: (data) => set({ ...O.normalize(data) }),
    // Data that came from the server (an MCP client or another tab changed it).
    applyRemote: (data) => set({ ...O.normalize(data) }),
  }
})

/* ---------- saving to this browser ---------- */
let saveTimer = null
function flush() {
  clearTimeout(saveTimer)
  const s = useStore.getState()
  if (!s.user) return
  try {
    localStorage.setItem(dataKey(s.user), JSON.stringify(pickData(s)))
  } catch {
    /* storage full or blocked */
  }
}

useStore.subscribe((s, prev) => {
  if (!s.user || s.user !== prev.user) return
  if (O.DATA_KEYS.some((k) => s[k] !== prev[k])) {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(flush, 200)
  }
  if (s.timer !== prev.timer) {
    try {
      if (s.timer) localStorage.setItem(timerKey(s.user), JSON.stringify(s.timer))
      else localStorage.removeItem(timerKey(s.user))
    } catch {
      /* ignore */
    }
  }
})

if (typeof window !== 'undefined') window.addEventListener('pagehide', flush)

export function exportData() {
  return { app: 'studysync', version: 2, exported: new Date().toISOString(), ...pickData(useStore.getState()) }
}

export function validateImport(d) {
  if (!d || typeof d !== 'object') return null
  for (const k of O.LIST_KEYS) if (!Array.isArray(d[k])) return null
  return O.normalize(d)
}
