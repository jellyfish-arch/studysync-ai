# StudySync AI

A study tracker for college students: every subject's **syllabus**, your **exams**, **assignments** and **study time** in one place. The **Mission Planner** turns that into multi-day study plans, says honestly whether they fit, and repairs them when days get missed. **Yuuki**, a cheerful study companion, introduces herself, shows you around, reacts when you get things done and answers questions with free AI models. An **MCP server** lets other AI apps like Claude read your semester, plan with you and add things, with a separate key and permission for each app.

Built as an entrepreneurship class project.

## Run it

Needs Node.js 20.12 or newer.

```bash
npm install
npm run dev
```

On Windows PowerShell, type `npm.cmd` instead of `npm` if scripts are blocked.

`npm run dev` starts two things:

- the app on http://localhost:5173
- the StudySync server on http://localhost:8787. It handles sync between the app and AI tools, Yuuki's AI, and the MCP server.

Open http://localhost:5173 and press **Log in**.

### Presenting it

See [DEMO.md](DEMO.md): `npm run demo` (production build on http://localhost:8788 with demo data), `npm run demo:reset` and `npm run demo:check`.

### Sandbox (for trying things safely)

```bash
npm run dev -- --sandbox
```

Uses a separate `data-sandbox/` folder and server port 8788, so your real data in `data/` is never touched. It also turns on the demo plan switch (see Plans below).

### Accounts

Two demo accounts exist: `kal` and `jelly`, with the passwords you chose. Only salted PBKDF2 hashes are stored (`src/lib/accounts.json`). To add or change an account:

```bash
npm run account -- <username> <password>
```

The first login on each account starts Yuuki's introduction. She asks what to call you (the username is only for logging in), your course and semester, and your daily goal. Then she offers a short tour where you add a subject, a syllabus, an exam, an assignment and a study block for real.

This is a demo login, not real security. The hashes ship with the site, so use real authentication before storing anything private.

## Yuuki's AI keys

Yuuki works without any key. She guides, reacts and answers "what should I study now / how ready am I / what's due" from your data. With a free key she can chat properly and act for you: "plan my week", "add my DBMS quiz on Friday".

1. Copy `.env.example` to `.env` in the project folder.
2. Paste one or more keys:
   - `GROQ_API_KEY` from https://console.groq.com/keys
   - `GEMINI_API_KEY` from https://aistudio.google.com/apikey
   - `OPENROUTER_API_KEY` from https://openrouter.ai/settings/keys
3. Restart `npm run dev`, then run `npm run ai:check` to test them.

Defaults are `openai/gpt-oss-120b` on Groq, then `nvidia/nemotron-3-super-120b-a12b:free` on OpenRouter, then `gemini-3.1-flash-lite` on Gemini, chosen by testing Yuuki's real prompt and tools against the free models ([docs/ai-models.md](docs/ai-models.md)). If one is busy or out of free quota, Yuuki uses the next one. Keys, providers and models stay on the server: the app only knows whether Yuuki's AI is on. `.env` is in `.gitignore`.

## Connecting AI apps (MCP)

Open **Connect AI** in the app. Pick Claude Desktop or Claude Code, choose what it may do (read only, read and add, or full access) and copy the setup it shows. Each app gets its own connection key, shown once; the page turns green by itself when the app first connects, and **Disconnect** removes that app's access at once.

```json
{ "mcpServers": { "studysync": { "command": "node", "args": ["<this folder>/server/stdio.js"], "env": { "STUDYSYNC_KEY": "ssk_..." } } } }
```

There are 30 data tools, 9 Mission Planner tools and 5 prompts. The key decides the account, so a connected AI can't switch to someone else's. It works with apps on this computer only; ChatGPT, claude.ai and phone apps would need a hosted StudySync with proper sign-in. Details: [docs/mcp.md](docs/mcp.md).

## Plans (Free, Plus, Pro)

Free covers all tracking, your data, Yuuki's guide and the risk radar, plus 5 mission plans a month. Plus (proposed ₹149/month) and Pro (₹299/month) add plan repair, weekly reviews, longer plans, more AI messages and planning tools in AI apps. Limits are checked on the server. **Payments are not set up**: there is nothing to buy.

To change a plan for testing:

```bash
npm run plan -- jelly plus --sandbox
```

or use the "Try (demo)" buttons in Settings > Plan and usage while running with `--sandbox`. Details and what billing would still need: [docs/monetization.md](docs/monetization.md).

## What's in the app

| Screen | What you can do |
|---|---|
| Overview | Greeting, today's goal ring, streak, syllabus %, "heads up" risks, next exam countdown, today's plan with "up next", the next 14 days, syllabus per subject, this week's chart |
| Today | Your next block or most urgent task, the focus queue, topics due for revision (tap shaky, okay or solid), assignments due soon, time logged |
| Planner | Week board of study blocks. Drag a block to another day |
| Mission Planner | Risk radar; draft a plan for this week, one exam, several exams, catching up or the semester; see if it fits, what it assumed and what it left out; approve it into your planner; compare study times; track plan versus reality; repair from today; weekly review |
| Calendar | Month view of exams, deadlines and blocks. Click a day to add things |
| Subjects | Each subject's syllabus progress, study time and next exam |
| Subject page | Units and topics as a checklist, with how sure you feel about each ticked topic. Add them one by one, or paste the syllabus from your university PDF and check it before it's added |
| Assignments | Board (To do, In progress, Done) or list, with filters |
| Exams | Split-flap countdown, readiness (share of its topics ticked, how many you marked shaky, quiz scores), tick topics right there, **Quiz me** |
| Quiz me | Three AI-written questions on your own topics, answers double-checked by a second model; the score sets the topic's confidence and its next revision |
| Analytics | Time per day against your goal, streaks, time per subject, 20-week heatmap, Yuuki's notes |
| Connect AI | Connect an AI app step by step, live connection status, permissions, disconnect, troubleshooting |
| Focus mode | Full-screen timer with Yuuki studying beside you. Suggests a break at the target |
| Profile | Name, course, semester, college, about, avatar, your semester in numbers, log out |
| Settings | Daily goal, focus length, week start, 12 or 24 hour clock, break reminder, Yuuki's tips and talk style, AI model, custom cursor, motion, confetti, sounds, plan and usage, Yuuki's AI keys, backup, restore and erase |

**Shortcuts:** Ctrl+K jumps anywhere. Ctrl+J opens the chat with Yuuki.

## Design

One theme, OLED black, with colour that means something. Each section has its own colour, each subject has its own colour, and the overview mixes them, so no single colour leads. Icons are outline drawings that redraw on hover. The cursor is an outline arrow that takes the colour of what it points at. Motion reports changes: counting numbers, filling rings, a flip-board countdown, sparks only when you tick things, and confetti only for big wins.

What we avoided and why is in [docs/design-notes.md](docs/design-notes.md).

Yuuki is an original character drawn for this project. The pose sheets are in `design/yuuki/`, and the cut-out poses are in `src/assets/yuuki/`.

React Bits components still in use (in `src/components/rb/`): CountUp, Counter, HoldButton, JellyRadio, RotatingText, RubberSegment, ScrollVelocity, SplitFlapText, SpringCheck, SwipeToast.

## Project layout

```
src/
  App.jsx               routes and interface settings
  pages/                Landing, Login
  app/Layout.jsx        sidebar, top bar, page transitions
  app/pages/            Overview, Today, Planner, Missions, Calendar, Subjects, SubjectDetail,
                        Assignments, Exams, Analytics, Connect, Profile, Settings
  yuuki/                Yuuki: poses, bubble and dock, intro, tour and remarks, chat, AI brain
  components/           UI kit, forms, focus mode, cursor, command palette, charts, icons
  lib/ops.js            every change to the data (shared by the app, Yuuki and MCP)
  lib/tools.js          the AI tools (Yuuki and MCP)
  lib/store.js          the logged-in account's data in the browser
  lib/sync.js           sync with the server, three-way merge (lib/merge.js)
  lib/planner/          Mission Planner engine: context, plan, validate, progress and repair, risks, review, revision
  lib/ingest.js         reading pasted syllabus text (for review before saving)
  lib/plans.js          Free / Plus / Pro and their limits
server/
  index.js              local server: login, sync, live updates, Yuuki AI proxy, MCP over HTTP
  stdio.js              MCP over stdio for AI apps
  connections.js        connection keys and permissions for AI apps
  planner.js, plans.js  Mission Planner service and saved plans
  entitlements.js       plan checks and usage counters
  mcpTools.js, mcp.js   MCP tools, prompts and instructions
  llm.js                Groq, Gemini and OpenRouter with fallback
data/                   each account's data, plans, keys and usage (not committed)
data-sandbox/           the same for --sandbox (not committed)
```

## Tests

```bash
npm test
```

There are 118 tests covering:

- dates, progress, readiness, streaks and "up next";
- every data operation, the merge and the AI tools;
- Yuuki's AI loop, her prompt and tool choice, and provider fallback, rate limits and used-up quotas (with fake models);
- revision (spaced, by confidence), quizzes (reading and checking AI-written questions) and reading real university syllabi;
- the Mission Planner: plans that fit or don't, exams close together, missed days, scenarios, validation of AI-written plans, applying once, repair, risks and the weekly review;
- the server: login, sync and merge, host check, connection keys and permissions, account isolation, plan limits, and both MCP transports end to end.

## Deploy (free)

StudySync runs as one Node web service (the app, sync, Mission Planner, Yuuki's AI and MCP), so it needs a host that keeps a server running. It is set up for **Render**:

1. Push the repo to GitHub and create a **Web Service** on https://render.com from it.
2. Build command `npm ci && npm run build`, start command `npm start`, Node 22 or newer.
3. Under Environment, add:
   - `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`: Yuuki's AI (any one works; more gives fallbacks).
   - `STUDYSYNC_SECRET`: any long random text, used to sign logins.
   - `STUDYSYNC_DEMO_PLANS=true`: shows the Free / Plus / Pro demo switch.
   - `STUDYSYNC_SEED_DEMO=jelly`: fills the demo account with a sample semester whenever the server starts with no data.

Render sets `RENDER`, `PORT` and `RENDER_EXTERNAL_HOSTNAME`; the server then listens publicly, accepts only its own address, and Connect AI shows the online setup (Claude Code over HTTP, Claude Desktop through `mcp-remote`).

On the free plan the service sleeps after 15 minutes without visitors (the first visit then takes about a minute) and its files are wiped on restart. Each browser keeps its own copy and syncs it back, and the demo account is refilled. Vercel is not a fit: it runs short-lived functions, so live sync and MCP would not work.

## Not built (on purpose)

- Sign-up and password reset.
- Payments. Plans and limits work, but nothing can be bought.
- Reminders when the app is closed.
- Syncing across devices without your own server.
- Reading syllabus PDFs inside the app. Paste the text instead (you check it before it's added), or let Claude read the PDF and call `add_subject` for you.
