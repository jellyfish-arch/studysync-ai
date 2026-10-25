// What Yuuki is doing on screen right now. Not saved.
import { create } from 'zustand'
import { blip } from '../lib/sound.js'

let nextId = 1
let hideTimer = null

export const useYuuki = create((set, get) => ({
  // { id, pose, text, title, actions, anchor, sticky, tone, input }
  bubble: null,
  chatOpen: false,
  chatDraft: '',
  lastSaid: 0,

  // say({ text, pose, actions, anchor, sticky, duration })
  // Sticky bubbles (the tour) stay until replaced; others fade on their own.
  // A passing remark never interrupts the tour or a bubble that just appeared.
  say(msg) {
    const cur = get().bubble
    const now = Date.now()
    if (!msg.sticky && !msg.force) {
      if (cur?.sticky) return
      if (cur && now - get().lastSaid < 1800) return
    }
    clearTimeout(hideTimer)
    const bubble = { id: nextId++, pose: 'wave', actions: [], ...msg }
    set({ bubble, lastSaid: now })
    blip('pop')
    if (!bubble.sticky) {
      const ms = msg.duration || Math.min(14000, 4500 + bubble.text.length * 45)
      hideTimer = setTimeout(() => {
        if (get().bubble?.id === bubble.id) set({ bubble: null })
      }, ms)
    }
    return bubble.id
  },

  // Keep a fading bubble on screen while the pointer is over it.
  hold() {
    clearTimeout(hideTimer)
  },
  release() {
    const b = get().bubble
    if (!b || b.sticky) return
    clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      if (get().bubble?.id === b.id) set({ bubble: null })
    }, 2500)
  },

  hush(id) {
    if (id && get().bubble?.id !== id) return
    clearTimeout(hideTimer)
    set({ bubble: null })
  },

  openChat(draft = '') {
    set({ chatOpen: true, chatDraft: draft, bubble: get().bubble?.sticky ? get().bubble : null })
  },
  closeChat() {
    set({ chatOpen: false })
  },
}))

export const say = (msg) => useYuuki.getState().say(msg)
export const hush = (id) => useYuuki.getState().hush(id)

// Pick one line at random and fill {placeholders}.
export function line(options, vars = {}) {
  const list = Array.isArray(options) ? options : [options]
  const s = list[Math.floor(Math.random() * list.length)]
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '').toString())
}
