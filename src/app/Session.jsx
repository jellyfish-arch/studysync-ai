// Keeps /app behind the login and loads the logged-in account's data.
import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { clearSession, getSession } from '../lib/session.js'
import { useStore } from '../lib/store.js'
import { startSync, stopSync } from '../lib/sync.js'

export function RequireAuth({ children }) {
  const location = useLocation()
  const session = getSession()
  const user = useStore((s) => s.user)
  const [started] = useState(() => {
    if (session && useStore.getState().user !== session.username) useStore.getState().login(session.username)
    return Boolean(session)
  })
  useEffect(() => {
    if (started) startSync()
    return () => stopSync()
  }, [started])
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  if (!user) return null
  return children
}

export function useLogout() {
  const navigate = useNavigate()
  return () => {
    // Leave /app first; clearing the store while still inside it would make
    // the route guard redirect on its own and drop the goodbye.
    clearSession()
    navigate('/login', { replace: true, state: { bye: true } })
    setTimeout(() => {
      stopSync()
      useStore.getState().logout()
    }, 0)
  }
}
