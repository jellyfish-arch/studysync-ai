// Add or update a demo account:   npm run account -- <username> <password>
// Remove one:                     npm run account -- <username> --remove
// Writes only a salted PBKDF2 hash to src/lib/accounts.json.
import { readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { ITERATIONS, hashPassword, normalizeUsername } from '../src/lib/accounts.js'

const file = fileURLToPath(new URL('../src/lib/accounts.json', import.meta.url))
const [, , rawUser, password] = process.argv
const username = normalizeUsername(rawUser)

if (!username || !password) {
  console.log('Usage: npm run account -- <username> <password>\n       npm run account -- <username> --remove')
  process.exit(1)
}
if (!/^[a-z0-9._-]{2,24}$/.test(username)) {
  console.log('Usernames are 2 to 24 characters: letters, numbers, dot, dash or underscore.')
  process.exit(1)
}

const accounts = JSON.parse(readFileSync(file, 'utf8'))
if (password === '--remove') {
  delete accounts[username]
  console.log(`Removed ${username}.`)
} else {
  const salt = randomBytes(16).toString('hex')
  accounts[username] = { salt, hash: await hashPassword(password, salt), iterations: ITERATIONS }
  console.log(`Saved ${username}.`)
}
writeFileSync(file, JSON.stringify(accounts, null, 2) + '\n')
