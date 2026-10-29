# ADR 0003: Where a language model is used

- Status: accepted
- Date: 2026-10-24
- Deciders: Lâm (Project Lead)
- Informed: Triết, Hoà (Vision v2), Dũng (F8), Thắng (F12)

## Context

Vision v1.0 §5 puts a language model in four features: F2 (transcript extraction), F6 (AI plan generator), F8 (advisor chat) and F12 (curriculum PDF import). Reading academic data is a human and deterministic job: AGENTS.md hard rule 1 already gives every academic rule to the rule engine. A model in F2 or F12 would sit between the source document and that engine, where its errors are silent.

## Decisions

| Decision | Alternatives rejected | Evidence |
| --- | --- | --- |
| **F12 curriculum data is entered by people** (seed files, admin UI); no PDF-to-data import | Model drafts curriculum rows for review | A curriculum row decides graduation status. Thắng enters it, Triết checks it line by line against the official PDF (Work Breakdown, 8 Nov). A reviewed model draft still invites rubber-stamping. |
| **F2 transcript import is a deterministic parser**, with manual entry as the fallback | Model extraction with a low-confidence review screen (Vision F2) | A parser is exact and unit-testable, with no per-upload cost and no transcript sent to a third party. |
| **F6 plans are built by a deterministic planner over the rule engine.** A model only turns a plain-language **planning goal** into planner inputs and explains the result | Agentic model that places courses and repairs violations (Vision F6) | Placement is an academic decision (hard rule 1). The goal box keeps the "AI planner" positioning and adds no rule risk: the student sees the inputs it produced before planning. |
| **F8 advisor chat keeps the model**, answering from the regulations with the document and clause cited | Drop F8, or a plain search over regulations | Free-text questions cannot be answered by hand-written code; citations let the student check every answer. |

## The `ai` gateway

| Decision | Alternatives rejected | Evidence |
| --- | --- | --- |
| **Two operations**: `structured({ instructions, input, schema })` returns typed JSON (goal box); `chat({ messages, tools? })` serves F8 | One raw `complete()`; a general agent loop | Only two callers remain. Each gets a typed call, and nothing is built ahead of a feature that needs it. |
| **OpenRouter**, reached with the `openai` SDK (pinned) via `baseURL` | Anthropic API direct; Gemini; plain `fetch`; `@openrouter/sdk` | One key and one bill for any model, so a model can change without code. OpenRouter is OpenAI-compatible, so the SDK gives typed tool calls, `response_format` and streaming. |
| **No training on prompts via the OpenRouter account privacy setting** (training opt-out) | Per-request `provider: { data_collection: "deny", zdr: true }` | OpenRouter: "If you opt out of training in your account settings, OpenRouter will not route to providers that train" ([privacy docs](https://openrouter.ai/docs/features/privacy-and-logging)). Trade-off accepted: the setting is invisible to code review and tests, and providers may still retain prompts for a while (no ZDR). |
| **Paid models chosen by env**: `AI_MODEL_STRUCTURED` (small model, goal box) and `AI_MODEL_CHAT` (stronger model, F8) | One model for both; `:free` models | Free models usually log or train, which the privacy NFR forbids. A small model is enough to fill a form from a sentence. |
| **zod 4 schemas** for `structured()`: `z.toJSONSchema` gives the schema sent to the model, `parse` validates the reply | class-validator DTOs | Model output is untrusted input, so it is always parsed. One schema serves both jobs; class-validator has no native JSON Schema output. |
| **F8 sends a pseudonymous record**: program, cohort, course codes, grades, terms. Never name, email or student ID. The student consents once before first use; prompt and response content is never logged | No record; full record | Keeps AGENTS.md hard rule 3 intact for identity data while the advisor can still answer "can I take X next term?". |
| **One failure type**: `AiUnavailableError` → HTTP 503 `ai_unavailable`, for no key, timeout (30 s default, per HTTP request: one call can make several requests, and the SDK retries a timed-out one once), provider error after one retry on 429/5xx, or a spent budget. The goal box falls back to the plain form; F8 says the advisor is unavailable | One error per cause | Robustness NFR: manual planning keeps working. Callers handle one case. |
| **Cost guard**: per-user daily cap on AI calls (default 20, env), a monthly credit limit on the OpenRouter key, and a usage row per call with no content (user, feature, model, tokens, latency). A call counts once it reaches the model, even if the student stops it | Key limit only; no guard until Sprint 5 | The URL is public. Without a per-user cap, one user can spend the month's credit for everyone. |
| **Feature owners write their prompts, schemas and tools** (Lâm: goal box in `ai-planner`; Dũng: F8 in `advisor`). The gateway is transport only | Gateway owner writes every prompt | Work Breakdown rule 2, one folder one owner. Prompts change weekly; the gateway contract should not. |
| **F8 answers stream**: `chat()` yields events; the API sends `text/event-stream` over POST, read with `fetch` | Whole answer after a spinner | A 15 s answer shows its first words in about a second. `EventSource` cannot send the bearer header (ADR 0002), so the client reads the stream with `fetch`. |
| **The gateway runs F8's tool loop**: `chat({ messages, tools: [{ name, description, schema, handler }], maxSteps: 5 })` calls the handlers, feeds results back and streams the final answer | `chat()` returns tool calls and `advisor` loops | The loop's edge cases (bad arguments, step limit, a tool throwing) are solved once. Dũng writes only the handlers. |
| **The goal box fills the planning-goal form**: target graduation term, credits per term, internship term, courses to take or avoid. The student reviews the prefilled form and presses Plan | The planner runs straight from the sentence | A misread sentence shows in the form before it shapes a plan. The planner clamps credits to the credit cap; the model never does. |
| **The deterministic planner is Lâm's `plan-generator` module** (renamed from `ai-planner`), placing courses over Triết's `RulesService`; the goal box sits on top | Inside `rules` (Triết); inside `plans` (Hoà) | Lâm owns F6. Placement is a search over valid plans, not a rule, so it stays out of the engine, and off the critical-path owner's desk. |
| **`FakeLlmService` with scripted replies** for every consumer's unit tests; CI never calls OpenRouter. `npm run test:live -w src/backend` runs one smoke test per operation when `OPENROUTER_API_KEY` is set | Live calls in CI | CI stays free, deterministic and secret-free; teammates test before the real adapter exists. |

## Consequences

- The `ai` gateway serves only F6's goal box and F8. Thắng (F12) and Lâm (F2) no longer depend on it.
- Vision v2 (Hoà) must restate F2, F6 and F12; the Work Breakdown loses "curriculum PDF import" (Thắng, Sprint 4).
- Robustness NFR gets easier: only the goal box and the advisor go dark when the provider is down.
- The planner algorithm and F8's retrieval of regulation clauses are separate designs, owned by Lâm and Dũng.
- Open: confirm on one real portal transcript, locally, that the PDF has a text layer and a fixed layout before Sprint 4.

## Notes

- 2026-10-29 (Lâm): the curriculum seed files (`src/backend/src/database/seeds/`) were transcribed from the official PDFs by a model, and humans check every row against its printed page. This is allowed: it is a one-time dev-time seed reviewed like code, not a runtime import feature, and the deterministic rule engine still decides every rule.
