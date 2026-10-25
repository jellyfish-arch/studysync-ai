import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Database, Download, MessageCircle, Palette, Plug, Refresh, Settings as SettingsIcon, Sparkles, Target, Upload, Wand } from '../../components/icons.jsx'
import HoldButton from '../../components/rb/HoldButton/HoldButton.jsx'
import { Button, Card, CardHeader, Choice, PageHeader, Stagger, Toggle, cn, useToast } from '../../components/ui.jsx'
import { exportData, useStore, validateImport } from '../../lib/store.js'
import { api } from '../../lib/api.js'
import { allowanceText, loadAccount, switchPlan, useAccount } from '../../lib/account.js'
import { ALWAYS_FREE, PLANS, PLAN_IDS, limitsFor } from '../../lib/plans.js'
import { PlanBadge } from '../../components/plan.jsx'
import { useSync } from '../../lib/sync.js'
import { formatMinutes, todayISO } from '../../lib/dates.js'
import { useYuuki } from '../../yuuki/state.js'

function Row({ title, text, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line py-4 first:border-t-0 first:pt-1">
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {text && <p className="mt-0.5 text-[0.8rem] text-muted">{text}</p>}
      </div>
      {children}
    </div>
  )
}

function Study() {
  const prefs = useStore((s) => s.prefs)
  const set = useStore((s) => s.updatePrefs)
  return (
    <Card accent="var(--lime)" className="p-6">
      <CardHeader title="Study" icon={Target} sub="How your days and timers work." />
      <div className="mt-4">
        <Row title="Daily goal" text="Fills the ring on your overview and the goal line in analytics.">
          <Choice id="goal" label="Daily goal" value={prefs.dailyGoal} onChange={(dailyGoal) => set({ dailyGoal })} options={[60, 120, 180, 240, 300, 360].map((m) => ({ value: m, label: `${m / 60}h` }))} />
        </Row>
        <Row title="Focus length" text="Default target when you start a focus session or plan a block.">
          <Choice id="focus" label="Focus length" value={prefs.focusLength} onChange={(focusLength) => set({ focusLength })} options={[25, 45, 60, 90].map((m) => ({ value: m, label: formatMinutes(m) }))} />
        </Row>
        <Row title="Week starts on" text="Planner, calendar and weekly charts.">
          <Choice id="week" label="Week starts on" value={prefs.weekStartsOn} onChange={(weekStartsOn) => set({ weekStartsOn })} options={[{ value: 'mon', label: 'Monday' }, { value: 'sun', label: 'Sunday' }]} />
        </Row>
        <Row title="Clock" text="How times are written across the app.">
          <Choice id="clock" label="Clock" value={prefs.timeFormat} onChange={(timeFormat) => set({ timeFormat })} options={[{ value: '12h', label: '7:30 pm' }, { value: '24h', label: '19:30' }]} />
        </Row>
        <Row title="Break reminder" text="Yuuki suggests a short break when a focus session reaches its target.">
          <Toggle label="Break reminder" checked={prefs.breakReminder} onChange={(breakReminder) => set({ breakReminder })} />
        </Row>
      </div>
    </Card>
  )
}

function YuukiSettings() {
  const prefs = useStore((s) => s.prefs)
  const user = useStore((s) => s.user)
  const set = useStore((s) => s.updatePrefs)
  const updateGuide = useStore((s) => s.updateGuide)
  const openChat = useYuuki((s) => s.openChat)
  const health = useSync((s) => s.health)
  const toast = useToast()
  return (
    <Card accent="var(--mint)" className="p-6">
      <CardHeader title="Yuuki" icon={MessageCircle} sub="Your study companion." />
      <div className="mt-4">
        <Row title="Tips and remarks" text="Yuuki comments when you add or finish things, and gives a tip the first time you open a page.">
          <Toggle label="Tips and remarks" checked={prefs.yuukiTips} onChange={(yuukiTips) => set({ yuukiTips })} />
        </Row>
        <Row title="How she talks" text="In chat.">
          <Choice id="style" label="Talk style" value={prefs.yuukiStyle} onChange={(yuukiStyle) => set({ yuukiStyle })} options={[{ value: 'chatty', label: 'Chatty' }, { value: 'brief', label: 'Brief' }]} />
        </Row>
        <Row title="AI chat" text={health?.ai ? 'Online: she can chat, answer questions about your semester and add things for you.' : 'Guide mode: she answers the basics from your data.'}>
          <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.75rem] font-semibold', health?.ai ? 'border-mint/40 text-mint' : 'border-line-strong text-muted')}>
            <span className={cn('size-1.5 rounded-full', health?.ai ? 'bg-mint' : 'bg-muted')} />
            {health?.ai ? 'Online' : 'Guide mode'}
          </span>
        </Row>
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <Button variant="soft" size="sm" onClick={() => updateGuide({ tourDone: false, tour: 1 })}>
            <Refresh /> Replay the tour
          </Button>
          <Button variant="soft" size="sm" onClick={() => updateGuide({ introduced: false })}>
            <Wand /> Meet Yuuki again
          </Button>
          <Button variant="soft" size="sm" onClick={() => openChat()}>
            <MessageCircle /> Open chat
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              localStorage.removeItem(`studysync:chat:${user}`)
              updateGuide({ seen: [] })
              toast('Chat history and seen tips cleared')
            }}
          >
            Clear chat and tips
          </Button>
        </div>
      </div>
    </Card>
  )
}

function Interface() {
  const prefs = useStore((s) => s.prefs)
  const set = useStore((s) => s.updatePrefs)
  return (
    <Card accent="var(--teal)" className="p-6">
      <CardHeader title="Look and feel" icon={Palette} sub="One theme: OLED black. These change how it moves." />
      <div className="mt-4">
        <Row title="Custom cursor" text="The outline pointer that picks up the colour around it. Mouse and trackpad only.">
          <Toggle label="Custom cursor" checked={prefs.cursor} onChange={(cursor) => set({ cursor })} />
        </Row>
        <Row title="Motion" text="Follow system respects your device's reduce-motion setting.">
          <Choice id="motion" label="Motion" value={prefs.motion} onChange={(motion) => set({ motion })} options={[{ value: 'system', label: 'Follow system' }, { value: 'full', label: 'Full' }, { value: 'reduced', label: 'Reduced' }]} />
        </Row>
        <Row title="Celebrations" text="Confetti when you finish a day's plan, an assignment or a whole unit.">
          <Toggle label="Celebrations" checked={prefs.celebrations} onChange={(celebrations) => set({ celebrations })} />
        </Row>
        <Row title="Sounds" text="Soft pops when Yuuki talks and a chime when you finish something.">
          <Toggle label="Sounds" checked={prefs.sounds} onChange={(sounds) => set({ sounds })} />
        </Row>
      </div>
    </Card>
  )
}

function AiAppsCard() {
  const [count, setCount] = useState(null)
  useEffect(() => {
    api('/connections')
      .then((r) => setCount(r.connections.length))
      .catch(() => setCount(null))
  }, [])
  return (
    <Card accent="var(--peach)" className="p-6 lg:col-span-2">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <CardHeader title="AI apps" icon={Plug} sub="Let Claude read your semester, plan your week and add study blocks for you." />
          <p className="mt-2 text-[0.8rem] text-muted">{count == null ? 'Needs the StudySync server.' : count === 0 ? 'No AI apps connected yet.' : `${count} app${count === 1 ? '' : 's'} connected.`}</p>
        </div>
        <Link to="/app/connect">
          <Button variant="outline">
            Connect AI <ArrowRight />
          </Button>
        </Link>
      </div>
    </Card>
  )
}

function PlanCard() {
  const summary = useAccount((s) => s.summary)
  const loaded = useAccount((s) => s.loaded)
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [yearly, setYearly] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    loadAccount()
  }, [])
  useEffect(() => {
    if (window.location.hash === '#plan') setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
  }, [])
  const change = async (plan) => {
    setBusy(plan)
    try {
      await switchPlan(plan)
      toast(`Switched to ${PLANS[plan].label} (demo)`)
    } catch (e) {
      toast(e.message)
    } finally {
      setBusy(false)
    }
  }
  const shown = summary?.entitlements?.filter((e) => !e.comingSoon && e.id !== 'mcp.read') || []
  return (
    <Card accent="var(--teal)" className="scroll-mt-24 p-6 lg:col-span-2" id="plan" ref={ref}>
      <CardHeader title="Plan and usage" icon={Sparkles} sub="What your plan includes and how much you've used. Limits are checked by the StudySync server." action={<PlanBadge />} />
      {!summary ? (
        <p className="mt-4 rounded-xl border border-dashed border-line-strong p-4 text-sm text-ink-2">{loaded ? 'Plans need the StudySync server. If it is running, log out and back in.' : 'Loading…'}</p>
      ) : (
        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">This month</p>
            <ul className="space-y-1.5">
              {shown.map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5 text-sm last:border-0">
                  <span className="text-ink-2">{e.label}</span>
                  <span className={cn('num shrink-0 text-[0.78rem]', e.included ? 'text-ink' : 'text-muted')}>{allowanceText(e)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[0.8rem] font-semibold text-ink">Always free</p>
            <ul className="mt-1 space-y-1 text-[0.8rem] text-muted">
              {ALWAYS_FREE.map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-mint" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">Plans</p>
              <Choice id="billing" label="Billing period" size="sm" value={yearly ? 'y' : 'm'} onChange={(v) => setYearly(v === 'y')} options={[{ value: 'm', label: 'Monthly' }, { value: 'y', label: 'Yearly' }]} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {PLAN_IDS.map((id) => {
                const p = PLANS[id]
                const current = summary.plan === id
                const price = yearly ? p.price.yearly : p.price.monthly
                return (
                  <div key={id} className={cn('flex flex-col rounded-2xl border p-4', current ? 'border-[color-mix(in_srgb,var(--accent)_60%,transparent)]' : 'border-line')}>
                    <p className="font-display text-lg font-bold text-ink">{p.label}</p>
                    <p className="num mt-1 text-ink">
                      <span className="text-2xl font-bold">₹{price.toLocaleString('en-IN')}</span>
                      <span className="text-[0.78rem] text-muted">{price ? (yearly ? ' / year' : ' / month') : ''}</span>
                    </p>
                    <p className="mt-2 text-[0.8rem] text-ink-2">{p.blurb}</p>
                    <ul className="mt-2 space-y-0.5 text-[0.75rem] text-muted">
                      {planLines(id).map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-3">
                      {current ? (
                        <span className="text-[0.78rem] font-semibold text-[var(--accent)]">Your plan</span>
                      ) : summary.demoSwitch ? (
                        <Button variant="outline" size="sm" onClick={() => change(id)} disabled={Boolean(busy)}>
                          {busy === id ? 'Switching…' : 'Try (demo)'}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-[0.78rem] text-muted">
              Prices are proposals for the project, not a live offer. Payments are not set up, so nothing can be bought here.
              {summary.demoSwitch ? ' Demo mode is on: you can switch plans to try the limits.' : ''}
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}

const planLines = (id) => {
  const g = limitsFor(id, 'planner.generate')
  const r = limitsFor(id, 'planner.repair')
  const w = limitsFor(id, 'review.weekly')
  const c = limitsFor(id, 'yuuki.chat')
  const m = limitsFor(id, 'mcp.planning')
  return [
    `${g.perMonth} mission plans a month, up to ${g.horizonDays} days ahead`,
    `${g.activePlans} active plan${g.activePlans === 1 ? '' : 's'}`,
    r ? `${r.perMonth} plan repairs` : 'No plan repair',
    w ? `${w.perMonth} weekly reviews` : 'No weekly review',
    `${c.perDay} Yuuki AI messages a day`,
    m ? 'Planning tools in AI apps' : 'AI apps: read and edit only',
  ]
}

function Data() {
  const replaceAll = useStore((s) => s.replaceAll)
  const eraseAll = useStore((s) => s.eraseAll)
  const counts = {
    subjects: useStore((s) => s.subjects.length),
    topics: useStore((s) => s.topics.length),
    sessions: useStore((s) => s.sessions.length),
  }
  const toast = useToast()
  const fileRef = useRef(null)

  const download = () => {
    const blob = new Blob([JSON.stringify(exportData(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `studysync-${useStore.getState().user}-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    toast('Backup downloaded', { description: 'Keep the file somewhere safe.' })
  }

  const upload = async (file) => {
    try {
      const data = validateImport(JSON.parse(await file.text()))
      if (!data) throw new Error('bad file')
      replaceAll(data)
      toast('Backup restored', { description: `${data.subjects.length} subjects, ${data.sessions.length} study sessions.` })
    } catch {
      toast('That file is not a StudySync backup', { description: 'Nothing was changed.' })
    }
    fileRef.current.value = ''
  }

  return (
    <Card accent="var(--gold)" className="p-6">
      <CardHeader title="Your data" icon={Database} sub={`${counts.subjects} subjects, ${counts.topics} topics and ${counts.sessions} study sessions in this account.`} />
      <div className="mt-5 space-y-6">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={download}>
            <Download /> Download backup
          </Button>
          <Button variant="outline" onClick={() => fileRef.current.click()}>
            <Upload /> Restore backup
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files[0] && upload(e.target.files[0])} />
        </div>
        <div className="border-t border-line pt-5">
          <p className="mb-3 text-[0.8rem] text-muted">Erase every subject, exam, assignment and study session. Your profile and settings stay.</p>
          <HoldButton
            doneLabel="Erased"
            backgroundColor="var(--danger-soft)"
            fillColor="var(--danger)"
            textColor="var(--danger)"
            fillTextColor="#ffffff"
            size="md"
            radius={12}
            holdTime={2000}
            onHold={() =>
              setTimeout(() => {
                eraseAll()
                toast('Everything erased', { description: 'Your profile and settings were kept.' })
              }, 400)
            }
          >
            Hold to erase everything
          </HoldButton>
        </div>
      </div>
    </Card>
  )
}

export default function Settings() {
  return (
    <>
      <PageHeader eyebrowIcon={SettingsIcon} title="Settings" sub="Study preferences, Yuuki, how the app looks and moves, AI apps, your plan and your data. Your name and avatar are on the Profile page." />
      <Stagger className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Study />
        <YuukiSettings />
        <Interface />
        <Data />
        <AiAppsCard />
        <PlanCard />
      </Stagger>
    </>
  )
}
