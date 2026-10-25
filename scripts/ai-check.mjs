// `npm run ai:check`: tests every AI key in .env with one tiny request and
// says which ones work. If a model name is wrong it lists the ones you can use.
import '../server/env.js'
import { checkProviders } from '../server/llm.js'

const results = await checkProviders()
for (const [id, r] of Object.entries(results)) {
  if (r.ok) console.log(`  ok    ${id.padEnd(11)} ${r.model}  (replied "${r.reply}" in ${(r.ms / 1000).toFixed(1)} s)`)
  else if (r.busy) console.log(`  busy  ${id.padEnd(11)} the key works, but the free model is busy right now (${r.reason.slice(0, 90)})`)
  else {
    console.log(`  --    ${id.padEnd(11)} ${r.reason}`)
    if (r.availableModels?.length) console.log(`        models you can put in .env: ${r.availableModels.join(', ')}`)
  }
}
if (!Object.values(results).some((r) => r.ok)) {
  console.log('\nYuuki will use her built-in guide only. Add a key to .env (see .env.example) and run this again.')
  process.exitCode = 1
}
