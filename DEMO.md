# Class demo guide

Everything here runs on the **demo copy** of StudySync (the sandbox), so your
real account and data are never touched.

## Before class (5 minutes)

1. Connect to the internet (Yuuki's AI and Quiz me need it; everything else works offline).
2. In the project folder:
   ```bash
   npm.cmd run demo
   ```
   Leave this window open. The app is at **http://localhost:8788**.
3. In a second terminal:
   ```bash
   npm.cmd run demo:reset
   npm.cmd run demo:check
   ```
   Wait for **"Ready for class."** Add `-- --intro` to the reset (`npm.cmd run demo:reset -- --intro`) if you want Yuuki to introduce herself when you log in.
4. Open http://localhost:8788 in Chrome, log in with the demo account (`jelly`), and click through each page once.
5. Keep `video/out/studysync-intro.mp4` ready as a backup if the laptop or Wi-Fi misbehaves.

After a rehearsal, run `npm.cmd run demo:reset` again for a clean start.

## What to show (feature map)

Use this to split the presentation between the three of you. Everything listed is built and tested.

| Feature | Where | What makes it stand out |
|---|---|---|
| **Overview** | Home | Today's goal ring, streak, syllabus %, "Heads up" risks, exam countdown |
| **Today** | Today | Next block with a one-tap focus timer; focus queue; **Revise today** (spaced revision) |
| **Subjects and syllabus** | Subjects › a subject | Topic checklist, "how sure are you?" on every topic, **paste a syllabus from a university PDF and review it before adding** |
| **Quiz me** | Revise today, a subject's ticked topics, or an exam card | Yuuki writes 3 exam-level questions from *your* syllabus; a second AI model checks the answers; your score sets readiness and the next revision date |
| **Exams** | Exams | Countdown, readiness from covered topics, shaky topics and quiz scores |
| **Mission Planner** | Mission Planner | Plans the week or an exam around blocks you already have, says honestly if it **fits / is tight / doesn't fit**, nothing changes until you approve, repair after missed days, compare study times |
| **Risk radar** | Mission Planner | What could go wrong soon, why, and a one-click fix |
| **Yuuki (AI companion)** | Her corner button, or Ctrl+J | Answers about *your* semester and acts: "add 1 hour of DBMS revision tomorrow at 6 pm" really adds it (with Undo) |
| **Connect AI (MCP)** | Connect AI | Claude Desktop / Claude Code can read your semester and plan with you, with per-app keys and permissions |
| **Business model** | Settings › Plan and usage | Free / Plus ₹149 / Pro ₹299, limits enforced on the server, demo switch to show Plus features |
| **Phone** | Any page on a phone, or Chrome's device mode | Fully responsive; can be installed to the home screen |
| **Quick jump** | Ctrl+K | Jump anywhere |

## Good live moments

- Ask Yuuki: *"what should I study tonight?"*, then *"add 1 hour of DBMS revision tomorrow at 6pm"*, and show the block appear in Today.
- Mission Planner: **Draft my plan**, point at the verdict, then **Approve**.
- **Quiz me** on the next exam: it takes about 10–15 seconds to write the questions, so talk over it ("it's writing questions from our real syllabus, then a second AI double-checks the answers").
- Settings › Plan and usage: switch to **Free** to show what's limited, then back to **Plus**.

## If something goes wrong

- **Yuuki says she's busy:** the free AI models are rate-limited. Wait 30 seconds or show something else; her basic answers still work.
- **No internet:** everything except Yuuki's AI chat and Quiz me still works.
- **The page looks stuck:** refresh. Data is saved on the demo server.
- **Start over:** `npm.cmd run demo:reset`.

## For the team (developers)

- `node video/scripts/smoke.mjs` checks every page on desktop and phone, plus the live actions, in headless Chrome (needs `npm install` in `video/` once).
- `node video/scripts/quiz-e2e.mjs` takes a full quiz end to end.
- `npm.cmd test` runs the 118 automated tests.
