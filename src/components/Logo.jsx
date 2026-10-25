import { Link } from 'react-router-dom'
import icon from '../assets/brand/studysync-icon.webp'

// The StudySync icon. The editable vector master is design/brand/studysync-icon.svg;
// the app shows a small WebP of the original artwork, which is sharper and far
// lighter at logo sizes than the 300 KB traced SVG.
export function LogoMark({ className = 'size-9' }) {
  return <img src={icon} alt="" width="36" height="36" draggable={false} className={`${className} shrink-0 select-none object-contain transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105`} />
}

export default function Logo({ to = '/', compact }) {
  return (
    <Link to={to} className="logo group flex items-center gap-2" aria-label="StudySync home">
      <LogoMark />
      {!compact && (
        <span className="font-display text-[1.15rem] font-bold tracking-tight text-ink">
          StudySync<span className="ml-1 align-[0.1em] text-[0.62em] font-semibold tracking-wide text-muted">AI</span>
        </span>
      )}
    </Link>
  )
}
