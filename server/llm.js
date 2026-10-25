// Yuuki's brain: free models from Groq, Google AI Studio (Gemini) and
// OpenRouter. All three speak the OpenAI chat-completions format, so one
// client covers them. If one is busy, rate-limited or out of free quota, the
// next is tried, and a provider that just said "slow down" is skipped for a
// while instead of being asked again.
//
// Keys and models are read from .env (see .env.example). Nothing here is ever
// sent to the browser: the app only learns whether Yuuki's AI is on.
//
// Default models (chosen October 2026 by testing Yuuki's real prompt and tools
// against each free model; see docs/ai-models.md):
//   1. Groq        openai/gpt-oss-120b                     best answers, ~1-2 s, but the
//                                                         free tier allows ~8k tokens a minute
//   2. OpenRouter  nvidia/nemotron-3-super-120b-a12b:free  reliable in testing, 2-15 s
//   3. Gemini      gemini-3.1-flash-lite                   biggest free daily allowance and
//                                                         ~3 s, but often "high demand" in testing

const PROVIDERS = {
  groq: {
    label: 'Groq',
    key: 'GROQ_API_KEY',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    models: 'https://api.groq.com/openai/v1/models',
    model: () => process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    timeout: 25000,
    // Groq's free tier counts tokens per minute; stay under it ourselves.
    tokensPerMinute: () => Number(process.env.GROQ_TOKENS_PER_MINUTE || 7500),
    // Reasoning models: think briefly and keep the thinking out of the answer.
    extra: (model) => (/gpt-oss/.test(model) ? { reasoning_effort: 'low', include_reasoning: false } : /qwen|deepseek/.test(model) ? { reasoning_format: 'hidden' } : {}),
  },
  // Groq's limits are per model, so its smaller sibling is a second fast
  // option with its own per-minute allowance (same key).
  'groq-mini': {
    label: 'Groq',
    key: 'GROQ_API_KEY',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    models: 'https://api.groq.com/openai/v1/models',
    model: () => process.env.GROQ_MINI_MODEL || 'openai/gpt-oss-20b',
    timeout: 25000,
    tokensPerMinute: () => Number(process.env.GROQ_TOKENS_PER_MINUTE || 7500),
    extra: (model) => (/gpt-oss/.test(model) ? { reasoning_effort: 'low', include_reasoning: false } : {}),
  },
  gemini: {
    label: 'Gemini',
    key: 'GEMINI_API_KEY',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    models: 'https://generativelanguage.googleapis.com/v1beta/openai/models',
    model: () => process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
    timeout: 20000,
    extra: () => ({ reasoning_effort: 'low' }),
    // Gemini only accepts tool calls in the history that it made itself
    // (they carry its "thought signature"); others are passed as plain text.
    ownToolCalls: (call) => Boolean(call?.extra_content?.google?.thought_signature),
  },
  openrouter: {
    label: 'OpenRouter',
    key: 'OPENROUTER_API_KEY',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    models: 'https://openrouter.ai/api/v1/models',
    model: () => process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free',
    timeout: 45000,
    headers: { 'HTTP-Referer': 'https://github.com/studysync-ai', 'X-Title': 'StudySync AI' },
    // Free models come and go upstream: OpenRouter tries these, in order,
    // when the main one fails (all passed Yuuki's tests in October 2026).
    extra: (model) => ({
      reasoning: { effort: 'low', exclude: true },
      models: [model, ...(process.env.OPENROUTER_FALLBACKS || 'nvidia/nemotron-3.5-lightning:free,nvidia/nemotron-3-ultra-550b-a55b:free').split(',').map((m) => m.trim()).filter((m) => m && m !== model)].slice(0, 3),
    }),
    // Its reasoning counts toward max_tokens, so leave room for the answer.
    maxTokens: 2000,
  },
}

const key = (id) => (process.env[PROVIDERS[id].key] || '').trim()

export function aiStatus() {
  return Object.fromEntries(Object.entries(PROVIDERS).map(([id, p]) => [id, { configured: Boolean(key(id)), model: p.model(), label: p.label }]))
}

export const anyProvider = () => Object.keys(PROVIDERS).some((id) => key(id))

/* ---------- being polite to free tiers ---------- */
const coolUntil = new Map() // provider -> timestamp it may be tried again
const spent = new Map() // provider -> [{ at, tokens }] in the last minute

function coolDown(id, err) {
  const msg = String(err.message || '')
  // A daily limit won't come back in a minute.
  const ms = err.retryAfter ? err.retryAfter * 1000 : /per[ -]day|daily|quota/i.test(msg) ? 30 * 60000 : err.status === 429 ? 60000 : 30000
  coolUntil.set(id, Date.now() + ms)
}
const cooling = (id) => (coolUntil.get(id) || 0) > Date.now()

const estimateTokens = (body) => Math.ceil(JSON.stringify(body).length / 3.5)
function tokensLastMinute(id) {
  const list = (spent.get(id) || []).filter((x) => x.at > Date.now() - 60000)
  spent.set(id, list)
  return list.reduce((n, x) => n + x.tokens, 0)
}
const overBudget = (id, body) => PROVIDERS[id].tokensPerMinute && tokensLastMinute(id) + estimateTokens(body) > PROVIDERS[id].tokensPerMinute()

function order(prefer) {
  const configured = (process.env.AI_PROVIDER_ORDER || 'groq,groq-mini,openrouter,gemini')
    .split(',')
    .map((s) => s.trim())
    .filter((id) => PROVIDERS[id] && key(id))
  if (prefer && prefer !== 'auto' && configured.includes(prefer)) return [prefer, ...configured.filter((x) => x !== prefer)]
  return configured
}

/* ---------- cleaning answers ---------- */
// Some models still leak their thinking or decorate replies. Yuuki talks in
// plain text: no hidden reasoning, markdown emphasis or emojis.
export function cleanReply(text) {
  return String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^[\s\S]*<\/think>/i, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[*•]\s+/gm, '- ')
    .replace(/\p{Extended_Pictographic}️?/gu, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim()
}

async function post(p, body) {
  const res = await fetch(p.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key(p.id)}`, ...(p.headers || {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(p.timeout),
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* not JSON */
  }
  return { res, json, text }
}

// Rewrite tool calls a provider can't accept (another model made them) as
// plain text, so a fallback model can still finish the conversation.
export function flattenToolHistory(messages, keep = () => true) {
  const out = []
  const names = new Map()
  for (const m of messages) {
    if (m.role === 'assistant' && m.tool_calls?.length && !m.tool_calls.every(keep)) {
      for (const c of m.tool_calls) names.set(c.id, c.function?.name)
      const calls = m.tool_calls.map((c) => `${c.function?.name}(${c.function?.arguments || '{}'})`).join(', ')
      out.push({ role: 'assistant', content: `${m.content ? `${m.content}\n` : ''}[I used: ${calls}]` })
    } else if (m.role === 'tool' && names.has(m.tool_call_id)) {
      out.push({ role: 'user', content: `[Result of ${names.get(m.tool_call_id)}: ${String(m.content).slice(0, 3000)}]` })
    } else out.push(m)
  }
  return out
}

async function callProvider(id, { messages, tools, temperature = 0.7, maxTokens = 900, effort, timeout }) {
  const p = { ...PROVIDERS[id], id, ...(timeout ? { timeout: Math.min(PROVIDERS[id].timeout, timeout) } : {}) }
  const model = p.model()
  const extra = { ...(p.extra?.(model) || {}) }
  // Harder tasks (quizzes) may ask the reasoning models to think more.
  if (effort) {
    if ('reasoning_effort' in extra) extra.reasoning_effort = effort
    if (extra.reasoning) extra.reasoning = { ...extra.reasoning, effort }
  }
  if (p.ownToolCalls) messages = flattenToolHistory(messages, p.ownToolCalls)
  const body = { model, messages, temperature, max_tokens: p.maxTokens || maxTokens, ...extra }
  if (tools?.length) {
    body.tools = tools
    body.tool_choice = 'auto'
  }
  if (overBudget(id, body)) {
    const e = new Error(`${p.label}: holding back to stay under the free tokens-per-minute limit`)
    e.status = 429
    e.local = true
    throw e
  }
  let out
  try {
    out = await post(p, body)
    // An older model may not know the reasoning options: try once without them.
    if (out.res.status === 400 && Object.keys(extra).length && /reason|unknown|unrecognized|unsupported|invalid/i.test(out.text)) {
      for (const k of Object.keys(extra)) delete body[k]
      out = await post(p, body)
    }
  } catch (e) {
    const err = new Error(e.name === 'TimeoutError' ? `${p.label} took too long` : `${p.label}: ${e.message}`)
    err.status = 504
    throw err
  }
  const { res, json, text } = out
  if (!res.ok) {
    const msg = json?.error?.message || json?.[0]?.error?.message || json?.message || text.slice(0, 200) || res.statusText
    const err = new Error(`${p.label} ${res.status}: ${String(msg).slice(0, 240)}`)
    err.status = res.status
    err.retryAfter = Number(res.headers.get('retry-after')) || null
    throw err
  }
  const used = json?.usage?.total_tokens || estimateTokens(body)
  spent.set(id, [...(spent.get(id) || []), { at: Date.now(), tokens: used }])
  const message = json?.choices?.[0]?.message
  if (!message) throw Object.assign(new Error(`${p.label} sent an empty answer.`), { status: 502 })
  const content = cleanReply(message.content ?? '')
  if (!content && !message.tool_calls?.length) throw Object.assign(new Error(`${p.label} sent an empty answer.`), { status: 502 })
  return { message: { role: 'assistant', content, tool_calls: message.tool_calls || undefined }, provider: id, model: json.model || model }
}

// Try each configured provider in turn. Returns the first good answer.
export async function chat({ messages, tools, prefer, effort, maxTokens, timeout }) {
  const ids = order(prefer)
  if (!ids.length) {
    const e = new Error("Yuuki's AI isn't set up on this StudySync server.")
    e.status = 503
    throw e
  }
  // Providers that are cooling down go last, not away: better a slow answer than none.
  const tries = [...ids.filter((id) => !cooling(id)), ...ids.filter(cooling)]
  const errors = []
  for (const id of tries) {
    try {
      return await callProvider(id, { messages, tools, effort, timeout, ...(maxTokens ? { maxTokens } : {}) })
    } catch (e) {
      errors.push(e.message)
      if (!e.local) console.warn(`[yuuki] ${e.message}`)
      if ([429, 503, 504, 502, 500].includes(e.status) || e.status >= 500) coolDown(id, e)
    }
  }
  // Rate limits, timeouts and upstream "provider returned error"s are temporary;
  // only a request the providers reject outright (400/401/403) is a real snag.
  const busy = errors.every((m) => !/ 40[013]:/.test(m))
  const e = new Error(busy ? 'All of Yuuki\'s free AI models are busy right now. Try again in a minute.' : `Yuuki's AI couldn't answer: ${errors.join(' | ')}`)
  e.status = busy ? 429 : 502
  throw e
}

// Used by `npm run ai:check`: one small request per configured provider.
export async function checkProviders() {
  const out = {}
  for (const id of Object.keys(PROVIDERS)) {
    if (!key(id)) {
      out[id] = { ok: false, reason: 'no key in .env' }
      continue
    }
    const t0 = Date.now()
    try {
      const r = await callProvider(id, { messages: [{ role: 'user', content: 'Reply with exactly one word: ready' }], maxTokens: 300, temperature: 0 })
      out[id] = { ok: true, model: r.model, reply: String(r.message.content).trim().slice(0, 40), ms: Date.now() - t0 }
    } catch (e) {
      out[id] = { ok: false, reason: e.message }
      // Busy or rate-limited: the key works, the free model is just full right now.
      if ([429, 503, 504].includes(e.status)) {
        out[id].busy = true
        continue
      }
      try {
        const res = await fetch(PROVIDERS[id].models, { headers: { authorization: `Bearer ${key(id)}` }, signal: AbortSignal.timeout(15000) })
        const json = await res.json()
        out[id].availableModels = (json.data || []).map((m) => m.id).slice(0, 40)
      } catch {
        /* ignore */
      }
    }
  }
  return out
}

// For tests.
export function _resetLimits() {
  coolUntil.clear()
  spent.clear()
}
