// A camera over a screenshot: zoom into a point, pan between points, never
// show past the edges. Points and boxes are in the screenshot's CSS pixels.
import { Easing, interpolate } from 'remotion'
import { EASE } from './theme.js'

const ease = Easing.bezier(...EASE)
const lerp = (a, b, t) => a + (b - a) * t

// keys: [{ from, to, x, y, z }] in order; returns { x, y, z } at `frame`.
export function cameraAt(frame, start, keys) {
  let cur = start
  for (const k of keys) {
    if (frame >= k.to) cur = k
    else if (frame > k.from) {
      const t = ease(interpolate(frame, [k.from, k.to], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))
      return { x: lerp(cur.x, k.x, t), y: lerp(cur.y, k.y, t), z: lerp(cur.z, k.z, t) }
    } else break
  }
  return { x: cur.x, y: cur.y, z: cur.z }
}

// How the screenshot sits in a view of viewW x viewH screen pixels.
// `bottom` stops the camera before empty space at the end of a long page.
export function framing(cam, shot, viewW, viewH, bottom = shot.h) {
  const k = (viewW / shot.w) * cam.z
  const h = Math.min(shot.h, bottom)
  let tx = viewW / 2 - cam.x * k
  let ty = viewH / 2 - cam.y * k
  tx = Math.min(0, Math.max(viewW - shot.w * k, tx))
  ty = h * k <= viewH ? 0 : Math.min(0, Math.max(viewH - h * k, ty))
  return { k, tx, ty, toScreen: ([x, y, w = 0, h = 0]) => [tx + x * k, ty + y * k, w * k, h * k] }
}
