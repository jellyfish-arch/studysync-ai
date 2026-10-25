# Yuuki's AI models

Yuuki's chat uses free model tiers from three providers. This page records
which models were chosen, why, and how they were tested (October 2026). Free
tiers change often, so re-run the checks below every few months.

## What Yuuki needs from a model

- **Tool calling** that works: she adds exams, plans blocks and ticks topics through 18 tools.
- **Short, warm, plain-text replies** that follow her personality prompt.
- **No leaked reasoning.** Several free "thinking" models print their thoughts into the answer.
- **Speed**, since she's a chat companion: a few seconds at most.
- **Enough free allowance** for one request of about 4,000 tokens (prompt, data snapshot and tool definitions), sent once or twice per message.

## The choice

| Order | Provider | Model | Why |
|---|---|---|---|
| 1 | Groq | `openai/gpt-oss-120b` | Best replies and correct tool calls in testing, about 1-2 s. Limit: about 8,000 tokens a minute and 200,000 a day on the free tier, so roughly one tool-using message a minute. |
| 2 | OpenRouter | `nvidia/nemotron-3-super-120b-a12b:free` | Did every test task correctly, including recovering from its own wrong subject name. 2-18 s. About 50 free requests a day without credits. |
| 3 | Gemini | `gemini-3.1-flash-lite` | Correct tool calls and good replies at about 3 s, and the biggest free daily allowance. It's third because in testing it often returned "high demand" errors or took 40+ seconds. |

The server (`server/llm.js`) tries them in that order and:

- **stays under Groq's per-minute token limit itself**, skipping Groq before it would fail instead of waiting for a 429;
- **skips a provider that just said "rate-limited" or "busy"** for a minute, or for 30 minutes after a daily quota runs out;
- asks reasoning models to **think briefly and keep the thinking hidden**, and retries once without those options if a model doesn't know them;
- **cleans every reply**: removes leaked `<think>` blocks, markdown emphasis and emojis.

Change the models or order in `.env` with `GROQ_MODEL`, `OPENROUTER_MODEL`, `GEMINI_MODEL` and `AI_PROVIDER_ORDER`. Run `npm run ai:check` to test the keys.

## How they were tested

Each candidate ran Yuuki's real system prompt and tools (`src/yuuki/persona.js`) against a realistic test semester, through the same tool loop the app uses. There were four tasks:

1. "ugh yuuki i'm so stressed, exams next week and i've barely started anything": should be warm and concrete, with no tool changes.
2. Add a DBMS quiz on a given date: should call `add_exam` correctly.
3. "plan 2 hours of DBMS normalisation revision tomorrow at 6pm": should call `plan_study_blocks` correctly.
4. "how ready am i for the OS midsem honestly": should give an honest answer from the data.

| Model | Result |
|---|---|
| Groq gpt-oss-120b | Best tone, correct tools, 1-2 s. Hit the per-minute token limit on the next task. |
| Groq gpt-oss-20b | Fine tone, same rate limits. |
| Groq qwen3.8-27b | The request was too large for its free per-minute limit. |
| Gemini 3.1 Flash-Lite | All correct and about 3 s on the first run. A later run took 39-50 s, then "high demand". |
| Gemini 3.5 Flash-Lite, 3.8 Flash | 88 s, or "high demand" errors. |
| OpenRouter Nemotron 3 Super | All four correct, 9-18 s. Once used an emoji; the server now strips them. |
| OpenRouter Nemotron 3.5 Lightning | Correct, but wordy and used markdown. |
| OpenRouter Gemma 4 31B | Rate-limited upstream. |
| OpenRouter Inkling | Only allowed in "agentic harnesses". |
| `openrouter/free` (auto router) | Picked a reasoning model that printed its thinking. |

**Things the testing changed:**

- Models got weekdays wrong ("Sun 23 Oct" for a Friday), so the prompt now includes a two-week calendar.
- A model copied an example sentence from the prompt word for word, so the prompt no longer contains example phrases.
- Requests were cut from about 5,000 to about 4,000 tokens by not sending tools Yuuki doesn't need. Delete tools are only included when the student talks about removing something.
- Subjects written as "Database Management Systems (CS502)" are now understood.

**Live check in the app (sandbox, phone-sized screen):**
- A stressed "what should I do tonight" got a concrete three-step plan.
- "Add a TOC quiz on Friday the 23rd … and block 1 hour tomorrow at 7pm" added both correctly, using one message of the daily allowance.

## Yuuki's personality

The prompt is in `src/yuuki/persona.js`. In short:
- She's a cheerful, warm, slightly playful senior who is always on the student's side.
- She names real effort and never guilt-trips.
- She's calm when the student is stressed, and honest about what fits.
- She writes in plain text, usually under 70 words, with human dates and no IDs.
- She does what's asked with tools and confirms in one line.

The "Brief" talk style in Settings shortens her replies.

## Sources (October 2026)

Third-party summaries, which sometimes disagree; check each provider's console for your real limits:

- Groq free tier: [eesel.ai](https://www.eesel.ai/blog/groq-pricing), [benchlm.ai](https://benchlm.ai/free-tier/groq), [ampm-aiops.com](https://ampm-aiops.com/en/guides/groq-free-tier-llama-removed-gpt-oss-2026/)
- Gemini free tier: [aiplug.work](https://aiplug.work/en/blog/gemini-free-tier-limits), [tinkerllm.com](https://tinkerllm.com/blog/gemini-api-free-tier-limits-rate-quotas/)
- OpenRouter free models: [openrouter.ai tool-calling collection](https://openrouter.ai/collections/tool-calling-models), [openrouter.ai free models](https://openrouter.ai/collections/free-models), [aitoolsradar.org](https://aitoolsradar.org/blog/guides/openrouter-free-models-2026/)
- ChatGPT and MCP: [peliqan.io](https://peliqan.io/blog/chatgpt-mcp/), [designrevision.com](https://designrevision.com/blog/add-mcp-server-to-chatgpt)
