# StudySync MCP server

The MCP server lets an MCP-capable AI app on the same computer read and change
one StudySync account. The app's Connect AI page guides **Claude Desktop** and
**Claude Code**; other local MCP apps work with the same settings below. Whatever the AI changes shows up in the open app within a second, and
Yuuki mentions it.

In the app, **Connect AI** walks through this with your real paths filled in.
This page is the technical reference.

## How it works

```
AI app ──stdio──> server/stdio.js ──HTTP──> StudySync server (server/index.js) <──sync── the app in your browser
AI app ──HTTP───> http://localhost:8787/mcp ────────┘          │
                                                     data/<username>.json, data/<username>.plans.json
```

- `npm run dev` starts the StudySync server on port 8787 next to the app.
- The stdio bridge starts that server in the background if it isn't running, and the server stops itself after 15 idle minutes.
- Data tools are defined once in `src/lib/tools.js` and run through the same `src/lib/ops.js` as the app's own buttons. Planning tools go through `server/planner.js`, the same service the Mission Planner page uses.
- The server only listens on 127.0.0.1 and rejects requests whose `Host` is not localhost, which blocks DNS rebinding.

## Connection keys

Every AI app gets its own **connection key**, made on the Connect AI page:

- Format `ssk_<id>_<secret>`. The secret is shown once; the server only keeps a SHA-256 hash (`data/.connections.json`).
- The key decides the account. There is no user name in the config, and a connected AI cannot switch accounts by passing a different user id.
- Each key has a **permission**, checked on every tool call:

| Permission | Can | Can't |
|---|---|---|
| Read only | All read tools, risks, plan checks | Change anything |
| Read and add | Add and edit, tick topics, log time, draft and apply mission plans | Delete anything |
| Full access | Also the delete tools | Switch accounts, change the plan or keys |

- Up to 10 keys per account. Disconnecting one revokes it at once and doesn't affect the others.
- Status on the Connect AI page is real: **Connected** means the key was used in the last 15 minutes (with the app's own name from the MCP handshake), **Idle** means used before, **Waiting** means never used.

## Connecting an app

**Claude Desktop** (Settings > Developer > Edit config), or any other local MCP app's config file:

```json
{
  "mcpServers": {
    "studysync": {
      "command": "node",
      "args": ["C:/path/to/StudySyncAi/server/stdio.js"],
      "env": { "STUDYSYNC_KEY": "ssk_..." }
    }
  }
}
```

**Claude Code:**

```bash
claude mcp add --env STUDYSYNC_KEY=ssk_... --transport stdio studysync -- node "C:/path/to/StudySyncAi/server/stdio.js"
```

**Apps that take a URL** (Streamable HTTP, stateless): `http://localhost:8787/mcp` with the header `Authorization: Bearer ssk_...`.

Without a key, the stdio bridge still starts but only offers a `connection_help` tool that explains how to get one.

### What has been verified

- A real MCP client (the official SDK's stdio client) connecting through `server/stdio.js` with a key made in the app: tools listed, reads and writes worked, the change appeared live in the open app, and the Connect AI page flipped to Connected.
- Key isolation, permissions and plan limits are covered by `tests/server.test.js`.
- **Not yet verified inside the real Claude Desktop app.** The config above follows its documented format.

### Local vs. remote

Run locally, this server is for apps **on the same computer**. The online prototype (on Render) serves the same endpoint at `https://<its address>/mcp`, and Connect AI then shows the online setup:

```bash
claude mcp add --transport http studysync https://<its address>/mcp --header "Authorization: Bearer ssk_..."
```

Claude Desktop reaches it through `npx -y mcp-remote <url> --header "Authorization:${AUTH_HEADER}"` with `AUTH_HEADER` set to `Bearer ssk_...` in the config's `env`.

ChatGPT, claude.ai and phone apps still say "not yet", because they sign in with OAuth instead of a key. Supporting them properly needs:

- real accounts and sign-in (not the two built-in test accounts),
- OAuth 2.1 authorization for MCP clients, as the MCP spec requires for remote servers,
- TLS, per-user data isolation in a real database, rate limits and audit logs,
- a way to revoke a client's access from the app.

None of that is built, so the app says "not yet" for those clients.

## Tools

### Data tools

| Kind | Tools | Permission |
|---|---|---|
| Read | `get_overview`, `get_subject`, `get_schedule`, `get_study_stats`, `list_exams`, `list_assignments` | Read only |
| Subjects and syllabus | `add_subject` (optionally with syllabus text), `update_subject`, `add_unit`, `add_topics`, `set_topic_done`, `import_syllabus` | Read and add |
| Revision | `rate_topic` (shaky, ok or solid), `mark_topic_revised` | Read and add |
| Exams, assignments | `add_exam`, `update_exam`, `add_assignment`, `update_assignment` | Read and add |
| Timeline | `plan_study_blocks`, `update_study_block`, `complete_study_block`, `log_study_time` | Read and add |
| You | `update_profile`, `update_preferences` | Read and add |
| Delete | `delete_subject`, `delete_unit`, `delete_topic`, `delete_exam`, `delete_assignment`, `delete_study_block` | Full access |

`import_syllabus` uses the same parser as the app's paste-and-review screen: it skips course codes, hours and reading lists. Delete tools carry the MCP `destructiveHint`, so clients ask before running them. Subjects can be named the way people say them: "DBMS", "CS502" and "operating systems" all work.

### Mission Planner tools

| Tool | What it does | Plan |
|---|---|---|
| `build_academic_context` | Remaining topics, exams, deadlines, free time and history for a goal | Free |
| `analyze_academic_risks` | The risk radar: close exams at low readiness, overdue work, pile-ups | Free |
| `validate_plan_feasibility` | Checks a stored plan, or a plan the AI wrote itself, for clashes, past days, work after the exam, unknown subjects | Free |
| `review_plan_outcomes` | Plan versus reality for active missions | Free |
| `list_mission_plans` | Saved missions and their state | Free |
| `generate_mission_plan` | Drafts a plan. It is saved as a **draft**; nothing touches the calendar | Plus |
| `simulate_schedule_scenarios` | Same goal, different study times or strategies, nothing saved | Plus |
| `propose_plan_repair` | Re-plans an active mission from today, as a proposal with a diff | Plus |
| `apply_plan_changes` | Adds an approved plan's blocks. Requires `approved_by_student: true`, re-validates first, and applying twice does nothing | Plus |

Plans are made by a deterministic engine (`src/lib/planner/`), not by a language model, so the same data gives the same plan. A plan an AI writes on its own is treated as an untrusted proposal: `validate_plan_feasibility` checks it against the real calendar before anything is saved.

### Prompts

`plan_my_week`, `exam_prep`, `recover_missed_schedule`, `review_progress`, `add_syllabus`. In Claude they appear as slash commands.

## Limits

Each tool checks the account's plan on the server (see `docs/monetization.md`). On Free, AI apps can read everything and make 30 changes a day; planning tools need Plus. A refused call comes back as a normal tool error with the plan it needs, so the AI can explain it.

## Try it

```text
Look at my StudySync and tell me what's at risk this week.
Add Operating Systems (CS501) with this syllabus: <paste>
Plan my week around the DBMS quiz, then show me the plan before applying it.
```

## Ideas for later

1. **Syllabus from a PDF.** The AI app reads the PDF you drop into the chat and calls `add_subject` with the text. Works today without code changes; StudySync itself doesn't read documents yet.
2. **Resources.** Expose `studysync://today` and `studysync://exam/<id>` so clients can attach context without a tool call.
3. **Timetable import.** Turn a class timetable into recurring busy time. Needs repeating blocks in the data model.
4. **Daily check-in.** A prompt that asks how the day went, logs time and moves unfinished blocks.
