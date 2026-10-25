// Make Yuuki's voice lines with Gemini text-to-speech (your GEMINI_API_KEY from
// the project's .env; the key is never printed or saved here).
//   node scripts/voice.mjs            all lines
//   node scripts/voice.mjs today      one line
// Writes public/voice/<id>.wav and public/voice/voice.json (durations).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(HERE, '../public/voice')
mkdirSync(OUT, { recursive: true })
process.loadEnvFile?.(path.resolve(HERE, '../../.env'))
const KEY = (process.env.GEMINI_API_KEY || '').trim()
if (!KEY) throw new Error('GEMINI_API_KEY is not set in the project .env')

const MODELS = (process.env.TTS_MODELS || 'gemini-2.5-flash-preview-tts,gemini-3.1-flash-tts-preview,gemini-3.8-flash-tts').split(',')
const VOICE = process.env.TTS_VOICE || 'Leda'
const STYLE = process.env.TTS_STYLE || 'Read this as Yuuki: a cheerful, warm, slightly playful young woman, an anime-style study buddy. Friendly and bright, natural pace, not over the top:'

const { LINES } = await import(pathToFileURL(path.resolve(HERE, '../src/voice.js')).href)
const only = process.argv[2]

function wav(pcm, rate = 24000) {
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12)
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24)
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([h, pcm])
}

async function speak(text) {
  let last
  for (const model of MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: STYLE === 'none' ? text : `${STYLE} ${text}` }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
      }),
    })
    const json = await res.json().catch(() => null)
    const part = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)
    if (res.ok && part) {
      const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1] || 24000)
      return { model, rate, pcm: Buffer.from(part.inlineData.data, 'base64') }
    }
    last = `${model}: ${res.status} ${(json?.error?.message || '').slice(0, 140)}`
    console.log('  skip', last)
  }
  throw new Error(`No TTS model worked. ${last}`)
}

const metaFile = path.join(OUT, 'voice.json')
const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf8')) : {}
for (const l of LINES) {
  if (only && l.id !== only) continue
  const { model, rate, pcm } = await speak(l.text)
  writeFileSync(path.join(OUT, `${l.id}.wav`), wav(pcm, rate))
  meta[l.id] = { seconds: Math.round((pcm.length / 2 / rate) * 100) / 100, model, voice: VOICE }
  console.log(l.id, meta[l.id].seconds + 's', model)
  writeFileSync(metaFile, JSON.stringify(meta, null, 2))
}
