// Yuuki's AI providers: fallback, rate limits, used-up quotas and clean replies.
// fetch is faked; no real AI is called.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetLimits, chat, cleanReply, flattenToolHistory } from '../server/llm.js'
import { systemPrompt, toolsFor } from '../src/yuuki/persona.js'
import { demoSemester } from './fixtures/semester.js'
import { normalize } from '../src/lib/ops.js'

const ok = (content, extra = {}, tokens = 1000) => ({ ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify({ model: 'm', usage: { total_tokens: tokens }, choices: [{ message: { content, ...extra } }] }) })
const fail = (status, message) => ({ ok: false, status, headers: new Headers(), text: async () => JSON.stringify({ error: { message } }) })
const providerOf = (url) => (url.includes('groq') ? 'groq' : url.includes('openrouter') ? 'openrouter' : 'gemini')

let calls
function fakeFetch(answers) {
  calls = []
  globalThis.fetch = vi.fn(async (url) => {
    const p = providerOf(String(url))
    calls.push(p)
    const next = answers[p]
    return typeof next === 'function' ? next() : next
  })
}

const realFetch = globalThis.fetch
const saved = {}
beforeEach(() => {
  for (const k of ['GROQ_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY', 'AI_PROVIDER_ORDER']) saved[k] = process.env[k]
  Object.assign(process.env, { GROQ_API_KEY: 'g', GEMINI_API_KEY: 'm', OPENROUTER_API_KEY: 'o' })
  // These tests are about falling back between providers; Groq's second model
  // (same URL as the first) has its own test below.
  process.env.AI_PROVIDER_ORDER = 'groq,openrouter,gemini'
  _resetLimits()
})
afterEach(() => {
  globalThis.fetch = realFetch
  for (const [k, v] of Object.entries(saved)) (v === undefined ? delete process.env[k] : (process.env[k] = v))
})

const msgs = [{ role: 'user', content: 'hi' }]

describe('AI providers', () => {
  it('uses Groq first, then OpenRouter, then Gemini', async () => {
    fakeFetch({ groq: ok('hello from groq'), openrouter: ok('x'), gemini: ok('y') })
    const r = await chat({ messages: msgs })
    expect(r.provider).toBe('groq')
    expect(r.message.content).toBe('hello from groq')
  })

  it('falls back when a provider is rate-limited, and skips it for a while', async () => {
    fakeFetch({ groq: fail(429, 'Rate limit reached on tokens per minute'), openrouter: ok('from openrouter'), gemini: ok('y') })
    expect((await chat({ messages: msgs })).provider).toBe('openrouter')
    expect(calls).toEqual(['groq', 'openrouter'])
    // Groq is cooling down now: the next message goes straight to OpenRouter.
    calls.length = 0
    expect((await chat({ messages: msgs })).provider).toBe('openrouter')
    expect(calls[0]).toBe('openrouter')
  })

  it('treats a used-up daily quota and a busy model the same way', async () => {
    fakeFetch({ groq: fail(429, 'Rate limit reached on tokens per day (TPD)'), openrouter: fail(429, 'Rate limit exceeded: free-models-per-day'), gemini: ok('gemini answers') })
    const r = await chat({ messages: msgs })
    expect(r.provider).toBe('gemini')
  })

  it('says "busy" when every free model is busy, without leaking provider details', async () => {
    fakeFetch({ groq: fail(429, 'limit'), openrouter: fail(503, 'overloaded'), gemini: fail(503, 'high demand') })
    const e = await chat({ messages: msgs }).catch((x) => x)
    expect(e.status).toBe(429)
    expect(e.message).toMatch(/busy/)
    expect(e.message).not.toMatch(/groq|gemini|openrouter/i)
  })

  it('reports a missing setup as 503 without naming keys', async () => {
    Object.assign(process.env, { GROQ_API_KEY: '', GEMINI_API_KEY: '', OPENROUTER_API_KEY: '' })
    const e = await chat({ messages: msgs }).catch((x) => x)
    expect(e.status).toBe(503)
    expect(e.message).not.toMatch(/API_KEY|\.env/)
  })

  it('holds back from Groq before its tokens-per-minute limit instead of failing', async () => {
    fakeFetch({ groq: ok('g', {}, 6000), openrouter: ok('o'), gemini: ok('m') })
    const big = [{ role: 'user', content: 'x'.repeat(20000) }] // ~5.7k tokens
    expect((await chat({ messages: big })).provider).toBe('groq')
    calls.length = 0
    expect((await chat({ messages: big })).provider).toBe('openrouter')
    expect(calls).toEqual(['openrouter']) // Groq wasn't even asked
  })

  it('retries once without reasoning options a model does not know', async () => {
    let n = 0
    fakeFetch({ groq: () => (n++ === 0 ? fail(400, 'Unrecognized request argument: reasoning_effort') : ok('fine')), openrouter: ok('o'), gemini: ok('m') })
    const r = await chat({ messages: msgs })
    expect(r.provider).toBe('groq')
    expect(r.message.content).toBe('fine')
  })

  it('passes tool calls through untouched', async () => {
    const tool_calls = [{ id: 't1', type: 'function', function: { name: 'add_exam', arguments: '{}' } }]
    fakeFetch({ groq: ok('', { tool_calls }), openrouter: ok('o'), gemini: ok('m') })
    expect((await chat({ messages: msgs })).message.tool_calls).toEqual(tool_calls)
  })
})

describe('mixing providers in one conversation', () => {
  const history = [
    { role: 'user', content: 'plan my week' },
    { role: 'assistant', content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'draft_mission_plan', arguments: '{"goal":"week"}' } }] },
    { role: 'tool', tool_call_id: 'c1', content: '{"ok":true,"verdict":"tight"}' },
  ]

  it("turns another model's tool calls into plain text for Gemini", () => {
    const flat = flattenToolHistory(history, (c) => Boolean(c?.extra_content?.google?.thought_signature))
    expect(flat.some((m) => m.tool_calls || m.role === 'tool')).toBe(false)
    expect(flat[1].content).toMatch(/draft_mission_plan/)
    expect(flat[2].content).toMatch(/tight/)
  })

  it("keeps Gemini's own tool calls as they are", () => {
    const own = history.map((m) => (m.tool_calls ? { ...m, tool_calls: m.tool_calls.map((c) => ({ ...c, extra_content: { google: { thought_signature: 'sig' } } })) } : m))
    expect(flattenToolHistory(own, (c) => Boolean(c?.extra_content?.google?.thought_signature))).toEqual(own)
  })

  it('sends Gemini a flattened history when it takes over mid-conversation', async () => {
    let geminiBody
    globalThis.fetch = vi.fn(async (url, init) => {
      const p = providerOf(String(url))
      if (p === 'gemini') {
        geminiBody = JSON.parse(init.body)
        return ok('Drafted, it is tight.')
      }
      return fail(429, 'limit')
    })
    const r = await chat({ messages: history })
    expect(r.provider).toBe('gemini')
    expect(geminiBody.messages.some((m) => m.role === 'tool')).toBe(false)
  })
})

describe("Groq's second model", () => {
  it('takes over when the first is out of per-minute tokens, before slower providers', async () => {
    process.env.AI_PROVIDER_ORDER = 'groq,groq-mini,openrouter,gemini'
    const models = []
    globalThis.fetch = vi.fn(async (url, init) => {
      const p = providerOf(String(url))
      if (p !== 'groq') return ok('slow')
      const model = JSON.parse(init.body).model
      models.push(model)
      return model.includes('120b') ? fail(429, 'Rate limit reached on tokens per minute') : ok('from the mini model')
    })
    const r = await chat({ messages: msgs })
    expect(r.provider).toBe('groq-mini')
    expect(models).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b'])
  })
})

describe('clean replies', () => {
  it('removes leaked thinking, markdown emphasis and emojis', () => {
    expect(cleanReply('<think>the user wants x</think>Sure, **done**! 👍')).toBe('Sure, done!')
    expect(cleanReply('## Plan\n* one\n* two')).toBe('Plan\n- one\n- two')
  })
})

describe("Yuuki's persona", () => {
  const s = { ...normalize(demoSemester('2026-10-13')), user: 'kal' }

  it('gives her a calendar, her rules and the real snapshot', () => {
    const p = systemPrompt(s, { today: '2026-10-13', now: new Date('2026-10-13T20:00:00') })
    expect(p).toMatch(/You are Yuuki/)
    expect(p).toMatch(/Fri 23 Oct = 2026-10-23/)
    expect(p).toMatch(/No markdown/)
    expect(p).toMatch(/Operating Systems/)
    expect(p).not.toMatch(/API|\.env|Groq/i)
  })

  it('sends only what a message needs, to stay under free-tier limits', () => {
    const names = (m, o) => toolsFor(m, o).map((t) => t.function.name)
    // a question: look-ups only
    expect(names('what is my next exam?')).toEqual(['get_subject', 'get_schedule'])
    // an action: the tools that change things
    expect(names('add a quiz for DBMS on friday')).toContain('add_exam')
    // "yes" to her own offer is an action too
    expect(names('yes', { context: 'Want me to mark it as done?' })).toContain('set_topic_done')
    // deletes only when asked, settings never
    expect(names('plan my evening')).not.toContain('delete_exam')
    expect(names('please delete the DBMS quiz')).toContain('delete_exam')
    expect(names('add anything')).not.toContain('update_preferences')
    // planning tools: Plus only, and only for planning requests
    expect(names('plan my week', { plan: 'plus' })).toContain('draft_mission_plan')
    expect(names('plan my week', { plan: 'free' })).not.toContain('draft_mission_plan')
    expect(names('add an exam', { plan: 'plus' })).not.toContain('draft_mission_plan')
  })
})
