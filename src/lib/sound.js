// Tiny synthesised sounds (no audio files). Off unless "Sounds" is on in
// Settings. Uses the Web Audio API, so nothing plays until the user has
// interacted with the page.
let ctx = null
let enabled = false

export const setSoundEnabled = (on) => {
  enabled = Boolean(on)
}

const TONES = {
  pop: [
    [660, 0, 0.05],
    [990, 0.045, 0.06],
  ],
  done: [
    [523, 0, 0.08],
    [659, 0.07, 0.08],
    [784, 0.14, 0.14],
  ],
  tick: [[1200, 0, 0.025]],
}

export function blip(kind = 'pop') {
  if (!enabled || typeof window === 'undefined') return
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)()
    const now = ctx.currentTime
    for (const [freq, at, len] of TONES[kind] || TONES.pop) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now + at)
      gain.gain.exponentialRampToValueAtTime(0.08, now + at + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + len)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + at)
      osc.stop(now + at + len + 0.02)
    }
  } catch {
    /* audio not available */
  }
}
