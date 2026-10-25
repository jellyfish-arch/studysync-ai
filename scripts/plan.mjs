// Set an account's StudySync plan by hand (there is no payment provider yet).
//   npm run plan -- <username> <free|plus|pro>
//   npm run plan -- <username>            (show the current plan)
// Add --sandbox to change the sandbox data instead of the real one.
const args = process.argv.slice(2)
if (args.includes('--sandbox')) process.env.STUDYSYNC_DATA_DIR ||= 'data-sandbox'
const [user, plan] = args.filter((a) => a !== '--sandbox')

const { accountExists } = await import('../src/lib/accounts.js')
const { getPlan, setPlan } = await import('../server/entitlements.js')

if (!user || !accountExists(user)) {
  console.log('Usage: npm run plan -- <username> [free|plus|pro]')
  process.exit(1)
}
if (plan) {
  setPlan(user, plan, 'admin')
  console.log(`${user} is now on ${plan}.`)
} else console.log(`${user} is on ${getPlan(user)}.`)
