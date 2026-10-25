// Chat with Yuuki. Opens from her corner dock or Ctrl+J.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, AlertTriangle, Refresh, Send, Trash2, X } from '../components/icons.jsx'
import { cn, useToast } from '../components/ui.jsx'
import { useStore } from '../lib/store.js'
import { useSync } from '../lib/sync.js'
import { allowanceText, loadAccount, useAccount } from '../lib/account.js'
import { useUI } from '../lib/ui.js'
import { pose } from './poses.js'
import { useYuuki } from './state.js'
import { YuukiPose } from './Yuuki.jsx'
import { actionLabel, askAI, describeError, localAnswer } from './brain.js'

const chatKey = (u) => `studysync:chat:${u}`
const SUGGEST = ['What should I study now?', 'How ready am I for my next exam?', 'Plan my study for this week', "What's due soon?"]

function loadChat(user) {
  try {
    return JSON.parse(localStorage.getItem(chatKey(user)) || '[]')
  } catch {
    return []
  }
}

export default function Chat() {
  const open = useYuuki((s) => s.chatOpen)
  const close = useYuuki((s) => s.closeChat)
  const draft = useYuuki((s) => s.chatDraft)
  const user = useStore((s) => s.user)
  const health = useSync((s) => s.health)
  const aiOn = Boolean(health?.ai)
  const [messages, setMessages] = useState(() => (user ? loadChat(user) : []))
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const allowance = useAccount((s) => s.summary?.entitlements?.find((e) => e.id === 'yuuki.chat'))
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const snapshots = useRef(new Map())
  const toast = useToast()

  useEffect(() => setMessages(user ? loadChat(user) : []), [user])
  useEffect(() => {
    if (!user) return
    try {
      localStorage.setItem(chatKey(user), JSON.stringify(messages.slice(-40)))
    } catch {
      /* ignore */
    }
  }, [messages, user])
  useEffect(() => {
    if (open && aiOn) loadAccount()
  }, [open, aiOn])
  useEffect(() => {
    if (open) {
      if (draft) setText(draft)
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [open, draft])
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        const st = useYuuki.getState()
        st.chatOpen ? st.closeChat() : st.openChat()
      }
      if (e.key === 'Escape' && useYuuki.getState().chatOpen) close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  const name = (useStore.getState().profile.name || user || '').split(' ')[0]

  const send = async (raw) => {
    const q = (raw ?? text).trim()
    if (!q || busy) return
    setText('')
    const mine = { id: crypto.randomUUID(), role: 'user', text: q, at: Date.now() }
    const history = [...messages, mine]
    setMessages(history)
    if (!aiOn) {
      const a = localAnswer(q)
      setTimeout(() => setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'yuuki', text: a.text, quick: a.quick, at: Date.now() }]), 450)
      return
    }
    setBusy(true)
    try {
      const r = await askAI(history)
      const id = crypto.randomUUID()
      if (r.before) snapshots.current.set(id, r.before)
      setMessages((m) => [...m, { id, role: 'yuuki', text: r.text, actions: r.actions.map((a) => ({ ...actionLabel(a), name: a.name })).filter((a) => a.name && !a.name.startsWith('get_') && !a.name.startsWith('list_')), at: Date.now(), undoable: Boolean(r.before) }])
    } catch (e) {
      // Out of AI messages for today: say so, then answer with the built-in guide.
      const local = e.status === 402 ? localAnswer(q) : null
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: 'yuuki', text: describeError(e), error: true, at: Date.now(), quick: local?.fallback ? local.quick : undefined },
        ...(local && !local.fallback ? [{ id: crypto.randomUUID(), role: 'yuuki', text: local.text, quick: local.quick, at: Date.now() }] : []),
      ])
    } finally {
      setBusy(false)
      if (aiOn) loadAccount()
    }
  }

  const undo = (id) => {
    const before = snapshots.current.get(id)
    if (!before) return
    useStore.getState().replaceAll(before)
    snapshots.current.delete(id)
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, undoable: false, undone: true } : x)))
    toast("Undid Yuuki's changes")
  }

  const quick = (k) => {
    const ui = useUI.getState()
    if (k === 'tour') {
      useStore.getState().updateGuide({ tourDone: false, tour: 1 })
      close()
      return
    }
    const map = { subject: 'subject', exam: 'exam', assignment: 'assignment', plan: 'block', focus: 'focus' }
    close()
    ui.openEditor(map[k] || 'subject')
  }
  const QUICK = { subject: 'Add a subject', exam: 'Add an exam', assignment: 'Add an assignment', plan: 'Plan a block', focus: 'Start focusing', tour: 'Replay the tour' }

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          role="dialog"
          aria-label="Chat with Yuuki"
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.15 } }}
          transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          className="tint fixed inset-x-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-[70] flex h-[min(40rem,calc(100dvh-1rem-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] flex-col overflow-hidden rounded-3xl border border-line-strong bg-surface shadow-float sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[26rem]"
          style={{ '--accent': 'var(--mint)' }}
        >
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            <img src={pose('avatar')} alt="" className="size-11 rounded-full border border-line-strong bg-surface-2 object-cover object-top" />
            <div className="min-w-0 flex-1">
              <p className="font-display font-bold text-ink">Yuuki</p>
              <p className="flex items-center gap-1.5 truncate text-[0.72rem] text-muted">
                <span className={cn('size-1.5 rounded-full', aiOn ? 'bg-mint' : 'bg-warning')} />
                {aiOn ? 'Online' : 'Guide mode'}
                {aiOn && allowance?.included && <span className="text-muted/80"> · {allowanceText(allowance)}</span>}
              </p>
            </div>
            {messages.length > 0 && (
              <button type="button" onClick={() => setMessages([])} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink" aria-label="Clear chat" title="Clear chat">
                <Trash2 className="size-4" />
              </button>
            )}
            <button type="button" onClick={close} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink" aria-label="Close chat">
              <X className="size-4" />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center pt-2 text-center">
                <YuukiPose name="wave" className="w-28" />
                <p className="mt-3 max-w-[18rem] text-sm text-ink-2">
                  Hi {name}! Ask me what to study, how ready you are, or tell me to add things.{aiOn ? ' I can plan your whole week too.' : ''}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {SUGGEST.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-line-strong px-3 py-1.5 text-[0.78rem] text-ink-2 transition-colors hover:border-mint/60 hover:text-ink">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn('flex gap-2', m.role === 'user' && 'justify-end')}>
                {m.role !== 'user' && <img src={pose(m.error ? 'oops' : 'avatar')} alt="" className="mt-0.5 size-7 shrink-0 rounded-full bg-surface-2 object-cover object-top" />}
                <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[0.88rem] leading-relaxed whitespace-pre-wrap', m.role === 'user' ? 'rounded-br-md bg-ink text-black' : 'rounded-bl-md border border-line bg-surface-2 text-ink')}>
                  {m.text}
                  {m.actions?.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {m.actions.map((a, i) => (
                        <li key={i} className={cn('flex items-center gap-1.5 text-[0.75rem] font-semibold', a.error ? 'text-danger' : 'text-mint')}>
                          {a.error ? <AlertTriangle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />} {a.text}
                        </li>
                      ))}
                    </ul>
                  )}
                  {m.undoable && (
                    <button type="button" onClick={() => undo(m.id)} className="mt-2 inline-flex items-center gap-1 text-[0.75rem] font-semibold text-muted underline-offset-2 hover:text-ink hover:underline">
                      <Refresh className="size-3.5" /> Undo these changes
                    </button>
                  )}
                  {m.undone && <p className="mt-2 text-[0.72rem] text-muted">Changes undone.</p>}
                  {m.quick?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.quick.map((k) => (
                        <button key={k} type="button" onClick={() => quick(k)} className="rounded-lg border border-line-strong px-2.5 py-1 text-[0.75rem] font-semibold text-ink-2 hover:border-mint/60 hover:text-ink">
                          {QUICK[k]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-sm text-muted">
                <YuukiPose name="think" className="w-12" bob={false} />
                <span className="flex gap-1" aria-label="Yuuki is thinking">
                  {[0, 1, 2].map((i) => (
                    <motion.span key={i} className="size-1.5 rounded-full bg-mint" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />
                  ))}
                </span>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
            className="flex items-end gap-2 border-t border-line p-3"
          >
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              rows={1}
              placeholder={aiOn ? 'Ask Yuuki, or tell her what to add...' : 'Ask Yuuki...'}
              className="input max-h-32 min-h-11 resize-none py-2.5"
              maxLength={2000}
              aria-label="Message to Yuuki"
            />
            <button type="submit" disabled={!text.trim() || busy} className="draw grid size-11 shrink-0 place-items-center rounded-xl bg-mint text-black transition-opacity disabled:opacity-40" aria-label="Send">
              <Send className="size-5" />
            </button>
          </form>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
