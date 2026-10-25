import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, Eye, EyeOff, Lock, User } from '../components/icons.jsx'
import Logo from '../components/Logo.jsx'
import { cn } from '../components/ui.jsx'
import { Typewriter, YuukiPose } from '../yuuki/Yuuki.jsx'
import { normalizeUsername, verifyPassword } from '../lib/accounts.js'
import { getSession, setSession } from '../lib/session.js'
import { api } from '../lib/api.js'
import { useStore } from '../lib/store.js'

const LINES = {
  hello: { pose: 'wave', text: "Hi, I'm Yuuki! Log in and let's get your semester sorted." },
  bye: { pose: 'wave', text: 'See you soon! Your stuff is saved, I promise.' },
  user: { pose: 'think', text: 'Your username, please. The one you were given for StudySync.' },
  pass: { pose: 'read', text: "Type your password. I'm reading my book, totally not peeking." },
  wrong: { pose: 'oops', text: "Hmm, that username and password don't match. Try again? Check Caps Lock too." },
  busy: { pose: 'think', text: 'Checking...' },
  ok: { pose: 'jump', text: 'Yay, that is you! Come on in.' },
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const next = params.get('next')?.startsWith('/app') ? params.get('next') : '/app'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [show, setShow] = useState(false)
  const [say, setSay] = useState(location.state?.bye ? 'bye' : 'hello')
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(0)

  useEffect(() => {
    if (getSession()) navigate(next, { replace: true })
  }, [navigate, next])

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    const u = normalizeUsername(username)
    if (!u || !password) return setSay(!u ? 'user' : 'pass')
    setBusy(true)
    setSay('busy')
    const ok = await verifyPassword(u, password)
    if (!ok) {
      setBusy(false)
      setSay('wrong')
      setShake((n) => n + 1)
      setPassword('')
      return
    }
    // If the StudySync server is running, also get a token for sync and AI.
    let token = null
    try {
      token = (await api('/login', { method: 'POST', body: { username: u, password }, auth: false, timeout: 4000 })).token
    } catch {
      /* no server: the app works on this device only */
    }
    setSession(u, { remember, token })
    useStore.getState().login(u)
    setSay('ok')
    setTimeout(() => navigate(next, { replace: true }), 750)
  }

  const line = LINES[say]

  return (
    <div className="tint relative min-h-dvh overflow-hidden bg-black text-ink" style={{ '--accent': 'var(--mint)' }}>
      <div className="dots pointer-events-none absolute inset-0 opacity-50" />
      <header className="relative z-10 mx-auto flex h-18 max-w-6xl items-center px-5 sm:px-8">
        <Logo />
        <Link to="/" className="ml-auto text-sm font-semibold text-muted hover:text-ink">
          Back to home
        </Link>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100dvh-4.5rem)] max-w-6xl items-center gap-6 px-5 pb-10 sm:px-8 lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-16">
        <section className="flex flex-col items-center lg:items-start">
          <div className="relative mb-4 w-full max-w-md rounded-2xl border border-line-strong bg-surface-2 p-4 lg:mb-6 lg:ml-24 lg:p-5">
            <span className="bubble-tail" style={{ left: 46, bottom: -8, borderLeft: 'none', borderTop: 'none' }} />
            <p className="mb-1 text-[0.72rem] font-bold tracking-wide text-mint">Yuuki</p>
            <p className="min-h-[3em] text-[1rem] leading-relaxed lg:text-[1.1rem]">
              <Typewriter key={say} text={line.text} />
            </p>
          </div>
          <div className="w-36 sm:w-44 lg:w-64">
            <YuukiPose name={line.pose} alt="Yuuki" className="w-full drop-shadow-[0_24px_40px_rgba(0,0,0,0.8)]" />
          </div>
        </section>

        <motion.form
          key={shake}
          onSubmit={submit}
          animate={shake ? { x: [0, -10, 9, -6, 4, 0] } : { opacity: 1, y: 0 }}
          initial={shake ? false : { opacity: 0, y: 16 }}
          transition={shake ? { duration: 0.4 } : { duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full rounded-3xl border border-line-strong bg-surface p-6 shadow-float sm:p-8"
          noValidate
        >
          <h1 className="font-display text-3xl font-bold">Log in</h1>
          <p className="mt-1 text-sm text-muted">Use the account you were given for this demo.</p>

          <label className="mt-6 block">
            <span className="field-label">Username</span>
            <span className="relative block">
              <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                className="input pl-9"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => say !== 'wrong' && setSay('user')}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                maxLength={24}
              />
            </span>
          </label>

          <label className="mt-4 block">
            <span className="field-label">Password</span>
            <span className="relative block">
              <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                className="input pr-11 pl-9"
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setSay('pass')}
                autoComplete="current-password"
                maxLength={128}
              />
              <button type="button" onClick={() => setShow(!show)} className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
          </label>

          <label className="mt-4 flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-[var(--mint)]" />
            Keep me logged in on this device
          </label>

          <button type="submit" disabled={busy} className={cn('draw mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-base font-bold text-black transition-colors hover:bg-white disabled:opacity-60')}>
            {busy ? 'Checking...' : 'Log in'} {!busy && <ArrowRight className="size-5" />}
          </button>

          <p className="mt-5 text-center text-[0.8rem] text-muted">No sign-ups in this version. Ask the project team for an account.</p>
        </motion.form>
      </main>
    </div>
  )
}
