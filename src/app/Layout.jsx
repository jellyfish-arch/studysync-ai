import { Suspense, useEffect } from 'react'
import { Link, NavLink, useLocation, useOutlet } from 'react-router-dom'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { BookOpen, ClipboardList, Clock, GraduationCap, LayoutDashboard, Menu, Plus, Search, Timer, X } from '../components/icons.jsx'
import { colorOf, useStore } from '../lib/store.js'
import { useUI } from '../lib/ui.js'
import { useSync } from '../lib/sync.js'
import { blocksOn, openAssignments, overdue, upcomingExams } from '../lib/selectors.js'
import { daysBetween, longToday, todayISO } from '../lib/dates.js'
import { PAGES, pageFor } from '../lib/nav.js'
import CommandPalette from '../components/CommandPalette.jsx'
import Editors from '../components/editors.jsx'
import FocusMode, { TimerPill } from '../components/FocusMode.jsx'
import { Button, Kbd, ToastProvider, cn } from '../components/ui.jsx'
import Logo from '../components/Logo.jsx'
import { pose } from '../yuuki/poses.js'
import { YuukiBubble, YuukiDock } from '../yuuki/Yuuki.jsx'
import Director from '../yuuki/Director.jsx'
import Intro from '../yuuki/Intro.jsx'
import Chat from '../yuuki/Chat.jsx'
import { QuizDrawer } from '../components/quiz.jsx'

const GROUPS = [
  { title: 'Workspace', items: ['Overview', 'Today', 'Planner', 'Mission Planner', 'Calendar'] },
  { title: 'Academics', items: ['Subjects', 'Assignments', 'Exams'] },
  { title: 'You', items: ['Analytics', 'Connect AI', 'Profile', 'Settings'] },
]
const byLabel = Object.fromEntries(PAGES.map((p) => [p.label, p]))

function useBadges() {
  const blocks = useStore((s) => s.blocks)
  const assignments = useStore((s) => s.assignments)
  const exams = useStore((s) => s.exams)
  const today = todayISO()
  const todays = blocksOn({ blocks }, today)
  const next = upcomingExams({ exams }, today)[0]
  const days = next ? daysBetween(today, next.date) : null
  const open = openAssignments({ assignments }).length
  return {
    Today: todays.length ? { text: `${todays.filter((b) => b.done).length}/${todays.length}` } : null,
    Assignments: open ? { text: open, tone: overdue({ assignments }, today).length ? 'bad' : null } : null,
    Exams: next ? { text: days === 0 ? 'Today' : `${days}d`, tone: days <= 3 ? 'bad' : null } : null,
  }
}

export function Avatar({ size = 'size-9', className }) {
  const profile = useStore((s) => s.profile)
  const user = useStore((s) => s.user)
  const initials = (profile.name || user || 'You').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  if (profile.avatar === 'yuuki') {
    return <img src={pose('avatar')} alt="" className={cn(size, 'shrink-0 rounded-xl border border-line-strong bg-surface-2 object-cover object-top', className)} />
  }
  const c = colorOf(profile.avatarColor || 'mint')
  return (
    <span className={cn(size, 'grid shrink-0 place-items-center rounded-xl border font-display text-sm font-bold', className)} style={{ color: c, borderColor: `color-mix(in srgb, ${c} 45%, transparent)`, background: `color-mix(in srgb, ${c} 10%, #000)` }}>
      {initials}
    </span>
  )
}

const SYNC = {
  synced: ['Synced', 'bg-mint'],
  saving: ['Saving', 'bg-teal'],
  connecting: ['Connecting', 'bg-teal'],
  local: ['Saved on this device', 'bg-muted'],
  offline: ['Offline, saved here', 'bg-warning'],
  'signed-out': ['Sync paused', 'bg-warning'],
}
export function SyncBadge({ className }) {
  const status = useSync((s) => s.status)
  const error = useSync((s) => s.error)
  const [text, dot] = SYNC[status] || SYNC.local
  return (
    <span className={cn('flex items-center gap-1.5 text-[0.72rem] text-muted', className)} title={error || (status === 'synced' ? 'Synced with the StudySync server. AI tools see the same data.' : undefined)}>
      <span className={cn('size-1.5 rounded-full', dot, status === 'saving' && 'animate-pulse')} />
      {text}
    </span>
  )
}

function SideNav({ onNavigate }) {
  const badges = useBadges()
  const profile = useStore((s) => s.profile)
  const user = useStore((s) => s.user)
  const setPalette = useUI((s) => s.setPalette)
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5 pb-4">
        <Logo to="/app" />
        <p className="mt-1.5 truncate pl-[2.6rem] text-[0.75rem] text-muted">{[profile.semester, profile.course].filter(Boolean).join(' · ') || 'Your semester'}</p>
      </div>
      <div className="px-3">
        <button
          onClick={() => setPalette(true)}
          className="draw flex w-full items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-muted transition-colors hover:border-line-strong hover:text-ink"
        >
          <Search className="size-4" /> Quick jump
          <span className="ml-auto">
            <Kbd>Ctrl K</Kbd>
          </span>
        </button>
      </div>
      <LayoutGroup id="sidenav">
        <nav className="mt-3 flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="App">
          {GROUPS.map((g, gi) => (
            <motion.div key={g.title} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 + gi * 0.1 } } }}>
              <p className="px-3 pb-1.5 text-[0.7rem] font-semibold tracking-wide text-muted">{g.title}</p>
              {g.items.map((label) => {
                const { to, icon: Icon, color } = byLabel[label]
                const badge = badges[label]
                return (
                  <motion.div key={to} variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } } }}>
                    <NavLink to={to} end={to === '/app'} onClick={onNavigate} className="draw group relative block" style={{ '--c': color }}>
                      {({ isActive }) => (
                        <span className={cn('relative flex items-center gap-3 rounded-xl px-3 py-2 text-[0.9rem] font-medium transition-colors', isActive ? 'text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')}>
                          {isActive && (
                            <motion.span
                              layoutId="nav-active"
                              className="absolute inset-0 rounded-xl border border-[color-mix(in_srgb,var(--c)_30%,transparent)] bg-[color-mix(in_srgb,var(--c)_10%,#000)]"
                              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                            />
                          )}
                          <Icon className="relative size-[1.2rem] transition-opacity" style={{ color, opacity: isActive ? 1 : 0.8 }} />
                          <span className="relative">{label}</span>
                          {badge && (
                            <span className={cn('relative ml-auto rounded-md px-1.5 py-0.5 font-mono text-[0.68rem] font-semibold', badge.tone === 'bad' ? 'bg-danger-soft text-danger' : 'bg-surface-3 text-ink-2')}>
                              {badge.text}
                            </span>
                          )}
                        </span>
                      )}
                    </NavLink>
                  </motion.div>
                )
              })}
            </motion.div>
          ))}
        </nav>
      </LayoutGroup>
      <div className="border-t border-line p-3">
        <Link to="/app/profile" onClick={onNavigate} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-surface-2">
          <Avatar />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">{profile.name || user}</span>
            <SyncBadge />
          </span>
        </Link>
      </div>
    </div>
  )
}

function TopBar() {
  const openEditor = useUI((s) => s.openEditor)
  const setPalette = useUI((s) => s.setPalette)
  const setNavOpen = useUI((s) => s.setNavOpen)
  const setFocusOpen = useUI((s) => s.setFocusOpen)
  const timer = useStore((s) => s.timer)
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setNavOpen(true)} aria-label="Open menu">
          <Menu />
        </Button>
        <div className="lg:hidden">
          <Logo to="/app" compact />
        </div>
        <p className="hidden text-sm text-muted lg:block">{longToday()}</p>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setPalette(true)} aria-label="Search">
            <Search />
          </Button>
          <Button variant="outline" className="max-md:hidden" onClick={() => openEditor('log')}>
            <Plus /> Log time
          </Button>
          {timer ? (
            <Button variant="soft" onClick={() => setFocusOpen(true)}>
              <span className="live-dot size-2 rounded-full bg-danger" /> Focus running
            </Button>
          ) : (
            <Button variant="primary" data-tour="focus" onClick={() => openEditor('focus')}>
              <Timer /> Focus
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

const MOBILE = [
  { label: 'Home', to: '/app', icon: LayoutDashboard, color: byLabel.Overview.color },
  { label: 'Today', to: '/app/today', icon: Clock, color: byLabel.Today.color },
  { label: 'Subjects', to: '/app/subjects', icon: BookOpen, color: byLabel.Subjects.color },
  { label: 'Tasks', to: '/app/assignments', icon: ClipboardList, color: byLabel.Assignments.color },
  { label: 'Exams', to: '/app/exams', icon: GraduationCap, color: byLabel.Exams.color },
]

function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden" aria-label="App">
      <LayoutGroup id="mobilenav">
        <div className="grid grid-cols-5">
          {MOBILE.map(({ label, to, icon: Icon, color }) => (
            <NavLink key={to} to={to} end={to === '/app'} className="relative flex flex-col items-center gap-0.5 py-2 text-[0.7rem] font-semibold">
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="mob-active" className="absolute top-0 h-0.5 w-10 rounded-full" style={{ background: color }} />}
                  <motion.span animate={{ y: isActive ? -1 : 0, scale: isActive ? 1.1 : 1 }} style={{ color: isActive ? color : 'var(--muted)' }}>
                    <Icon className="size-5" />
                  </motion.span>
                  <span className={isActive ? 'text-ink' : 'text-muted'}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </LayoutGroup>
    </nav>
  )
}

function MobileDrawer() {
  const open = useUI((s) => s.navOpen)
  const setOpen = useUI((s) => s.setNavOpen)
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.div className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 330, damping: 34 }}
            className="absolute inset-y-0 left-0 w-[17rem] border-r border-line bg-surface shadow-float"
          >
            <Button variant="ghost" size="icon" className="absolute top-4 right-3" onClick={() => setOpen(false)} aria-label="Close menu">
              <X />
            </Button>
            <SideNav onNavigate={() => setOpen(false)} />
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}

function YuukiLayer() {
  const ready = useSync((s) => s.ready)
  const introduced = useStore((s) => s.guide.introduced)
  return (
    <>
      <Director />
      <AnimatePresence>{ready && !introduced && <Intro key="intro" />}</AnimatePresence>
      <YuukiBubble />
      <YuukiDock />
      <Chat />
    </>
  )
}

export default function Layout() {
  const location = useLocation()
  // Keep the old page's element while it fades out (an <Outlet/> would
  // already show the new page inside the leaving wrapper).
  const outlet = useOutlet()
  const page = pageFor(location.pathname)
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <ToastProvider>
      <div className="min-h-dvh lg:pl-[17rem]">
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-[17rem] border-r border-line bg-surface lg:block">
          <SideNav />
        </aside>
        <TopBar />
        <main className="tint mx-auto max-w-[1400px] px-4 pt-7 pb-44 sm:px-6 lg:px-8 lg:pb-40" style={{ '--accent': page.color }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <Suspense fallback={<div className="h-[60vh]" />}>{outlet}</Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
        <MobileNav />
        <MobileDrawer />
        <Editors />
        <QuizDrawer />
        <CommandPalette />
        <FocusMode />
        <TimerPill />
        <YuukiLayer />
      </div>
    </ToastProvider>
  )
}
