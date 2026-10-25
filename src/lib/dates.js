// All dates are local calendar days as 'YYYY-MM-DD' strings. Study logs store
// a day and a duration, never a clock time.

const pad = (n) => String(n).padStart(2, '0')

// Display settings from Settings > Study (set by main.jsx).
let weekStartsOn = 1 // 1 = Monday, 0 = Sunday
let clock24 = false
export function setDateSettings({ weekStart, timeFormat } = {}) {
  if (weekStart) weekStartsOn = weekStart === 'sun' ? 0 : 1
  if (timeFormat) clock24 = timeFormat === '24h'
}
export const firstWeekday = () => weekStartsOn

export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO(now = new Date()) {
  return toISODate(now)
}

function parse(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Whole days from `from` to `to` (positive when `to` is later).
export function daysBetween(from, to) {
  return Math.round((parse(to) - parse(from)) / 86400000)
}

export function addDays(iso, n) {
  const d = parse(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export function lastNDays(n, today = todayISO()) {
  return Array.from({ length: n }, (_, i) => addDays(today, i - n + 1))
}

export function formatMinutes(min) {
  if (!min) return '0 min'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

export function formatDay(iso, today = todayISO()) {
  const diff = daysBetween(today, iso)
  if (diff === 0) return 'Today'
  if (diff === -1) return 'Yesterday'
  if (diff === 1) return 'Tomorrow'
  const d = parse(iso)
  const sameYear = d.getFullYear() === parse(today).getFullYear()
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric' })
}

export function longToday(now = new Date()) {
  return now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function shortWeekday(iso) {
  return parse(iso).toLocaleDateString('en-IN', { weekday: 'short' })
}

// "in 6 days", "tomorrow", "3 days ago"
export function relativeDays(iso, today = todayISO()) {
  const diff = daysBetween(today, iso)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`
}

// First day (Monday, or Sunday if chosen) of the week containing `iso`.
export function weekStart(iso = todayISO()) {
  const d = parse(iso)
  const day = (d.getDay() - weekStartsOn + 7) % 7
  d.setDate(d.getDate() - day)
  return toISODate(d)
}

export function weekDays(startIso) {
  return Array.from({ length: 7 }, (_, i) => addDays(startIso, i))
}

// 6-week grid (starting on the chosen first weekday) covering the month of `iso`.
export function monthGrid(iso) {
  const [y, m] = iso.split('-').map(Number)
  const first = `${y}-${String(m).padStart(2, '0')}-01`
  const start = weekStart(first)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export function monthLabel(iso) {
  return parse(iso).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export function addMonths(iso, n) {
  const d = parse(iso)
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  return toISODate(d)
}

export function dayNum(iso) {
  return parse(iso).getDate()
}

export function shortDate(iso) {
  return parse(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function fullDate(iso) {
  return parse(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
}

// '19:30' -> '7:30 pm' (or '19:30' with the 24-hour clock on)
export function formatTime(hhmm) {
  if (!hhmm) return ''
  if (clock24) return hhmm
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

export function addMinutesToTime(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number)
  const total = (h * 60 + m + minutes) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function nowHHMM(now = new Date()) {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export function greeting(now = new Date()) {
  const h = now.getHours()
  if (h < 5) return 'Burning the midnight oil'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
