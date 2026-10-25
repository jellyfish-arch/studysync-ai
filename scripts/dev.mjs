// `npm run dev`: the StudySync server (API, sync, Yuuki AI, MCP) plus Vite.
// Ctrl+C stops both.
//
// `npm run dev -- --sandbox` uses a separate data folder (data-sandbox/) and
// server port (8788), so testing never touches your real accounts.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const children = []
let args = process.argv.slice(2)
const env = { ...process.env }
if (args.includes('--sandbox')) {
  args = args.filter((a) => a !== '--sandbox')
  env.STUDYSYNC_DATA_DIR ||= 'data-sandbox'
  env.STUDYSYNC_PORT ||= '8788'
  env.STUDYSYNC_DEMO_PLANS ||= 'true' // test Plus/Pro screens freely
  console.log(`[studysync] Sandbox: data in ${env.STUDYSYNC_DATA_DIR}/, server on port ${env.STUDYSYNC_PORT}.`)
}

function start(name, file, extra = [], nodeArgs = []) {
  const child = spawn(process.execPath, [...nodeArgs, path.join(root, file), ...extra], { cwd: root, stdio: 'inherit', env })
  children.push(child)
  child.on('exit', (code, signal) => {
    if (name === 'server' && code === 0) return // another StudySync server is already running; keep Vite
    if (name === 'server' && code) console.log(`\n[studysync] The server stopped (code ${code}). The app still works, but without sync or Yuuki's AI.\n`)
    if (name === 'vite') shutdown(code ?? (signal ? 1 : 0))
  })
  return child
}

function shutdown(code = 0) {
  for (const c of children) if (c.exitCode === null) c.kill()
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

// --watch restarts the server when its code (or the shared src/lib code) changes.
start('server', 'server/index.js', [], ['--watch'])
start('vite', 'node_modules/vite/bin/vite.js', args)
