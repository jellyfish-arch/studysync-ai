// Three-way merge used when the app and an AI (through MCP) change the same
// account at about the same time.
//
// `base` is the version the app last saw, `mine` is the app's current copy and
// `theirs` is what the server holds now. Lists are merged item by item (by id):
// whatever the app added, edited or deleted since `base` is applied on top of
// the server copy, so neither side's new subjects or ticks get lost. Objects
// (profile, prefs, guide) are merged field by field the same way.
import { LIST_KEYS, normalize } from './ops.js'

const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b)

function mergeList(base = [], mine = [], theirs = []) {
  const baseById = new Map(base.map((x) => [x.id, x]))
  const mineById = new Map(mine.map((x) => [x.id, x]))
  const out = []
  const seen = new Set()
  for (const t of theirs) {
    seen.add(t.id)
    const b = baseById.get(t.id)
    const m = mineById.get(t.id)
    if (b && !m) continue // I deleted it
    if (m && b && !same(m, b)) out.push(m) // I edited it
    else if (m && !b) out.push(m) // both have it, I never saw a base: prefer mine
    else out.push(t)
  }
  for (const m of mine) {
    if (seen.has(m.id)) continue
    if (baseById.has(m.id)) continue // they deleted it and I did not touch it... unless I edited it
    out.push(m) // I added it
  }
  // An item they deleted that I edited since base comes back (edits win over deletes).
  for (const m of mine) {
    if (seen.has(m.id) || !baseById.has(m.id)) continue
    if (!same(m, baseById.get(m.id))) out.push(m)
  }
  return out
}

function mergeObject(base = {}, mine = {}, theirs = {}) {
  const out = { ...theirs }
  for (const k of Object.keys(mine)) if (!same(mine[k], base[k])) out[k] = mine[k]
  return out
}

export function mergeData(base, mine, theirs) {
  const b = normalize(base)
  const m = normalize(mine)
  const t = normalize(theirs)
  const out = {
    profile: mergeObject(b.profile, m.profile, t.profile),
    prefs: mergeObject(b.prefs, m.prefs, t.prefs),
    guide: mergeObject(b.guide, m.guide, t.guide),
  }
  for (const k of LIST_KEYS) out[k] = mergeList(b[k], m[k], t[k])
  return out
}

// What changed between two versions, for Yuuki's "your AI just added..." note.
export function diffAdded(before, after) {
  const added = {}
  for (const k of LIST_KEYS) {
    const had = new Set((before?.[k] || []).map((x) => x.id))
    const fresh = (after?.[k] || []).filter((x) => !had.has(x.id))
    if (fresh.length) added[k] = fresh
  }
  return added
}
