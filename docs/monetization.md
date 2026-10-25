# Plans and limits (monetization foundations)

StudySync has a Free plan and two paid plans, **Plus** and **Pro**. This page
covers what each includes, how limits are enforced, and what is still missing
before anyone could actually pay.

**Status:** limits are enforced, and the prices are a first hypothesis. There
is **no payment provider**. Nobody can buy anything, and the app says so
wherever a price appears.

## Plans

| | Free | Plus | Pro |
|---|---|---|---|
| Price (proposed) | ₹0 | ₹149/month or ₹999/year | ₹299/month or ₹1,999/year |
| Mission plans drafted | 5 a month, up to 7 days ahead | 60 a month, up to 120 days | 200 a month, up to 180 days |
| Active missions at once | 1 | 3 | 10 |
| Plan repairs | — | 60 a month | 200 a month |
| Scenario comparisons | 3 a month, 2 variants | 40 a month, 3 variants | 150 a month, 6 variants |
| Weekly reviews | — | 10 a month | 40 a month |
| Yuuki AI messages | 15 a day | 80 a day | 250 a day |
| Practice quizzes (Quiz me) | 3 a day | 20 a day | 60 a day |
| Yuuki can draft, repair and review plans in chat | — | yes | yes |
| AI apps (MCP): read | yes | yes | yes |
| AI apps (MCP): changes | 30 a day | 300 a day | 1,000 a day |
| AI apps (MCP): planning tools | — | yes | yes |
| Blocks one approved plan may add via MCP | — | 80 | 250 |

The prices assume Indian college students and are anchored below common
student subscriptions. They have **not** been tested with students. Things to
validate: willingness to pay, monthly vs. semester billing (a 5-month
"semester pass" may fit better than monthly), and student discounts.

### Never paywalled

- All tracking: subjects, syllabus, exams, assignments, planner, calendar, focus mode, analytics.
- Your data: backup, restore, export and delete. Nobody pays to get their own data out or to leave.
- Yuuki's guide mode, tour, tips and remarks, and her AI chat within the daily allowance (she still sees your risks and revision queue on Free).
- Revision reminders, confidence tracking and pasting a syllabus.
- The risk radar.

## How limits are enforced

- One table of capabilities lives in `src/lib/plans.js` (`ENTITLEMENTS`), each with a stable id such as `planner.generate` or `yuuki.chat`. The app reads it to *describe* plans; the server reads the same table to *enforce* them.
- `server/entitlements.js` checks every request on the server: Mission Planner endpoints, Yuuki's chat proxy and every MCP tool call. Hiding a button is never the only barrier.
- Refusals are HTTP **402** (or an MCP tool error) with the capability, the limit and the plan that includes it, so the app and AI apps can explain instead of failing silently.
- Counters (`data/.usage.json`) reset at the student's local midnight and on the 1st of the month. A credit is spent only when the work succeeds: a failed AI call or an empty plan costs nothing.
- Yuuki counts **one message per thing the student sends**, however many tool rounds the model needs. A round id covers at most 6 rounds within 10 minutes, so reusing it can't turn into free calls.
- `ingest.documents` (reading syllabus PDFs) and `career.planning` are listed with limits but marked *coming later*. They are not built, and the app doesn't pretend they are.

## Changing a plan today

- `npm run plan -- <user> plus` (or `free` / `pro`). Add `--sandbox` for the sandbox data. The plan is stored in `data/.billing.json`, which the browser never syncs.
- Demo switch: with `STUDYSYNC_DEMO_PLANS=true` (set automatically by `npm run dev -- --sandbox`), Settings > Plan and usage shows "Try (demo)" buttons. Without the flag, the server refuses plan changes from the app.

## Before real billing

1. **Payment provider.** For India: Razorpay or Stripe India, with UPI and cards. Use hosted checkout so card details never touch StudySync.
2. **Webhooks as the source of truth.** Plans change only from verified provider webhooks (signature checked, idempotent), never from the browser.
3. **Real accounts.** Payments need real sign-up, email verification and password reset, not the two built-in test accounts.
4. **Subscription lifecycle.** Renewals, failed payments with a grace period, cancellation that keeps Plus until the period ends, and downgrades that keep extra missions read-only instead of deleting them.
5. **Legal and tax.** GST invoices, refund policy, terms and privacy policy, and RBI rules for recurring card payments (e-mandates).
6. **Cost control.** Yuuki uses free model tiers today. Paid plans promise more AI messages, so measure the real cost per message before fixing prices.
