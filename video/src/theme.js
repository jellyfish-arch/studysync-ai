// StudySync's look, for the video: OLED black, one accent per section, the
// app's own fonts (Bricolage Grotesque, Onest, JetBrains Mono).
import { continueRender, delayRender, staticFile } from 'remotion'

export const C = {
  bg: '#000000',
  surface: '#0b0b0b',
  surface2: '#141414',
  line: '#232323',
  lineStrong: '#333333',
  ink: '#f5f3ef',
  ink2: '#c9c5bd',
  muted: '#8a867f',
  gold: '#facc15',
  rose: '#ff4d8d',
  mint: '#34d399',
  coral: '#ff6b5b',
  teal: '#2dd4bf',
  lime: '#a3e635',
  orange: '#ff9f43',
  sand: '#d6c3a5',
  peach: '#ffb38a',
  pink: '#fda4af',
}

export const FONT = {
  display: "'Bricolage Grotesque', 'Onest', sans-serif",
  sans: "'Onest', sans-serif",
  mono: "'JetBrains Mono', monospace",
}

// Load the fonts before any frame is rendered.
const fonts = [
  ['Onest', 'fonts/onest.woff2'],
  ['Bricolage Grotesque', 'fonts/bricolage.woff2'],
  ['JetBrains Mono', 'fonts/jetbrains.woff2'],
]
if (typeof document !== 'undefined') {
  const handle = delayRender('Loading fonts')
  Promise.all(fonts.map(([family, file]) => new FontFace(family, `url(${staticFile(file)}) format('woff2')`, { weight: '100 900' }).load()))
    .then((faces) => {
      faces.forEach((f) => document.fonts.add(f))
      continueRender(handle)
    })
    .catch((e) => {
      console.error(e)
      continueRender(handle)
    })
}

// The app's easing for things that move: quick start, soft landing.
export const EASE = [0.16, 1, 0.3, 1]
