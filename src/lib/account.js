// The logged-in student's plan (Free / Plus / Pro) and usage, as reported by
// the server. The server is the only judge of what is allowed; the app just
// shows it and explains limits when the server says no.
import { create } from 'zustand'
import { api } from './api.js'
import { PLANS } from './plans.js'

export const useAccount = create(() => ({ summary: null, error: null, loaded: false }))

export async function loadAccount() {
  try {
    const summary = await api('/account')
    useAccount.setState({ summary, error: null, loaded: true })
    return summary
  } catch (e) {
    useAccount.setState({ error: e, loaded: true })
    return null
  }
}

export async function switchPlan(plan) {
  const summary = await api('/account/plan', { method: 'POST', body: { plan } })
  useAccount.setState({ summary, error: null, loaded: true })
  return summary
}

export const entitlementOf = (summary, id) => summary?.entitlements?.find((e) => e.id === id) || null

// "3 of 5 left this month" style text for one capability.
export function allowanceText(e) {
  if (!e) return ''
  if (!e.included) return e.comingSoon ? 'Coming later' : `Needs ${PLANS[e.upgradeTo]?.label || 'an upgrade'}`
  const l = e.limits || {}
  if (l.perMonth != null) return `${Math.max(0, l.perMonth - e.usedThisMonth)} of ${l.perMonth} left this month`
  if (l.perDay != null) return `${Math.max(0, l.perDay - e.usedToday)} of ${l.perDay} left today`
  return 'Included'
}

// Turn a 402 from the server into something to show.
export function limitFromError(e) {
  if (e?.status !== 402) return null
  return { message: e.message, upgradeTo: e.data?.entitlement?.upgradeTo || null }
}
