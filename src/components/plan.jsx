// Small pieces for showing the student's plan and limits.
import { Link } from 'react-router-dom'
import { Lock, Sparkles } from './icons.jsx'
import { cn } from './ui.jsx'
import { PLANS } from '../lib/plans.js'
import { allowanceText, useAccount } from '../lib/account.js'

const PLAN_COLOR = { free: 'var(--ink-2)', plus: 'var(--teal)', pro: 'var(--rose)' }

export function PlanBadge({ className }) {
  const plan = useAccount((s) => s.summary?.plan)
  if (!plan) return null
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.72rem] font-bold', className)} style={{ color: PLAN_COLOR[plan], borderColor: `color-mix(in srgb, ${PLAN_COLOR[plan]} 40%, transparent)` }}>
      {plan !== 'free' && <Sparkles className="size-3" />}
      {PLANS[plan].label}
    </span>
  )
}

// Shown where a feature is not in the plan, or a limit is used up.
export function UpgradeNote({ message, upgradeTo, className }) {
  const p = upgradeTo ? PLANS[upgradeTo] : null
  const color = PLAN_COLOR[upgradeTo] || 'var(--gold)'
  return (
    <div className={cn('flex flex-wrap items-start gap-3 rounded-2xl border border-dashed p-4', className)} style={{ borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}>
      <Lock className="mt-0.5 size-5 shrink-0" style={{ color }} />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-ink">{message}</p>
        {p && (
          <p className="mt-0.5 text-muted">
            {p.label} ({p.blurb.toLowerCase().replace(/\.$/, '')}) is a proposed ₹{p.price.monthly}/month. Payments aren't set up yet.{' '}
            <Link to="/app/settings#plan" className="font-semibold text-ink-2 underline-offset-2 hover:underline">
              See plans
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}

// "3 of 5 left this month" for one capability.
export function Allowance({ id, className }) {
  const e = useAccount((s) => s.summary?.entitlements?.find((x) => x.id === id))
  if (!e) return null
  return <span className={cn('text-[0.75rem] text-muted', className)}>{allowanceText(e)}</span>
}
