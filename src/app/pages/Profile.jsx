import { useState } from 'react'
import { motion } from 'motion/react'
import { BookOpenCheck, Clock, Flame, GraduationCap, Lock, LogOut, Trophy, UserCircle } from '../../components/icons.jsx'
import { Button, Card, CardHeader, Count, Duration, Field, PageHeader, Stagger, cn } from '../../components/ui.jsx'
import { colorOf, useStore } from '../../lib/store.js'
import { longestStreak, overallProgress, pastExams, streak, totalMinutes } from '../../lib/selectors.js'
import { fullDate } from '../../lib/dates.js'
import { pose } from '../../yuuki/poses.js'
import { Avatar, SyncBadge } from '../Layout.jsx'
import { useLogout } from '../Session.jsx'

const AVATAR_COLORS = ['mint', 'gold', 'rose', 'coral', 'teal', 'lime', 'peach', 'sand']

function Identity() {
  const user = useStore((s) => s.user)
  const profile = useStore((s) => s.profile)
  const update = useStore((s) => s.updateProfile)
  // Edit locally, save on blur, so typing feels instant and saves are batched.
  const [f, setF] = useState(() => ({ name: profile.name, course: profile.course, semester: profile.semester, college: profile.college, about: profile.about }))
  const save = (k) => f[k] !== profile[k] && update({ [k]: f[k] })
  const bind = (k) => ({ value: f[k] || '', onChange: (e) => setF({ ...f, [k]: e.target.value }), onBlur: () => save(k) })

  return (
    <Card accent="var(--sand)" className="p-6 lg:col-span-7">
      <CardHeader title="About you" icon={UserCircle} sub="Yuuki uses your name. Your course and semester show in the sidebar." />
      <div className="mt-6 flex flex-col gap-6 sm:flex-row">
        <div className="flex flex-col items-center gap-3 sm:w-40">
          <motion.div key={profile.avatar + profile.avatarColor} initial={{ scale: 0.8, rotate: -6 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}>
            <Avatar size="size-28" className="rounded-3xl text-3xl" />
          </motion.div>
          <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Avatar">
            <button
              type="button"
              role="radio"
              aria-checked={profile.avatar === 'yuuki'}
              onClick={() => update({ avatar: 'yuuki' })}
              className={cn('size-8 overflow-hidden rounded-lg border-2', profile.avatar === 'yuuki' ? 'border-ink' : 'border-transparent opacity-70 hover:opacity-100')}
              title="Yuuki"
            >
              <img src={pose('avatar')} alt="Yuuki" className="size-full object-cover object-top" />
            </button>
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={profile.avatar === 'initials' && profile.avatarColor === c}
                aria-label={`Initials in ${c}`}
                onClick={() => update({ avatar: 'initials', avatarColor: c })}
                className={cn('size-8 rounded-lg border-2 transition-transform hover:scale-110', profile.avatar === 'initials' && profile.avatarColor === c ? 'border-ink' : 'border-transparent')}
                style={{ background: `color-mix(in srgb, ${colorOf(c)} 18%, #000)`, boxShadow: `inset 0 0 0 1.5px ${colorOf(c)}` }}
              />
            ))}
          </div>
        </div>
        <div className="grid flex-1 gap-4 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2">
            <input className="input" {...bind('name')} placeholder="What should Yuuki call you?" maxLength={60} />
          </Field>
          <Field label="Course">
            <input className="input" {...bind('course')} placeholder="B.Tech CSE" maxLength={60} />
          </Field>
          <Field label="Semester">
            <input className="input" {...bind('semester')} placeholder="Semester 5" maxLength={30} />
          </Field>
          <Field label="College" className="sm:col-span-2">
            <input className="input" {...bind('college')} placeholder="Your college or university" maxLength={80} />
          </Field>
          <Field label="About" className="sm:col-span-2" hint="One line, e.g. what you are aiming for this semester.">
            <textarea className="input min-h-20" {...bind('about')} placeholder="Aiming for a 9 CGPA and finally finishing DSA." maxLength={280} />
          </Field>
          <div className="sm:col-span-2">
            <span className="field-label">Username</span>
            <p className="flex h-10 items-center gap-2 rounded-xl border border-dashed border-line-strong px-3 font-mono text-sm text-ink-2">
              <Lock className="size-4 text-muted" /> {user}
              <span className="ml-auto font-sans text-[0.72rem] text-muted">only for logging in</span>
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}

function Semester() {
  const data = useStore()
  const done = pastExams(data).length
  const stats = [
    { icon: Clock, label: 'Studied in total', value: <Duration minutes={totalMinutes(data)} />, color: 'var(--lime)' },
    { icon: Flame, label: 'Current streak', value: <><Count value={streak(data)} /> d</>, color: 'var(--orange)' },
    { icon: Trophy, label: 'Longest streak', value: <><Count value={longestStreak(data)} /> d</>, color: 'var(--gold)' },
    { icon: BookOpenCheck, label: 'Syllabus covered', value: <><Count value={overallProgress(data).pct} />%</>, color: 'var(--mint)' },
    { icon: GraduationCap, label: 'Exams behind you', value: <Count value={done} />, color: 'var(--rose)' },
  ]
  return (
    <Card accent="var(--sand)" className="p-6 lg:col-span-5">
      <CardHeader title="Your semester so far" icon={Trophy} sub={`On StudySync since ${fullDate(data.profile.joined)}`} />
      <ul className="mt-5 space-y-2">
        {stats.map((s, i) => (
          <motion.li key={s.label} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.06 }} className="draw flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 transition-colors hover:border-line-strong">
            <s.icon className="size-5" style={{ color: s.color }} />
            <span className="text-sm text-ink-2">{s.label}</span>
            <span className="num ml-auto font-display text-lg font-bold text-ink">{s.value}</span>
          </motion.li>
        ))}
      </ul>
    </Card>
  )
}

function Account() {
  const logout = useLogout()
  const user = useStore((s) => s.user)
  return (
    <Card accent="var(--sand)" className="p-6 lg:col-span-12">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-ink">Signed in as {user}</h2>
          <SyncBadge className="mt-1" />
        </div>
        <Button variant="outline" onClick={logout}>
          <LogOut /> Log out
        </Button>
      </div>
    </Card>
  )
}

export default function Profile() {
  return (
    <>
      <PageHeader eyebrowIcon={UserCircle} title="Profile" sub="Who you are in StudySync. Study settings live in Settings." />
      <Stagger className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Identity />
        <Semester />
        <Account />
      </Stagger>
    </>
  )
}

