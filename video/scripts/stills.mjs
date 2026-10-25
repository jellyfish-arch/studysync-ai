// Render a few frames as PNGs to check the video without a full render:
//   node scripts/stills.mjs 60 380 1010
import { bundle } from '@remotion/bundler'
import { renderStill, selectComposition } from '@remotion/renderer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const browserExecutable = process.env.REMOTION_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const serveUrl = await bundle({ entryPoint: path.resolve(HERE, '../src/index.jsx') })
const composition = await selectComposition({ serveUrl, id: 'StudySyncIntro', browserExecutable })
for (const f of process.argv.slice(2).map(Number)) {
  const output = path.resolve(HERE, `../out/stills/f${String(f).padStart(4, '0')}.png`)
  await renderStill({ serveUrl, composition, frame: f, output, browserExecutable, scale: 0.5 })
  console.log('still', f)
}
