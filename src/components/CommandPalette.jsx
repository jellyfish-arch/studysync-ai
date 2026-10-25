import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Clock,
  CornerDownLeft,
  GraduationCap,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  Timer,
} from './icons.jsx'
import { colorOf, useStore } from '../lib/store.js'
import { useUI } from '../lib/ui.js'
import { shortDate } from '../lib/dates.js'
import { cn, Kbd } from './ui.jsx'

import { PAGES } from '../lib/nav.js'

export default function CommandPalette() {
  const open = useUI((s) => s.palette)
  const setOpen = useUI((s) => s.setPalette)
  const openEditor = useUI((s) => s.openEditor)
  const navigate = useNavigate()
  const subjects = useStore((s) => s.subjects)
  const assignments = useStore((s) => s.assignments)
  const exams = useStore((s) => s.exams)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(!useUI.getState().palette)
      } else if (e.key === 'Escape' && useUI.getState().palette) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  useEffect(() => {
    if (open) {
      setQ('')
      setActive(0)
    }
  }, [open])

  const items = useMemo(() => {
    const go = (to) => () => navigate(to)
    const all = [
      { group: 'Actions', label: 'Start a focus session', icon: Timer, run: () => openEditor('focus') },
      { group: 'Actions', label: 'Log study time', icon: Clock, run: () => openEditor('log') },
      { group: 'Actions', label: 'New assignment', icon: Plus, run: () => openEditor('assignment') },
      { group: 'Actions', label: 'New exam', icon: Plus, run: () => openEditor('exam') },
      { group: 'Actions', label: 'Plan a study block', icon: Plus, run: () => openEditor('block') },
      { group: 'Actions', label: 'Add a subject', icon: Plus, run: () => openEditor('subject') },
      ...PAGES.map((p) => ({ group: 'Go to', label: p.label, icon: p.icon, run: go(p.to) })),
      ...subjects.map((s) => ({ group: 'Subjects', label: s.name, hint: s.code, color: colorOf(s.color), run: go(`/app/subjects/${s.id}`) })),
      ...exams.map((e) => ({
        group: 'Exams',
        label: `${subjects.find((s) => s.id === e.subjectId)?.name || ''}: ${e.title}`,
        hint: shortDate(e.date),
        icon: GraduationCap,
        run: () => openEditor('exam', e),
      })),
      ...assignments.map((a) => ({ group: 'Assignments', label: a.title, hint: a.due ? shortDate(a.due) : '', icon: ClipboardList, run: () => openEditor('assignment', a) })),
    ]
    const needle = q.trim().toLowerCase()
    if (!needle) return all.filter((i) => i.group === 'Actions' || i.group === 'Go to')
    // Plain substring matches first, then abbreviation-style matches where the
    // letters appear in order (so "dbms" finds "Database Management Systems").
    const text = (i) => `${i.label} ${i.hint || ''}`.toLowerCase()
    const inOrder = (hay) => {
      let k = 0
      for (const ch of hay) if (ch === needle[k]) k++
      return k === needle.length
    }
    const direct = all.filter((i) => `${text(i)} ${i.group}`.toLowerCase().includes(needle))
    const loose = all.filter((i) => !direct.includes(i) && needle.length >= 2 && inOrder(text(i)))
    return [...direct, ...loose].slice(0, 30)
  }, [q, subjects, exams, assignments, navigate, openEditor])

  const run = (item) => {
    setOpen(false)
    item.run()
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(items.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter' && items[active]) {
      e.preventDefault()
      run(items[active])
    } else if (e.key === 'Escape') setOpen(false)
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  let lastGroup = null
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[55] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
          <motion.div
            role="dialog"
            aria-label="Quick jump"
            initial={{ opacity: 0, y: -14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-line bg-surface shadow-float"
          >
            <div className="flex items-center gap-3 border-b border-line px-5">
              <Search className="size-5 text-muted" />
              <input
                autoFocus
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setActive(0)
                }}
                onKeyDown={onKeyDown}
                placeholder="Search subjects, exams, assignments, or type an action…"
                className="h-14 flex-1 bg-transparent text-[0.95rem] text-ink outline-none placeholder:text-muted"
                aria-label="Search"
              />
              <Kbd>Esc</Kbd>
            </div>
            <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
              {items.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted">Nothing matches “{q}”.</p>}
              {items.map((item, i) => {
                const header = item.group !== lastGroup
                lastGroup = item.group
                const Icon = item.icon
                return (
                  <div key={`${item.group}-${item.label}-${i}`}>
                    {header && <p className="px-3 pt-3 pb-1 text-[0.7rem] font-semibold tracking-wide text-muted">{item.group}</p>}
                    <button
                      data-i={i}
                      onMouseMove={() => setActive(i)}
                      onClick={() => run(item)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                        i === active ? 'bg-primary-soft text-primary-ink' : 'text-ink-2',
                      )}
                    >
                      {item.color ? (
                        <span className="grid size-7 place-items-center rounded-lg" style={{ background: `${item.color}22` }}>
                          <span className="size-2.5 rounded-full" style={{ background: item.color }} />
                        </span>
                      ) : (
                        <span className="grid size-7 place-items-center rounded-lg bg-surface-2">
                          <Icon className="size-4" />
                        </span>
                      )}
                      <span className="flex-1 truncate font-medium">{item.label}</span>
                      {item.hint && <span className="font-mono text-[0.72rem] text-muted">{item.hint}</span>}
                      {i === active && <CornerDownLeft className="size-4 opacity-60" />}
                    </button>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
