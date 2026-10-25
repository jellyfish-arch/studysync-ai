// Yuuki's AI loop with a fake model: it asks for a tool, gets the result,
// then answers. Checks the tool really changes the store and can be undone.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../src/lib/store.js'
import { emptyData } from '../src/lib/ops.js'
import { askAI, localAnswer } from '../src/yuuki/brain.js'
import { useAccount } from '../src/lib/account.js'

function reply(message) {
  return new Response(JSON.stringify({ message }), { status: 200, headers: { 'content-type': 'application/json' } })
}

afterEach(() => vi.unstubAllGlobals())

describe('Yuuki AI', () => {
  it('runs tool calls against the store and returns the final answer', async () => {
    useStore.setState({ user: 'kal', ...emptyData() })
    const bodies = []
    const fetch = vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(init.body))
      if (bodies.length === 1)
        return reply({ role: 'assistant', content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'add_subject', arguments: JSON.stringify({ name: 'Compiler Design', code: 'CS601' }) } }] })
      return reply({ role: 'assistant', content: 'Added Compiler Design for you!' })
    })
    vi.stubGlobal('fetch', fetch)

    const r = await askAI([{ role: 'user', text: 'add compiler design, code CS601' }])
    expect(r.text).toBe('Added Compiler Design for you!')
    expect(r.actions[0]).toMatchObject({ name: 'add_subject', output: { ok: true } })
    expect(useStore.getState().subjects.map((s) => s.code)).toEqual(['CS601'])
    // second request carried the tool result back to the model
    expect(bodies[1].messages.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'c1' })
    expect(bodies[0].messages[0].content).toMatch(/You are Yuuki/)
    // the snapshot lets the user undo
    useStore.getState().replaceAll(r.before)
    expect(useStore.getState().subjects).toHaveLength(0)
  })

  it('on Plus, drafts a mission plan on the server as a draft, never on the calendar', async () => {
    useStore.setState({ user: 'kal', ...emptyData() })
    useAccount.setState({ summary: { plan: 'plus', entitlements: [] } })
    const bodies = []
    const urls = []
    const plan = { title: 'Week of 13 Oct', start: '2026-10-13', end: '2026-10-19', feasibility: { verdict: 'tight', summary: 'It fits, but only just.' }, stats: { tasks: 6 }, priorities: { deferred: [] }, warnings: [] }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init) => {
        urls.push(String(url))
        if (String(url).endsWith('/api/planner/draft')) return new Response(JSON.stringify({ plan: { id: 'm1', revisions: [{ plan }] } }), { status: 200, headers: { 'content-type': 'application/json' } })
        bodies.push(JSON.parse(init.body))
        if (bodies.length === 1) return reply({ role: 'assistant', content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'draft_mission_plan', arguments: '{"goal":"week"}' } }] })
        return reply({ role: 'assistant', content: 'Drafted! It is tight, check it in Mission Planner.' })
      }),
    )
    const r = await askAI([{ role: 'user', text: 'plan my week' }])
    expect(bodies[0].tools.map((t) => t.function.name)).toContain('draft_mission_plan')
    expect(urls).toContain('/api/planner/draft')
    expect(r.actions[0]).toMatchObject({ name: 'draft_mission_plan', output: { ok: true, verdict: 'tight' } })
    expect(r.actions[0].output.saved_as).toMatch(/approval/)
    expect(r.before).toBeNull() // nothing local changed, so nothing to undo
    expect(useStore.getState().blocks).toHaveLength(0)
  })

  it('still reports what it did when the AI fails halfway', async () => {
    useStore.setState({ user: 'kal', ...emptyData() })
    useAccount.setState({ summary: { plan: 'free', entitlements: [] } })
    let n = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        n++
        if (n === 1) return reply({ role: 'assistant', content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'add_subject', arguments: '{"name":"Compiler Design"}' } }] })
        return new Response(JSON.stringify({ error: 'All busy' }), { status: 429, headers: { 'content-type': 'application/json' } })
      }),
    )
    const r = await askAI([{ role: 'user', text: 'add compiler design' }])
    expect(r.text).toMatch(/Done what I could: Add subject/)
    expect(useStore.getState().subjects).toHaveLength(1)
    expect(r.before).not.toBeNull() // and it can still be undone
  })

  it('on Free, keeps planning tools out but stays helpful', async () => {
    useStore.setState({ user: 'kal', ...emptyData() })
    useAccount.setState({ summary: { plan: 'free', entitlements: [] } })
    let body
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        body = JSON.parse(init.body)
        return reply({ role: 'assistant', content: 'Try Mission Planner in the sidebar!' })
      }),
    )
    await askAI([{ role: 'user', text: 'plan my week' }])
    const names = body.tools.map((t) => t.function.name)
    expect(names).not.toContain('draft_mission_plan')
    expect(names).toContain('plan_study_blocks')
    expect(body.messages[0].content).toMatch(/Mission Planner \(in the sidebar\)/)
    expect(body.messages[0].content).toMatch(/RISKS RIGHT NOW/)
  })

  it('answers basic questions without any AI', () => {
    useStore.setState({ user: 'kal', ...emptyData() })
    expect(localAnswer('what should I study now?').text).toMatch(/Nothing urgent/)
    expect(localAnswer('how ready am I for exams').text).toMatch(/No exams/)
  })
})
