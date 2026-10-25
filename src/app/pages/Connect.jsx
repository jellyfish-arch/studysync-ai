// Connect AI: let Claude (Desktop or Code) read and update this StudySync
// account through MCP. Two steps for students: choose the app and what it may
// do, then copy one thing and restart it. The page turns green by itself when
// the app first connects. On a computer the apps start server/stdio.js; on
// the online version they reach /mcp over the internet. Details: docs/mcp.md.
import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, ArrowRight, Check, CheckCircle2, ChevronDown, CloudOff, Copy, Eye, Key, Lock, Pencil, Plug, Trash2 } from '../../components/icons.jsx'
import { Badge, Button, Card, CardHeader, Empty, PageHeader, cn, useToast } from '../../components/ui.jsx'
import { api, serverHealth } from '../../lib/api.js'
import { useSync } from '../../lib/sync.js'
import { YuukiPose } from '../../yuuki/Yuuki.jsx'

/* ---------- the apps ---------- */
const CLIENTS = [
  {
    id: 'claude-desktop',
    name: 'Claude Desktop',
    blurb: 'The Claude app for Windows and Mac.',
    how: 'config',
    open: 'In Claude Desktop, open Settings → Developer → Edit Config. Open that file in Notepad.',
    paste: 'Replace everything in it with this, then save. (Already have other servers? Add only the "studysync" part.)',
    restart: 'Quit Claude completely (right-click its icon near the clock → Quit), then open it again.',
    remove: 'Also delete the "studysync" part from the Claude config file.',
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    blurb: 'Claude in your terminal or code editor.',
    how: 'command',
    paste: 'Paste this into a terminal and press Enter.',
    restart: 'Start a new Claude Code session.',
    remove: 'Also run: claude mcp remove studysync',
  },
]

const SCOPE_INFO = {
  read: { title: 'Read only', icon: Eye, summary: 'Sees your semester and plans. Changes nothing.' },
  write: { title: 'Read and add', icon: Pencil, summary: 'Also adds and edits things, and drafts plans you approve. Never deletes.' },
  full: { title: 'Full access', icon: Key, summary: 'Also deletes things when you ask it to.' },
}

const ago = (iso) => {
  if (!iso) return 'never'
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} days ago`
}

/* ---------- copy box (hides the key until asked) ---------- */
function CopyBox({ text, label, secret }) {
  const toast = useToast()
  const [shown, setShown] = useState(!secret)
  return (
    <div className="relative">
      <pre className={cn('overflow-x-auto rounded-xl border border-line bg-black p-3 pt-11 font-mono text-[0.74rem] leading-relaxed text-ink-2 sm:pt-3 sm:pr-28', !shown && 'blur-[3px] select-none')}>{text}</pre>
      <div className="absolute top-2 right-2 flex gap-1">
        {secret && (
          <button type="button" onClick={() => setShown(!shown)} className="h-8 rounded-lg border border-line-strong bg-surface px-2.5 text-[0.75rem] font-semibold text-muted hover:text-ink">
            {shown ? 'Hide' : 'Show'}
          </button>
        )}
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text)
              toast(`${label} copied`)
            } catch {
              toast('Could not copy. Press Show, then select the text.')
            }
          }}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 text-[0.75rem] font-semibold text-ink-2 hover:text-ink"
        >
          <Copy className="size-3.5" /> Copy
        </button>
      </div>
    </div>
  )
}

// Online, Claude Desktop reaches the URL through mcp-remote (it can't send a
// key header itself). The header is passed via env so Windows keeps the space.
const configJson = (mcp, key) =>
  JSON.stringify(
    mcp.hosted
      ? { mcpServers: { studysync: { command: 'npx', args: ['-y', 'mcp-remote', mcp.url, '--header', 'Authorization:${AUTH_HEADER}'], env: { AUTH_HEADER: `Bearer ${key}` } } } }
      : { mcpServers: { studysync: { command: 'node', args: [mcp.script], env: { STUDYSYNC_KEY: key } } } },
    null,
    2,
  )

const command = (mcp, key) => (mcp.hosted ? `claude mcp add --transport http studysync ${mcp.url} --header "Authorization: Bearer ${key}"` : `claude mcp add --env STUDYSYNC_KEY=${key} --transport stdio studysync -- node "${mcp.script}"`)

function Steps({ client, mcp, keyText }) {
  const steps =
    client.how === 'config'
      ? [{ text: client.open }, { text: client.paste, copy: { text: configJson(mcp, keyText), label: 'Setup', secret: true } }, { text: client.restart }]
      : [{ text: client.paste, copy: { text: command(mcp, keyText), label: 'Command', secret: true } }, { text: client.restart }]
  return (
    <ol className="space-y-4">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line-strong font-display text-sm font-bold text-ink">{i + 1}</span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm text-ink">{s.text}</p>
            {s.copy && (
              <div className="mt-2">
                <CopyBox {...s.copy} />
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

/* ---------- the two steps ---------- */
function Wizard({ health, connections, onCreated, reload }) {
  const [client, setClient] = useState(null)
  const [scope, setScope] = useState('write')
  const [created, setCreated] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const live = created && connections.find((c) => c.id === created.connection.id)
  const connected = live?.status === 'connected'

  const reset = () => {
    setClient(null)
    setCreated(null)
    setError(null)
  }

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      const out = await api('/connections', { method: 'POST', body: { name: client.name, client: client.id, scope } })
      setCreated(out)
      onCreated()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  // Waiting for the app: check every few seconds until it connects.
  useEffect(() => {
    if (!created || connected) return
    const id = setInterval(reload, 3000)
    return () => clearInterval(id)
  }, [created, connected, reload])

  return (
    <Card accent="var(--teal)" className="p-5 sm:p-6" id="connect-wizard">
      <CardHeader title="Connect an app" icon={Plug} sub={created ? 'Step 2 of 2: add it to the app' : 'Step 1 of 2: choose the app'} action={(client || created) && <Button variant="ghost" size="sm" onClick={reset}>Start over</Button>} />

      <AnimatePresence mode="wait">
        {!created ? (
          <motion.div key="choose" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-5 space-y-5">
            <div className="grid gap-2 sm:grid-cols-3">
              {CLIENTS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setClient(c)}
                  aria-pressed={client?.id === c.id}
                  className={cn('flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors', client?.id === c.id ? 'border-[color-mix(in_srgb,var(--accent)_65%,transparent)] bg-[color-mix(in_srgb,var(--accent)_7%,transparent)]' : 'border-line hover:border-line-strong')}
                >
                  <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border', client?.id === c.id ? 'border-[var(--accent)] bg-[var(--accent)] text-black' : 'border-line-strong')}>{client?.id === c.id && <Check className="size-3.5" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">{c.name}</span>
                    <span className="block text-[0.8rem] text-muted">{c.blurb}</span>
                  </span>
                </button>
              ))}
              <div className="flex items-start gap-3 rounded-2xl border border-dashed border-line-strong p-4" aria-disabled="true">
                <CloudOff className="mt-0.5 size-5 shrink-0 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-semibold text-ink-2">
                    ChatGPT <Badge>Not yet</Badge>
                  </span>
                  <span className="block text-[0.8rem] text-muted">{health?.mcp?.hosted ? 'ChatGPT needs its own app sign-in, which comes in a later version.' : 'ChatGPT only connects to apps on the internet. It comes with the online version of StudySync.'}</span>
                </span>
              </div>
            </div>

            {client && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div>
                  <p className="mb-2 text-sm font-semibold text-ink">What may {client.name} do?</p>
                  <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Permission">
                    {['read', 'write', 'full'].map((s) => {
                      const I = SCOPE_INFO[s].icon
                      const on = scope === s
                      return (
                        <button key={s} type="button" role="radio" aria-checked={on} onClick={() => setScope(s)} className={cn('rounded-2xl border p-3.5 text-left transition-colors', on ? 'border-[color-mix(in_srgb,var(--accent)_65%,transparent)] bg-[color-mix(in_srgb,var(--accent)_7%,transparent)]' : 'border-line hover:border-line-strong')}>
                          <span className="flex items-center gap-2 font-semibold text-ink">
                            <I className="size-4 text-[var(--accent)]" /> {SCOPE_INFO[s].title}
                            {s === 'write' && <span className="text-[0.7rem] font-semibold text-muted">recommended</span>}
                          </span>
                          <span className="mt-1 block text-[0.78rem] text-muted">{SCOPE_INFO[s].summary}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                {error && <p className="text-sm text-danger">{error}</p>}
                <Button variant="primary" onClick={create} disabled={busy || !health}>
                  <Key /> {busy ? 'Creating…' : 'Create my connection'}
                </Button>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div key="add" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-5 space-y-5">
            <p className="flex items-start gap-2 rounded-xl border border-[color-mix(in_srgb,var(--warning)_40%,transparent)] p-3 text-[0.82rem] text-ink-2">
              <Lock className="mt-0.5 size-4 shrink-0 text-warning" />
              <span>
                This contains your private key and is <b className="text-ink">shown only once</b>. Don't share it.
              </span>
            </p>
            <Steps client={client} mcp={health.mcp} keyText={created.key} />
            <div className={cn('flex items-center gap-3 rounded-2xl border p-4', connected ? 'border-[color-mix(in_srgb,var(--mint)_45%,transparent)]' : 'border-line')} aria-live="polite">
              {connected ? (
                <>
                  <YuukiPose name="jump" className="w-14 shrink-0" />
                  <div>
                    <p className="font-semibold text-mint">Connected!</p>
                    <p className="text-sm text-ink-2">Try asking {client.name}: "What's on my StudySync this week?"</p>
                  </div>
                </>
              ) : (
                <>
                  <span className="live-dot size-2.5 shrink-0 rounded-full bg-warning" />
                  <p className="text-sm text-ink-2">Waiting for {client.name}… This turns green by itself once it connects.</p>
                </>
              )}
            </div>
            <Button variant="outline" onClick={reset}>
              Done
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

/* ---------- connected apps ---------- */
const STATUS = {
  connected: { label: 'Connected', tone: 'good', dot: true },
  idle: { label: 'Not active now', tone: 'neutral' },
  waiting: { label: 'Waiting for the app', tone: 'warn' },
}

function Connections({ list, onRevoke, loading }) {
  const [confirm, setConfirm] = useState(null)
  if (loading && !list.length) return <p className="text-sm text-muted">Loading…</p>
  if (!list.length) return <Empty compact pose="present" title="No apps connected yet" text="Connect Claude above. It takes about a minute." />
  return (
    <ul className="space-y-2">
      {list.map((c) => {
        const s = STATUS[c.status] || STATUS.idle
        const client = CLIENTS.find((x) => x.id === c.client)
        return (
          <motion.li layout key={c.id} className="rounded-2xl border border-line p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                  {c.name}
                  <Badge tone={s.tone} dot={s.dot}>
                    {s.label}
                  </Badge>
                </p>
                <p className="mt-0.5 text-[0.78rem] text-muted">
                  {SCOPE_INFO[c.scope]?.title} · last used {ago(c.lastUsed)}
                </p>
              </div>
              {confirm === c.id ? (
                <span className="flex items-center gap-2">
                  <Button variant="danger" size="sm" onClick={() => onRevoke(c)}>
                    Disconnect
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>
                    Keep
                  </Button>
                </span>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setConfirm(c.id)} aria-label={`Disconnect ${c.name}`}>
                  <Trash2 /> Disconnect
                </Button>
              )}
            </div>
            {confirm === c.id && <p className="mt-3 text-[0.8rem] text-muted">It stops working at once. {client?.remove || ''}</p>}
          </motion.li>
        )
      })}
    </ul>
  )
}

const TROUBLE = [
  ['It keeps saying "Waiting"', 'Make sure StudySync is open in your browser, and that you fully quit and reopened Claude after saving. Closing the window is not enough.'],
  ['Claude says StudySync is not connected', 'The setup was pasted wrong, or the connection was removed. Press Start over and create a new one.'],
  ['"node" or "npx" is not recognized', 'Install Node.js from nodejs.org, then restart Claude.'],
  ['Claude says it needs Plus', 'Reading and adding things work on Free. Drafting and repairing mission plans from Claude is part of Plus.'],
]

function Fold({ title, children, icon: Icon }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl border border-line">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left font-semibold text-ink">
        {Icon && <Icon className="size-4 text-[var(--accent)]" />}
        {title}
        <motion.span className="ml-auto" animate={{ rotate: open ? 180 : 0 }}>
          <ChevronDown className="size-4 text-muted" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="border-t border-line px-4 py-4 text-sm text-ink-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ---------- page ---------- */
export default function Connect() {
  const health = useSync((s) => s.health)
  const status = useSync((s) => s.status)
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const toast = useToast()

  const reload = useCallback(async () => {
    try {
      const out = await api('/connections')
      setList(out.connections)
      setError(null)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    serverHealth(true).then((h) => useSync.setState({ health: h }))
    reload()
    const id = setInterval(reload, 15000)
    return () => clearInterval(id)
  }, [reload])

  const revoke = async (c) => {
    try {
      await api(`/connections/${c.id}`, { method: 'DELETE' })
      toast(`${c.name} disconnected`)
      reload()
    } catch (e) {
      toast(e.message)
    }
  }

  const offline = !health
  const signedOut = health && (status === 'signed-out' || error?.status === 401)

  return (
    <>
      <PageHeader eyebrowIcon={Plug} title="Connect AI" sub="Let Claude read your semester and plan with you. You choose what it may change, and you can disconnect it any time." />

      <div className="mx-auto max-w-4xl space-y-5">
        {offline ? (
          <Card accent="var(--warning)" className="p-6">
            <div className="flex flex-wrap items-center gap-4">
              <YuukiPose name="oops" className="w-20" />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-bold text-ink">Connections aren't available right now</h2>
                <p className="mt-1 text-sm text-ink-2">Claude talks to StudySync through StudySync's server, which isn't running. Start StudySync again, then reload this page.</p>
              </div>
            </div>
          </Card>
        ) : signedOut ? (
          <Card accent="var(--warning)" className="p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
              <AlertTriangle className="size-5 text-warning" /> Log in again to manage connections
            </h2>
            <p className="mt-1 text-sm text-ink-2">Log out from Profile and log back in.</p>
          </Card>
        ) : (
          <>
            <Wizard health={health} connections={list} onCreated={reload} reload={reload} />
            <Card accent="var(--mint)" className="p-5 sm:p-6">
              <CardHeader title="Connected apps" icon={CheckCircle2} />
              <div className="mt-4">
                <Connections list={list} onRevoke={revoke} loading={loading} />
              </div>
            </Card>
          </>
        )}

        <Card accent="var(--rose)" className="p-5 sm:p-6">
          <CardHeader title="Good to know" icon={ArrowRight} />
          <ul className="mt-3 space-y-2 text-sm text-ink-2">
            <li>Claude sees your subjects, exams, assignments and study time, never your password.</li>
            <li>Anything it adds shows up here within a second.</li>
            <li>Plans it drafts reach your calendar only after you approve them.</li>
          </ul>
        </Card>

        <Fold title="Not working?" icon={AlertTriangle}>
          <dl className="space-y-3">
            {TROUBLE.map(([q, a]) => (
              <div key={q}>
                <dt className="font-semibold text-ink">{q}</dt>
                <dd className="mt-0.5">{a}</dd>
              </div>
            ))}
          </dl>
        </Fold>
      </div>
    </>
  )
}
