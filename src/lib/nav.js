// Every section of the app has its own accent on the black canvas. Overview
// mixes all of them, so it stays neutral itself.
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Clock,
  GraduationCap,
  LayoutDashboard,
  Plug,
  Route,
  Settings,
  UserCircle,
} from '../components/icons.jsx'

export const PAGES = [
  { label: 'Overview', to: '/app', icon: LayoutDashboard, color: '#f5f3ef' },
  { label: 'Today', to: '/app/today', icon: Clock, color: '#a3e635' },
  { label: 'Planner', to: '/app/planner', icon: CalendarRange, color: '#34d399' },
  { label: 'Mission Planner', to: '/app/missions', icon: Route, color: '#ff9f43' },
  { label: 'Calendar', to: '/app/calendar', icon: CalendarDays, color: '#2dd4bf' },
  { label: 'Subjects', to: '/app/subjects', icon: BookOpen, color: '#facc15' },
  { label: 'Assignments', to: '/app/assignments', icon: ClipboardList, color: '#ff6b5b' },
  { label: 'Exams', to: '/app/exams', icon: GraduationCap, color: '#ff4d8d' },
  { label: 'Analytics', to: '/app/analytics', icon: BarChart3, color: '#ffb38a' },
  { label: 'Profile', to: '/app/profile', icon: UserCircle, color: '#d6c3a5' },
  { label: 'Connect AI', to: '/app/connect', icon: Plug, color: '#fda4af' },
  { label: 'Settings', to: '/app/settings', icon: Settings, color: '#c4c0b8' },
]

export function pageFor(pathname) {
  if (pathname === '/app' || pathname === '/app/') return PAGES[0]
  return PAGES.slice(1).find((p) => pathname.startsWith(p.to)) || PAGES[0]
}
