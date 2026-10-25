// Yuuki's voice-over: one line per scene, spoken at `at` (global frame, 30 fps).
// The same text is shown in her speech bubbles, so they work as captions.
// Audio files are made by scripts/voice.mjs into public/voice/<id>.wav.
export const LINES = [
  { id: 'hello', at: 128, text: 'Hi! I’m Yuuki. Let me show you around StudySync!' },
  { id: 'overview', at: 270, text: 'This is home. Your whole day, at a glance.' },
  { id: 'today', at: 506, text: 'Here’s today’s queue. Tell me how a topic went, and I’ll bring it back for revision.' },
  { id: 'subjects', at: 716, text: 'Every topic in your syllabus. Readiness comes from what you’ve actually covered.' },
  { id: 'missions', at: 926, text: 'Mission Planner makes honest plans that fit. Missed a day? Just repair it.' },
  { id: 'chat', at: 1192, text: 'Or just ask me. I’ll plan, add and tick things for you.' },
  { id: 'connect', at: 1386, text: 'You can even bring Claude in, to plan with your real semester.' },
  { id: 'phones', at: 1536, text: 'And it works on your phone, too!' },
  { id: 'outro', at: 1660, text: 'Let’s ace this semester together!' },
]
export const lineFor = (id) => LINES.find((l) => l.id === id)?.text
