// Talking to the optional StudySync server (npm run dev starts it). The app
// works without it: data stays in the browser and Yuuki uses her built-in
// guide instead of an AI model.
import { getSession } from './session.js'

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message)
    this.status = status
    this.data = data // the server's JSON body (e.g. entitlement details, validation errors)
  }
}

export async function api(path, { method = 'GET', body, timeout = 15000, auth = true, signal } = {}) {
  const headers = { 'content-type': 'application/json' }
  const token = auth ? getSession()?.token : null
  if (token) headers.authorization = `Bearer ${token}`
  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal || AbortSignal.timeout(timeout),
    })
  } catch (e) {
    throw new ApiError(e.name === 'TimeoutError' ? 'The server took too long to answer.' : 'Could not reach the StudySync server.', 0)
  }
  const type = res.headers.get('content-type') || ''
  const data = type.includes('application/json') ? await res.json().catch(() => null) : null
  if (!res.ok) throw new ApiError(data?.error || `Server error ${res.status}`, res.status, data)
  if (!data) throw new ApiError('The server did not answer with data.', res.status)
  return data
}

// { ok, sync, ai: { groq, gemini, openrouter } } or null when there is no server.
let healthCache = null
export async function serverHealth(force = false) {
  if (healthCache && !force && Date.now() - healthCache.at < 30000) return healthCache.value
  let value = null
  try {
    const h = await api('/health', { auth: false, timeout: 4000 })
    value = h?.name === 'studysync' ? h : null
  } catch {
    value = null
  }
  healthCache = { at: Date.now(), value }
  return value
}
