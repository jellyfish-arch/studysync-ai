// Who is logged in on this browser. "Remember me" keeps the session in
// localStorage; otherwise it lasts until the tab is closed.
const KEY = 'studysync:session'

function read(storage) {
  try {
    const v = JSON.parse(storage.getItem(KEY) || 'null')
    return v && typeof v.username === 'string' ? v : null
  } catch {
    return null
  }
}

export function getSession() {
  if (typeof window === 'undefined') return null
  return read(sessionStorage) || read(localStorage)
}

export function setSession(username, { remember = true, token = null } = {}) {
  const value = JSON.stringify({ username, token, at: Date.now() })
  try {
    ;(remember ? localStorage : sessionStorage).setItem(KEY, value)
    ;(remember ? sessionStorage : localStorage).removeItem(KEY)
  } catch {
    /* private mode: the session simply will not persist */
  }
}

export function setSessionToken(token) {
  const s = getSession()
  if (!s) return
  const remember = Boolean(read(localStorage))
  setSession(s.username, { remember, token })
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY)
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
