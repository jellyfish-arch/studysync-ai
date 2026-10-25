import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import Cursor from './components/Cursor.jsx'
import { RequireAuth } from './app/Session.jsx'
import { useStore } from './lib/store.js'
import { setSoundEnabled } from './lib/sound.js'
import { setDateSettings } from './lib/dates.js'
import { preloadPoses } from './yuuki/poses.js'

const Landing = lazy(() => import('./pages/Landing.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const Layout = lazy(() => import('./app/Layout.jsx'))
const Overview = lazy(() => import('./app/pages/Overview.jsx'))
const Today = lazy(() => import('./app/pages/Today.jsx'))
const Planner = lazy(() => import('./app/pages/Planner.jsx'))
const Calendar = lazy(() => import('./app/pages/Calendar.jsx'))
const Subjects = lazy(() => import('./app/pages/Subjects.jsx'))
const SubjectDetail = lazy(() => import('./app/pages/SubjectDetail.jsx'))
const Assignments = lazy(() => import('./app/pages/Assignments.jsx'))
const Exams = lazy(() => import('./app/pages/Exams.jsx'))
const Analytics = lazy(() => import('./app/pages/Analytics.jsx'))
const Profile = lazy(() => import('./app/pages/Profile.jsx'))
const Missions = lazy(() => import('./app/pages/Missions.jsx'))
const Connect = lazy(() => import('./app/pages/Connect.jsx'))
const Settings = lazy(() => import('./app/pages/Settings.jsx'))

// Routes, plus the interface settings of whoever is logged in.
export default function App() {
  const motion = useStore((s) => s.prefs.motion)
  const cursor = useStore((s) => s.prefs.cursor)
  const sounds = useStore((s) => s.prefs.sounds)
  const weekStart = useStore((s) => s.prefs.weekStartsOn)
  const timeFormat = useStore((s) => s.prefs.timeFormat)
  // Set before the pages render so every date and time on screen follows it.
  setDateSettings({ weekStart, timeFormat })
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', motion === 'reduced')
  }, [motion])
  useEffect(() => setSoundEnabled(sounds), [sounds])
  useEffect(() => {
    const id = setTimeout(preloadPoses, 1500)
    return () => clearTimeout(id)
  }, [])

  return (
    <MotionConfig reducedMotion={motion === 'reduced' ? 'always' : motion === 'full' ? 'never' : 'user'}>
      <Cursor enabled={cursor !== false} />
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/app"
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<Overview />} />
              <Route path="today" element={<Today />} />
              <Route path="planner" element={<Planner />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="subjects" element={<Subjects />} />
              <Route path="subjects/:id" element={<SubjectDetail />} />
              <Route path="assignments" element={<Assignments />} />
              <Route path="exams" element={<Exams />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="profile" element={<Profile />} />
              <Route path="missions" element={<Missions />} />
              <Route path="connect" element={<Connect />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/app" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </MotionConfig>
  )
}
