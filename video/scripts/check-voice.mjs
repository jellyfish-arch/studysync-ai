// Transcribe each voice clip with a Gemini text model, to check it says only its line.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const HERE = path.dirname(fileURLToPath(import.meta.url))
process.loadEnvFile?.(path.resolve(HERE, '../../.env'))
const KEY = process.env.GEMINI_API_KEY.trim()
const { LINES } = await import(pathToFileURL(path.resolve(HERE, '../src/voice.js')).href)
for (const l of LINES) {
  const data = readFileSync(path.resolve(HERE, `../public/voice/${l.id}.wav`)).toString('base64')
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({ contents: [{ parts: [{ inlineData: { mimeType: 'audio/wav', data } }, { text: 'Transcribe this audio exactly, word for word. Output only the transcript.' }] }] }),
  })
  const j = await res.json()
  console.log(l.id.padEnd(9), '|', (j.candidates?.[0]?.content?.parts?.[0]?.text || `ERR ${res.status} ${j.error?.message?.slice(0, 80)}`).trim())
}
