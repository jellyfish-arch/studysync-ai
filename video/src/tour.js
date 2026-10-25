// The guided tour: which screenshot is showing, where the cursor clicks, what
// gets pointed at and when. Frames are local to the tour (30 fps). Boxes are
// in the screenshot's CSS pixels ([x, y, w, h]), taken from shots.json and
// checked by eye against the screenshots.
import { C } from './theme.js'
import { LINES } from './voice.js'

// Sidebar links (same place on every page).
const NAV = { overview: [135, 187], today: [135, 225], subjects: [135, 419], missions: [135, 301], connect: [135, 612] }
const DOCK = [1430, 812] // Yuuki's corner button

export const PAGES = [
  {
    key: 'overview',
    img: 'overview',
    path: 'app',
    start: 0,
    end: 240,
    accent: C.ink,
    icon: 'dashboard',
    eyebrow: 'Overview',
    title: 'Your whole day at a glance.',
    yuuki: { pose: 'present' },
    anns: [
      { box: [326, 244, 492, 118], at: 70, cam: [640, 250, 1.45], text: 'Streak, syllabus done and what’s due this week' },
      { box: [822, 124, 200, 226], at: 100, cam: [640, 250, 1.45], text: 'Today’s goal fills up as you study' },
      { box: [304, 405, 1104, 80], at: 140, cam: [856, 445, 1.22], text: 'Heads up: risks before they bite' },
      { box: [304, 505, 355, 200], at: 180, cam: [520, 560, 1.35], text: 'A countdown to your next exam' },
    ],
  },
  {
    key: 'today',
    img: 'today',
    path: 'app/today',
    start: 240,
    end: 450,
    accent: C.lime,
    icon: 'clock',
    eyebrow: 'Today',
    title: 'One clear queue for today.',
    click: { at: 18, to: NAV.today },
    yuuki: { pose: 'clipboard' },
    anns: [
      { box: [1053, 204, 355, 300], at: 50, cam: [1180, 360, 1.5], text: 'Your next block, one tap to start a focus timer' },
      { box: [304, 394, 729, 400], at: 95, cam: [700, 560, 1.32], text: 'Tick blocks off as you finish them' },
      { box: [1053, 573, 355, 420], at: 140, cam: [1180, 770, 1.42], text: 'Revise today: topics return before you forget them' },
    ],
  },
  {
    key: 'subjects',
    img: 'subject',
    path: 'app/subjects/cs501',
    start: 450,
    end: 660,
    accent: C.gold,
    icon: 'book',
    eyebrow: 'Subjects',
    title: 'Every topic in your syllabus.',
    click: { at: 18, to: NAV.subjects },
    yuuki: { pose: 'read' },
    anns: [
      { box: [304, 129, 1104, 344], at: 48, cam: [856, 300, 1.15], text: 'Progress, time studied and next exam, per subject' },
      { box: [318, 628, 320, 116], at: 92, cam: [840, 690, 1.3], text: 'Tick topics as you cover them' },
      { box: [1216, 630, 146, 116], at: 120, cam: [840, 690, 1.3], text: 'Say how sure you feel about each one' },
      { box: [1260, 1272, 142, 54], at: 160, cam: [1080, 1190, 1.4], text: 'Paste the syllabus from your PDF, check it, then add' },
    ],
  },
  {
    key: 'missions',
    img: 'missions',
    path: 'app/missions',
    start: 660,
    end: 930,
    accent: C.orange,
    icon: 'route',
    eyebrow: 'Mission Planner',
    title: 'Honest plans that fit.',
    click: { at: 18, to: NAV.missions },
    yuuki: { pose: 'thumbs' },
    anns: [
      { box: [304, 227, 602, 420], at: 50, cam: [605, 440, 1.3], text: 'Your goal, and the time you really have' },
      { box: [329, 888, 552, 145], at: 100, cam: [720, 960, 1.5], text: 'A clear verdict: fits, tight or doesn’t fit' },
      { box: [583, 1210, 300, 340], at: 150, cam: [760, 1380, 1.4], text: 'Every day planned around what’s already booked' },
      { box: [329, 2157, 272, 40], at: 200, cam: [640, 1990, 1.25], text: 'Nothing is added until you approve' },
    ],
  },
  {
    key: 'chat',
    img: 'chat',
    path: 'app',
    start: 930,
    end: 1110,
    accent: C.mint,
    icon: 'message',
    eyebrow: 'Yuuki',
    title: 'Just ask. She’ll do it.',
    // Back to the overview, then open the chat from Yuuki's corner.
    click: { at: 14, to: NAV.overview, img: 'overview' },
    click2: { at: 40, to: DOCK },
    yuuki: { pose: 'wave' },
    anns: [
      { box: [1078, 566, 326, 66], at: 75, cam: [1212, 640, 1.55], text: 'Ask in plain words, like a friend' },
      { box: [1066, 722, 192, 34], at: 115, cam: [1212, 640, 1.55], text: 'She adds and plans things for you. Undo any time.' },
    ],
  },
  {
    key: 'connect',
    img: 'connect',
    path: 'app/connect',
    start: 1110,
    end: 1290,
    accent: C.pink,
    icon: 'plug',
    eyebrow: 'Connect AI',
    title: 'Bring Claude in, too.',
    click: { at: 18, to: NAV.connect },
    yuuki: { pose: 'point' },
    anns: [
      { box: [433, 318, 277, 114], at: 50, cam: [856, 440, 1.3], text: 'Pick Claude Desktop or Claude Code' },
      { box: [433, 480, 846, 94], at: 85, cam: [856, 440, 1.3], text: 'Choose what it may change' },
      { box: [433, 590, 203, 40], at: 120, cam: [856, 440, 1.3], text: 'One private key. Disconnect any time.' },
    ],
  },
]

// Yuuki says (and her bubble shows) the voice-over line for each page.
for (const p of PAGES) {
  const l = LINES.find((x) => x.id === p.key)
  p.yuuki.line = l.text
  p.yuuki.at = l.at - 240 // tour-local frame
}

export const TOUR_LENGTH = PAGES.at(-1).end
