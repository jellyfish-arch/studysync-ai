import { motion } from 'motion/react'
import { Pencil, Play } from './icons.jsx'
import SpringCheck from './rb/SpringCheck/SpringCheck.jsx'
import { Badge, Button, SubjectTag, celebrate, cn, sparkAt, useToast } from './ui.jsx'
import { colorOf, useStore } from '../lib/store.js'
import { useUI } from '../lib/ui.js'
import { addMinutesToTime, formatMinutes, formatTime, nowHHMM, todayISO } from '../lib/dates.js'
import { blocksOn } from '../lib/selectors.js'

export const checkProps = {
  color: 'var(--ink)',
  fillColor: 'var(--accent)',
  checkColor: '#000000',
  boxSize: 22,
  boxRadius: 7,
  fontSize: 15,
}

// Line sparks from the checkbox that was just ticked (it still has focus).
export function sparkFromFocus(color) {
  const el = document.activeElement
  sparkAt(el?.querySelector?.('.spring-check__box') || el, color)
}

export function useCompleteBlock() {
  const complete = useStore((s) => s.completeBlock)
  const reopen = useStore((s) => s.reopenBlock)
  const toast = useToast()
  return (block) => {
    if (block.done) {
      reopen(block.id)
      return
    }
    complete(block.id)
    const state = useStore.getState()
    const today = blocksOn(state, todayISO())
    const allDone = block.date === todayISO() && today.length && today.every((b) => b.done)
    if (allDone) celebrate()
    // Yuuki already says this when her remarks are on.
    if (!state.prefs.yuukiTips) toast(allDone ? 'Every block done today' : `Logged ${formatMinutes(block.minutes)} of study`)
  }
}

export function BlockRow({ block, showDate = false, index = 0 }) {
  const timer = useStore((s) => s.timer)
  const subject = useStore((s) => s.subjects.find((x) => x.id === block.subjectId))
  const start = useStore((s) => s.startTimer)
  const openEditor = useUI((s) => s.openEditor)
  const setFocusOpen = useUI((s) => s.setFocusOpen)
  const toggle = useCompleteBlock()
  const isToday = block.date === todayISO()
  const now = nowHHMM()
  const end = addMinutesToTime(block.start, block.minutes)
  const live = isToday && !block.done && block.start <= now && end > now
  const running = timer?.blockId === block.id

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'tint group relative flex items-center gap-3 rounded-2xl border p-3 pr-2 transition-colors sm:gap-4',
        live || running ? 'border-primary/40 bg-primary-soft/60' : 'border-line bg-surface hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--line-strong))]',
        block.done && 'opacity-75',
      )}
      style={{ '--c': colorOf(subject?.color), '--accent': colorOf(subject?.color) }}
    >
      <span className="sc-bg absolute top-3 bottom-3 left-0 w-1 rounded-r-full" />
      <div className="w-[4.6rem] shrink-0 pl-2">
        <p className={cn('num font-mono text-[0.8rem] font-semibold', live ? 'text-primary' : 'text-ink')}>{formatTime(block.start)}</p>
        <p className="num font-mono text-[0.7rem] text-muted">{formatMinutes(block.minutes)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <SpringCheck
          key={`${block.id}-${block.done}`}
          label={block.title}
          defaultChecked={block.done}
          onChange={(on) => {
            if (on) sparkFromFocus(colorOf(subject?.color))
            setTimeout(() => toggle(block), 420)
          }}
          className="block-check"
          {...checkProps}
        />
        <div className="mt-0.5 flex flex-wrap items-center gap-2 pl-[34px]">
          <SubjectTag subjectId={block.subjectId} short />
          {showDate && <span className="text-[0.72rem] text-muted">{block.date}</span>}
          {live && (
            <Badge tone="primary" dot>
              Now
            </Badge>
          )}
          {running && (
            <Badge tone="bad" dot>
              Timer running
            </Badge>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!block.done && !timer && (
          <Button
            variant={live ? 'primary' : 'soft'}
            size="sm"
            onClick={() => {
              start({ subjectId: block.subjectId, blockId: block.id, title: block.title, planned: block.minutes })
              setFocusOpen(true)
            }}
          >
            <Play /> <span className="hidden sm:inline">Start</span>
          </Button>
        )}
        <Button variant="ghost" size="icon" className="opacity-60 group-hover:opacity-100" onClick={() => openEditor('block', block)} aria-label={`Edit ${block.title}`}>
          <Pencil />
        </Button>
      </div>
    </motion.li>
  )
}
