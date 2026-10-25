// Revision planner: which ticked topics are due for a revision, and why.
//
// Evidence used, all from the student's own data:
//   - when a topic was ticked (doneOn) and last revised (revisedOn, revisions)
//   - how confident they said they are (confidence: shaky / ok / solid)
//   - how close the next exam covering it is
// Spaced repetition with simple, explainable gaps. It is a reminder, not a
// promise of mastery.
import { addDays, daysBetween, todayISO } from '../dates.js'
import { examTopics } from '../selectors.js'

export const CONFIDENCE = {
  shaky: { label: 'Shaky', gaps: [1, 3, 7] },
  ok: { label: 'Okay', gaps: [3, 7, 21] },
  solid: { label: 'Solid', gaps: [7, 21, 45] },
}
const UNRATED = [3, 10, 25]

// Days until the next revision after the n-th one (0 = first, right after ticking).
export function nextGap(confidence, revisions = 0) {
  const gaps = CONFIDENCE[confidence]?.gaps || UNRATED
  return gaps[Math.min(revisions, gaps.length - 1)]
}

export function revisionQueue(data, { today = todayISO(), limit = 50 } = {}) {
  const upcoming = data.exams.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const examFor = new Map()
  for (const e of upcoming) for (const t of examTopics(data, e)) if (!examFor.has(t.id)) examFor.set(t.id, e)

  const out = []
  for (const t of data.topics) {
    if (!t.done) continue
    const last = t.revisedOn || t.doneOn
    if (!last) continue
    const revisions = t.revisions || 0
    const due = addDays(last, nextGap(t.confidence, revisions))
    const exam = examFor.get(t.id)
    const examSoon = exam && daysBetween(today, exam.date) <= 7
    const staleForExam = examSoon && t.confidence !== 'solid' && daysBetween(last, today) >= 3
    if (due > today && !staleForExam) continue
    const subject = data.subjects.find((s) => s.id === t.subjectId)
    const reason = staleForExam
      ? `${exam.title} is in ${daysBetween(today, exam.date)} day${daysBetween(today, exam.date) === 1 ? '' : 's'}${t.confidence === 'shaky' ? ' and you marked it shaky' : ''}.`
      : t.confidence === 'shaky'
        ? 'You marked it shaky.'
        : revisions
          ? `Last revised ${daysBetween(last, today)} days ago.`
          : `Ticked ${daysBetween(last, today)} days ago and not revised since.`
    out.push({
      topicId: t.id,
      title: t.title,
      subjectId: t.subjectId,
      subject: subject?.code || subject?.name || 'Subject',
      confidence: t.confidence || null,
      revisions,
      due,
      overdueDays: Math.max(0, daysBetween(due, today)),
      examId: exam?.id || null,
      examDate: exam?.date || null,
      reason,
    })
  }
  // Close exams first, then shaky topics, then the longest overdue.
  const rank = (x) => [x.examDate && daysBetween(today, x.examDate) <= 7 ? 0 : 1, x.examDate || '9999', x.confidence === 'shaky' ? 0 : 1, -x.overdueDays]
  out.sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] < rb[i] ? -1 : 1
    return 0
  })
  return out.slice(0, limit)
}

// For one exam: how many of its ticked topics are shaky or unrated. Shown next
// to readiness, because "ticked" is not the same as "ready".
export function examConfidence(data, exam) {
  const ticked = examTopics(data, exam).filter((t) => t.done)
  return {
    ticked: ticked.length,
    shaky: ticked.filter((t) => t.confidence === 'shaky').length,
    solid: ticked.filter((t) => t.confidence === 'solid').length,
    unrated: ticked.filter((t) => !t.confidence).length,
  }
}
