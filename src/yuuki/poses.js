// Yuuki's poses (original chibi art, generated for this project; source
// sheets are in design/yuuki). Each one has a job in the app.
import avatar from '../assets/yuuki/avatar.webp'
import cheer from '../assets/yuuki/cheer.webp'
import clipboard from '../assets/yuuki/clipboard.webp'
import desk from '../assets/yuuki/desk.webp'
import hug from '../assets/yuuki/hug.webp'
import jump from '../assets/yuuki/jump.webp'
import oops from '../assets/yuuki/oops.webp'
import peek from '../assets/yuuki/peek.webp'
import point from '../assets/yuuki/point.webp'
import present from '../assets/yuuki/present.webp'
import read from '../assets/yuuki/read.webp'
import sleepy from '../assets/yuuki/sleepy.webp'
import think from '../assets/yuuki/think.webp'
import thumbs from '../assets/yuuki/thumbs.webp'
import wave from '../assets/yuuki/wave.webp'
import worried from '../assets/yuuki/worried.webp'

export const POSES = {
  wave, // hello, intro
  point, // "look here" during the tour (points to her right / our left)
  present, // "ta-da", showing something
  jump, // big win: unit done, exam 100% ready
  cheer, // something created
  thumbs, // done, saved
  think, // waiting for the AI, questions
  read, // syllabus and topics
  clipboard, // planning, assignments
  desk, // focus sessions
  sleepy, // late night, rest days
  worried, // deadlines close, overdue work
  oops, // errors
  hug, // empty states
  peek, // corner dock
  avatar, // chat avatar
}

export const pose = (name) => POSES[name] || POSES.wave

// Warm the browser cache so poses swap instantly.
export function preloadPoses() {
  if (typeof Image === 'undefined') return
  for (const src of Object.values(POSES)) {
    const img = new Image()
    img.src = src
  }
}
