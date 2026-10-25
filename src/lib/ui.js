// Screen state that is not saved: which drawer is open, focus mode, palette.
import { create } from 'zustand'

export const useUI = create((set) => ({
  editor: null, // { type: 'assignment'|'exam'|'subject'|'block'|'log'|'focus', item?, defaults? }
  palette: false,
  focusOpen: false,
  navOpen: false,
  quiz: null, // { topicIds, title }
  openEditor: (type, item = null, defaults = {}) => set({ editor: { type, item, defaults }, palette: false }),
  closeEditor: () => set({ editor: null }),
  setPalette: (palette) => set({ palette }),
  setFocusOpen: (focusOpen) => set({ focusOpen }),
  setNavOpen: (navOpen) => set({ navOpen }),
  openQuiz: (topicIds, title) => set({ quiz: { topicIds, title, at: Date.now() }, palette: false }),
  closeQuiz: () => set({ quiz: null }),
}))

export const openEditor = (...args) => useUI.getState().openEditor(...args)
export const openQuiz = (...args) => useUI.getState().openQuiz(...args)
