// Fixed accounts for the class demo. Only salted PBKDF2 hashes are stored
// (in accounts.json); passwords never appear in the code. Add or change an
// account with:  npm run account -- <username> <password>
//
// This is a demo login, not real security: the hashes ship with the site, so
// anyone could try to crack a weak password offline. Use real auth (a server
// with sessions) before handling anything private.
import ACCOUNTS from './accounts.json' with { type: 'json' }

export const ITERATIONS = 150000

const enc = new TextEncoder()
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)))

export async function hashPassword(password, saltHex, iterations = ITERATIONS) {
  const subtle = globalThis.crypto.subtle
  const key = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations }, key, 256)
  return toHex(bits)
}

export const normalizeUsername = (u) => String(u || '').trim().toLowerCase()

export function accountExists(username) {
  return Object.hasOwn(ACCOUNTS, normalizeUsername(username))
}

// Constant-time compare so timing does not leak how much of a hash matched.
function equal(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifyPassword(username, password) {
  const acc = ACCOUNTS[normalizeUsername(username)]
  if (!acc || typeof password !== 'string' || !password) return false
  const hash = await hashPassword(password, acc.salt, acc.iterations || ITERATIONS)
  return equal(hash, acc.hash)
}

export const usernames = () => Object.keys(ACCOUNTS)
