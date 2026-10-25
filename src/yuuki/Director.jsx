// Decides when Yuuki speaks: the guided tour after the intro, a cheerful
// remark whenever you create or finish something, a tip the first time you
// open each page, a hello with what's on today, and an "oops" when an action
// fails. Nothing here shows UI by itself; it calls say().
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { onOp, setOpErrorHandler, useStore } from '../lib/store.js'
import { useSync } from '../lib/sync.js'
import { useUI } from '../lib/ui.js'
import { pageFor } from '../lib/nav.js'
import { blocksOn, examReadiness, overdue, unitProgress, upcomingExams } from '../lib/selectors.js'
import { daysBetween, formatMinutes, formatTime, relativeDays, todayISO } from '../lib/dates.js'
import { hush, line, say, useYuuki } from './state.js'

const firstName = () => (useStore.getState().profile.name || useStore.getState().user || '').split(' ')[0]

/* ---------- the tour ---------- */
export const TOUR = [
  {
    id: 'subjects',
    route: () => '/app/subjects',
    anchor: '[data-tour="add-subject"]',
    pose: 'point',
    accent: 'var(--gold)',
    text: () => `This is your Subjects page, ${firstName()}. Tap "Add subject" and add one from your timetable. I'll wait right here!`,
    wait: (d) => d.subjects.length > 0,
    success: (d) => line(['{s}! Great pick.', 'Ooh, {s}. Good one!', '{s} is in. Nice!'], { s: d.subjects.at(-1).name }),
  },
  {
    id: 'syllabus',
    route: (d) => (d.subjects[0] ? `/app/subjects/${d.subjects[0].id}` : '/app/subjects'),
    anchor: '[data-tour="syllabus"]',
    pose: 'read',
    accent: 'var(--gold)',
    text: () => 'Every subject has a syllabus. Add its units and topics here, or paste the whole thing straight from your syllabus PDF. Ticking topics later is how I know how ready you are.',
    wait: (d) => d.units.length > 0,
    success: () => line(['Look at that syllabus!', 'Units in. You are organised now.', 'Perfect, that is the hard part done.']),
  },
  {
    id: 'exam',
    route: () => '/app/exams',
    anchor: '[data-tour="add-exam"]',
    pose: 'worried',
    accent: 'var(--rose)',
    text: () => "Got a quiz or an exam coming up? Add its date and the units it covers. I'll count down with you, no panicking allowed.",
    wait: (d) => d.exams.length > 0,
    success: (d) => line(['Countdown started: {n} days to go.', 'Noted! {n} days. We can do this.'], { n: Math.max(0, daysBetween(todayISO(), d.exams.at(-1).date)) }),
  },
  {
    id: 'assignment',
    route: () => '/app/assignments',
    anchor: '[data-tour="add-assignment"]',
    pose: 'clipboard',
    accent: 'var(--coral)',
    text: () => 'Assignments and lab records live here, each with a due date. Later you can drag them from To do to Done.',
    wait: (d) => d.assignments.length > 0,
    success: () => line(['Got it on the board.', 'Added! One less thing to remember.']),
  },
  {
    id: 'plan',
    route: () => '/app/planner',
    anchor: '[data-tour="add-block"]',
    pose: 'clipboard',
    accent: 'var(--mint)',
    text: () => 'Now plan a study block: pick a subject, a time and how long. Your week builds up from these.',
    wait: (d) => d.blocks.length > 0,
    success: () => line(['Planned! When it is time, press play on the block.', 'Your first block. Future you says thanks.']),
  },
  {
    id: 'focus',
    route: () => '/app',
    anchor: '[data-tour="focus"]',
    pose: 'desk',
    accent: 'var(--lime)',
    text: () => 'When you sit down to study, hit Focus. I keep the time and log it for you, even if you switch tabs.',
  },
  {
    id: 'me',
    route: () => '/app',
    anchor: '[data-tour="yuuki-dock"]',
    pose: 'present',
    accent: 'var(--mint)',
    text: () => "That's the tour! I'm always right here. Tap me to chat, ask what to study next, or just tell me to add things for you.",
    last: true,
  },
]

function useTour() {
  const navigate = useNavigate()
  const guide = useStore((s) => s.guide)
  const updateGuide = useStore((s) => s.updateGuide)
  const counts = useStore((s) => `${s.subjects.length}|${s.units.length}|${s.exams.length}|${s.assignments.length}|${s.blocks.length}`)
  const active = guide.introduced && !guide.tourDone && guide.tour > 0
  const index = active ? guide.tour - 1 : -1
  const step = TOUR[index]
  const advancing = useRef(false)

  const end = (finished) => {
    updateGuide({ tourDone: true, tour: 0 })
    hush()
    say({ force: true, pose: finished ? 'thumbs' : 'wave', text: finished ? `You're all set, ${firstName()}. Go get them!` : 'Okay, tour off. Tap me in the corner if you want it back.' })
  }
  const next = () => {
    advancing.current = false
    if (!step || step.last) return end(true)
    updateGuide({ tour: guide.tour + 1 })
  }

  // Show the step.
  useEffect(() => {
    if (!step) return
    const d = useStore.getState()
    if (step.wait?.(d)) return next() // already done (e.g. replaying the tour)
    navigate(step.route(d))
    const t = setTimeout(
      () =>
        say({
          sticky: true,
          force: true,
          anchor: step.anchor,
          pose: step.pose,
          accent: step.accent,
          title: `Yuuki · ${index + 1} of ${TOUR.length}`,
          text: step.text(d),
          onClose: () => end(false),
          actions: step.wait
            ? [
                { label: 'Skip this step', run: next, keep: true },
                { label: 'End tour', run: () => end(false), quiet: true, keep: true },
              ]
            : [
                { label: step.last ? 'Finish' : 'Next', run: next, primary: true, keep: true },
                { label: 'End tour', run: () => end(false), quiet: true, keep: true },
              ],
        }),
      350,
    )
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id])

  // Move on once the step's thing exists.
  useEffect(() => {
    if (!step?.wait || advancing.current) return
    const d = useStore.getState()
    if (!step.wait(d)) return
    advancing.current = true
    useUI.getState().closeEditor()
    say({ sticky: true, force: true, pose: 'cheer', accent: step.accent, text: step.success(d), noClose: true })
    const t = setTimeout(next, 2300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts, step?.id])

  return active
}

/* ---------- remarks when things change ---------- */
function react({ name, args, result, source, added }) {
  const s = useStore.getState()
  if (!s.prefs.yuukiTips) return
  const subj = (id) => s.subjects.find((x) => x.id === id)
  if (name === 'remote') {
    const parts = []
    const n = (k, one, many) => added[k]?.length && parts.push(`${added[k].length} ${added[k].length === 1 ? one : many}`)
    n('subjects', 'subject', 'subjects')
    n('exams', 'exam', 'exams')
    n('assignments', 'assignment', 'assignments')
    n('blocks', 'study block', 'study blocks')
    n('topics', 'topic', 'topics')
    if (!parts.length) return
    // Mission plans confirm themselves on their page; credit AI apps only for their own changes.
    if (source === 'planner') return
    const who = source === 'mcp' ? 'Your AI assistant just added' : 'Synced from another window:'
    return say({ pose: 'present', text: `${who} ${parts.join(', ')}. It's all here now.`, accent: 'var(--teal)' })
  }
  if (source !== 'app' && source !== 'yuuki') return
  switch (name) {
    case 'addSubject':
      return say({
        pose: 'cheer',
        accent: 'var(--gold)',
        text: line(['Ooh, {s}! Open it and add the units next.', '{s} added! Want to put its syllabus in?', 'New subject: {s}. Let us fill in its syllabus.'], { s: result.name }),
        actions: [{ label: `Open ${result.name}`, to: `/app/subjects/${result.id}`, primary: true }],
      })
    case 'addUnit':
      return say({ pose: 'read', accent: 'var(--gold)', text: line(['Unit "{u}" added. Now the topics inside it!', 'Nice, "{u}". Drop its topics in.'], { u: result.title }) })
    case 'importSyllabus':
      return say({ pose: 'jump', accent: 'var(--gold)', text: `Whoa, ${result.units} units and ${result.topics} topics in one go. Show-off.` })
    case 'toggleTopic': {
      if (!result.done) return
      const u = unitProgress(s, result.unitId)
      if (u.total > 1 && u.done === u.total) {
        const unit = s.units.find((x) => x.id === result.unitId)
        return say({ pose: 'jump', accent: 'var(--gold)', text: line(['That is the whole unit "{u}" done. Proud of you!', 'Unit complete: "{u}"! Victory lap?'], { u: unit?.title }) })
      }
      const exam = upcomingExams(s).find((e) => e.subjectId === result.subjectId)
      if (exam) {
        const r = examReadiness(s, exam)
        if (r.total && r.done === r.total) return say({ pose: 'jump', accent: 'var(--rose)', text: `100% of ${exam.title} covered. You're ready. Revise and rest!` })
      }
      return
    }
    case 'addExam': {
      const d = daysBetween(todayISO(), result.date)
      return say({
        pose: d <= 3 ? 'worried' : 'clipboard',
        accent: 'var(--rose)',
        text: d <= 3 ? `${result.title} ${relativeDays(result.date)}? Okay, focus mode. Tick off its topics as you revise.` : line(['{t} on the calendar. {d} days, I am counting.', 'Got it: {t}, {d} days away.'], { t: result.title, d }),
      })
    }
    case 'addAssignment':
      return say({ pose: 'clipboard', accent: 'var(--coral)', text: line(['"{t}" is on the board, due {r}.', 'Added "{t}". Due {r}.'], { t: result.title, r: relativeDays(result.due) }) })
    case 'updateAssignment':
      if (args.status === 'done') return say({ pose: 'thumbs', accent: 'var(--coral)', text: line(['Done and dusted!', 'One off the list. Nice work.', 'Submitted? Look at you.']) })
      return
    case 'addBlock':
      return say({ pose: 'clipboard', accent: 'var(--mint)', text: line(['Planned: {t} at {time}.', '{t} is on your plan.'], { t: result.title, time: formatTime(result.start) }) })
    case 'completeBlock': {
      const left = blocksOn(s, todayISO()).filter((b) => !b.done).length
      return say({ pose: left ? 'thumbs' : 'jump', accent: 'var(--lime)', text: left ? line(['Block done! {n} more today.', 'Ticked! {n} to go.'], { n: left }) : "That's every block for today. Go rest, you earned it." })
    }
    case 'logSession':
      return say({ pose: 'thumbs', accent: 'var(--lime)', text: `${formatMinutes(result.minutes)} logged${subj(result.subjectId) ? ` for ${subj(result.subjectId).name}` : ''}. Your streak thanks you.` })
    default:
  }
}

/* ---------- first-visit tips per page ---------- */
const TIPS = {
  Today: { pose: 'desk', text: 'Today is your focus list: the next thing to do, then your blocks and what is due. Tick blocks as you finish them.' },
  Planner: { pose: 'clipboard', text: 'Drag a block to another day to move it. The bars on top compare what you planned with what you did.' },
  Calendar: { pose: 'present', text: 'Click any day to see what is on it, or to add an exam, deadline or block for that day.' },
  Subjects: { pose: 'read', text: 'Each card shows how much of that syllabus you have covered. Open one to tick topics.' },
  Assignments: { pose: 'clipboard', text: 'Drag cards between To do, In progress and Done. Overdue ones turn red so they cannot hide.' },
  Exams: { pose: 'worried', text: 'Readiness is the share of an exam’s topics you have ticked. You can tick them right here too.' },
  Analytics: { pose: 'think', text: 'Everything here comes from the time you logged. Switch between 7, 30 and 90 days up top.' },
}

/* ---------- director ---------- */
export default function Director() {
  const { pathname } = useLocation()
  const ready = useSync((s) => s.ready)
  const user = useStore((s) => s.user)
  const introduced = useStore((s) => s.guide.introduced)
  const tourDone = useStore((s) => s.guide.tourDone)
  const touring = useTour()
  const greeted = useRef(false)

  // Remarks and errors.
  useEffect(() => {
    setOpErrorHandler((msg) => say({ force: true, pose: 'oops', accent: 'var(--coral)', title: 'Yuuki · oops', text: msg }))
    const off = onOp((e) => {
      if (!useYuuki.getState().bubble?.sticky) react(e)
    })
    return () => {
      off()
      setOpErrorHandler((msg) => console.warn(msg))
    }
  }, [])

  // Hello, with what matters today.
  useEffect(() => {
    if (!ready || !user || !introduced || !tourDone || greeted.current) return
    greeted.current = true
    const key = `studysync:greeted:${user}:${todayISO()}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    const s = useStore.getState()
    if (!s.prefs.yuukiTips) return
    const t = setTimeout(() => {
      const today = todayISO()
      const h = new Date().getHours()
      const name = firstName()
      const late = overdue(s, today)
      const blocks = blocksOn(s, today).filter((b) => !b.done)
      const exam = upcomingExams(s, today)[0]
      const examBit = exam ? ` ${exam.title} is ${relativeDays(exam.date, today)} (${examReadiness(s, exam).pct}% ready).` : ''
      if (h >= 23 || h < 5) return say({ pose: 'sleepy', text: `It's late, ${name}. Short session and then sleep, deal?${examBit}` })
      if (late.length) return say({ pose: 'worried', accent: 'var(--coral)', text: `Hey ${name}. ${late.length} assignment${late.length === 1 ? ' is' : 's are'} overdue. Let's clear ${late.length === 1 ? 'it' : 'them'} first?`, actions: [{ label: 'Show me', to: '/app/assignments', primary: true }] })
      if (blocks.length) return say({ pose: 'wave', text: `${h < 12 ? 'Morning' : h < 17 ? 'Hey' : 'Evening'}, ${name}! ${blocks.length} study block${blocks.length === 1 ? '' : 's'} planned today.${examBit}`, actions: [{ label: 'Open Today', to: '/app/today', primary: true }] })
      if (!s.subjects.length) return say({ pose: 'hug', text: `Welcome back, ${name}! Let's add your first subject.`, actions: [{ label: 'Add a subject', run: () => useUI.getState().openEditor('subject'), primary: true }] })
      say({ pose: 'wave', text: `${h < 12 ? 'Morning' : h < 17 ? 'Hi' : 'Evening'}, ${name}! Nothing planned yet today.${examBit} Plan a block?`, actions: [{ label: 'Plan a block', run: () => useUI.getState().openEditor('block'), primary: true }] })
    }, 900)
    return () => clearTimeout(t)
  }, [ready, user, introduced, tourDone])

  // Tips the first time each page opens.
  useEffect(() => {
    if (!ready || touring || !tourDone) return
    const page = pageFor(pathname).label
    const tip = TIPS[page]
    const s = useStore.getState()
    if (!tip || !s.prefs.yuukiTips || s.guide.seen.includes(page)) return
    const t = setTimeout(() => {
      s.updateGuide({ seen: [...useStore.getState().guide.seen, page] })
      say({ ...tip, accent: pageFor(pathname).color })
    }, 1200)
    return () => clearTimeout(t)
  }, [pathname, ready, touring, tourDone])

  return null
}
