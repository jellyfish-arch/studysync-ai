// Turning pasted text into StudySync data, for the student to review before
// anything is saved. Today: syllabus text (units and topics). The same shape
// (parse -> review -> write) is meant for assignment briefs and, later,
// uploaded PDFs; reading files is not built yet.

// "Unit 1", "UNIT-III", "Module 2:", "Chapter 3.", "Part B" ... but not a
// topic like "Unit testing": a number, numeral or separator must follow.
const UNIT_HEAD = /^(unit|module|chapter|part|section)\s*(?:[-–:.]?\s*(?:[0-9]+|[ivxlc]+|[a-z])\b|[-–:.])\s*[-–:.)]?\s*/i
// University syllabi end with reading lists and outcomes, which aren't topics.
const STOP = /^(text\s*books?|reference\s*books?|references|suggested\s+readings?|course\s+outcomes?|cos?\b|web\s*resources|e-?resources|lab\s+experiments?|list\s+of\s+experiments)\b/i
// Hours and codes printed next to units: "(8 hours)", "8 Hrs", "L: 10", "[CO2]".
const NOISE = [/\(\s*\d+\s*(hours?|hrs?|h|periods?|lectures?)\s*\)/gi, /\b\d+\s*(hours?|hrs?|periods?|lectures?)\b\.?/gi, /\bL\s*[:\-]\s*\d+\b/gi, /\[\s*CO\s*\d+(\s*,\s*CO\s*\d+)*\s*\]/gi, /\bCO\s*\d+\b/g]

const clean = (s) => {
  let v = s
  for (const re of NOISE) v = v.replace(re, ' ')
  return v
    .replace(/^[\s\-–•*·▪●○]+/, '')
    .replace(/^\d{1,2}(\.\d{1,2})*[.)]\s+/, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s.;:,–-]+$/, '')
    .trim()
}

// Split a run of topics: always on ";", and on "," only when it's really a
// list (three or more items, or a long line), so a short phrase like
// "SQL joins, views and triggers" stays one topic. Never inside brackets.
function splitOutside(text, sep) {
  const parts = []
  let depth = 0
  let cur = ''
  for (const ch of text) {
    if ('([{'.includes(ch)) depth++
    if (')]}'.includes(ch)) depth = Math.max(0, depth - 1)
    if (ch === sep && depth === 0) {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  parts.push(cur)
  return parts
}

export function splitTopics(text) {
  const out = []
  for (const piece of splitOutside(text, ';')) {
    const commas = splitOutside(piece, ',')
    out.push(...(commas.length >= 3 || piece.length > 80 ? commas : [piece]))
  }
  return out.map(clean).filter((t) => t.length > 1 && t.length <= 160)
}

export function parseSyllabus(text) {
  const units = []
  const notes = []
  let current = null
  let skippedBefore = 0
  let stoppedAt = null
  const lines = String(text || '').split(/\r?\n/)
  const hasHeads = lines.some((l) => UNIT_HEAD.test(l.trim()) && clean(l.trim().replace(UNIT_HEAD, '')).length > 0)

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (STOP.test(clean(line))) {
      stoppedAt = clean(line)
      break
    }
    if (hasHeads && UNIT_HEAD.test(line)) {
      const rest = line.replace(UNIT_HEAD, '')
      // "Processes: states, PCB" or "Processes – states, PCB" -> title + topics
      const m = rest.match(/^(.{3,80}?)\s*(?::|\s[-–]\s)\s*(.+)$/)
      const title = clean(m ? m[1] : rest) || `Unit ${units.length + 1}`
      current = { title, topics: m ? splitTopics(m[2]) : [] }
      units.push(current)
      continue
    }
    if (!current) {
      if (hasHeads) {
        skippedBefore++
        continue
      }
      // No unit headings at all: the first line names the only unit.
      current = { title: clean(line) || 'Syllabus', topics: [] }
      units.push(current)
      continue
    }
    current.topics.push(...splitTopics(line))
  }

  // Same topic twice in a unit (common when copying from PDFs): keep one.
  for (const u of units) u.topics = [...new Map(u.topics.map((t) => [t.toLowerCase(), t])).values()]
  if (skippedBefore) notes.push(`Skipped ${skippedBefore} line${skippedBefore === 1 ? '' : 's'} before the first unit (usually the course title or code).`)
  if (stoppedAt) notes.push(`Stopped at "${stoppedAt.slice(0, 40)}": reading lists and outcomes aren't topics.`)
  const empty = units.filter((u) => !u.topics.length).length
  if (empty) notes.push(`${empty} unit${empty === 1 ? ' has' : 's have'} no topics yet. You can add them later.`)
  return { units, notes, topics: units.reduce((n, u) => n + u.topics.length, 0) }
}
