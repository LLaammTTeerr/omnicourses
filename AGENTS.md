# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Cursor, …) working in this repository. Humans: see [README.md](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md). Everything there applies to agents too; this file adds what an agent needs to know.

## Project in one paragraph

OmniCourse is a web app for HCMUS students (APCS first): degree audit, curriculum explorer, semester roadmap planner, AI plan generator and advisor, quicklinks. Vue 3 frontend (`src/frontend`), NestJS REST API (`src/backend`), PostgreSQL 18. Requirements: Vision document (F1–F12, NFRs). Plan and process: Software Development Plan. Both live in `report/` (the Vision: `report/assignments/PA2/Vision.tex`). What is built today: the feature table in [README.md](README.md#what-is-built).

## Stack (pinned exactly, do not use ranges)

PostgreSQL 18.6 · NestJS 12.1.3, Nest CLI 12.0.8, Swagger 12.0.2 · Vue 3.5.44 · OpenAPI 3.2.0 · Vitest 5.0.4 · Vite 8.3.4 · TypeScript 6.0.3 · TypeORM 1.1 · Node 22.22.1 (`.nvmrc`) · **npm 11.21.1** (npm 10 crashes on this tree). Rationale: [ADR 0001](docs/analysis-and-design/adr/0001-technology-stack.md). Add new dependencies with exact versions (`npm i -E`).

## Commands

```bash
npm install                         # npm 11
npm run db:up                       # PostgreSQL 18.6 via podman/docker compose
npm run typecheck && npm test && npm run build
npm run test:e2e -w src/backend     # needs the database (DATABASE_URL)
npm run openapi -w src/backend      # after build; rewrites the committed openapi.json
```

Run typecheck, tests and build before every push. Run e2e when you touch the backend.

## Conventions

- **English everywhere**: code, commits, PR descriptions, docs.
- **Code style**: one job per function, short functions, meaningful names, no magic numbers (name a constant), no repeated logic, and no needless splitting across files. **No comments**: the code is the source of truth. A fact the code cannot show goes into a name, a constant, an ADR or a doc.
- Backend: one Nest module per feature folder (`src/backend/src/<feature>/`), listed in `src/features.ts` (the app and the OpenAPI contract both load that list). The module registers its own entities with `TypeOrmModule.forFeature`. DTOs with `@ApiProperty` so the OpenAPI contract stays complete, relative imports with `.js` suffix (NodeNext). Schema changes via TypeORM migrations, each added to `src/database/migrations/index.ts`; `synchronize` stays `false`. Read settings through the getters in `src/config/env.ts`, not `process.env`. Seed data: export `seed(dataSource, options)` from your feature and call it from `src/database/seed.ts`.
- `src/backend/openapi.json` is committed: after an API change, run `npm run build && npm run openapi -w src/backend` and commit the result, or a unit test fails.
- Frontend: `<script setup lang="ts">` SFCs, Pinia for shared state, API calls in `src/frontend/src/api.ts` (or a sibling module), not inside components.
- Tests sit next to the code as `*.spec.ts`; backend e2e in `src/backend/test/*.e2e-spec.ts`, booting the app and users through `src/backend/test/support/`.
- Guides (F11) may be drafted or translated with an AI tool. Every portal address, label and step still comes from the school's pages or the portal, checked by a person who records "Last checked".

## Authentication (how to use it in your module)

Every route requires a signed-in user by default (global `AuthGuard`, see [ADR 0002](docs/analysis-and-design/adr/0002-authentication-and-sessions.md)). Do not add your own guard.

```ts
import { Authenticated, CurrentUser, Public } from '../auth/auth.decorators.js';
import { User } from '../users/user.entity.js';

@Authenticated()                             // documents the bearer token and the 401
@Controller('plans')
export class PlansController {
  @Get()
  list(@CurrentUser() user: User) {          // the signed-in user, never null here
    return this.plans.listFor(user.id);
  }

  @Public()                                  // only for routes anyone may call
  @Get('shared/:token')
  shared(@Param('token') token: string) { … }
}
```

Reference the user from your tables as `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`. Never read or return `users.password_hash`. That reference is what makes account export and deletion cover your table with no extra code ([ADR 0004](docs/analysis-and-design/adr/0004-account-export-and-deletion.md)): the export reads the rows whose `user_id` is the student (rows that only reference them in another column are someone else's), and an e2e test fails on a `user_id` key that does not cascade, on a key to `users` in another column (`reviewed_by`, `viewer_id`) that is neither `ON DELETE SET NULL` nor `CASCADE` (prefer `SET NULL`: the row is someone else's), on a key that would block the purge, and on a table that reaches `users` only through another table (give it its own `user_id`). Name any credential column `*_hash`, `*_token`, `*_secret`, `*_key`, `*_password`, `*_sub`, `*_salt` or `*_seed` (snake_case or camelCase) so the export never selects it.

## AI gateway (how to use it in your module)

A model is allowed only in F6's goal box and F8 ([ADR 0003](docs/analysis-and-design/adr/0003-language-model-scope.md)). Import `AiModule`, inject `LlmService`, and write your prompt, zod schema and tools in your own module.

```ts
const goal = await this.llm.structured({
  context: { userId: user.id, feature: 'goal-box' },
  instructions: GOAL_PROMPT,
  input: dto.sentence,
  schema: PlanningGoalSchema,          // zod; .nullable(), not .optional()
});

@Post('ask')                           // F8: stream with streamChat, read it with fetch
ask(@CurrentUser() user: User, @Body() dto: AskDto, @Res() res: Response) {   // AskDto: @IsIn(['user', 'assistant']) on role
  return streamChat(res, this.llm.chat({ context: { userId: user.id, feature: 'advisor' }, instructions, messages: dto.messages, tools }));
}
```

- Every failure is `AiUnavailableError` → **503 `ai_unavailable`**. Give each AI screen a manual path. Document it with `@ApiServiceUnavailableResponse({ type: AiUnavailableDto })`.
- A tool handler gets only the arguments the model wrote. Build the tools per request and close over the signed-in `user`; never take a user id from the arguments.
- Validate the role of each chat message with `@IsIn(['user', 'assistant'])`. The gateway also drops any other role, so a client cannot inject a system message.
- Unit tests use `FakeLlmService` (`src/ai/testing/`). CI never calls OpenRouter. `npm run test:live -w src/backend` is the manual smoke test and spends credit.
- Calls are capped per user per day (`AI_DAILY_CALLS_PER_USER`). A call counts once it reaches the model, even if the student disconnects, times out or gets a provider 5xx. One that fails before (no key, no model) does not, and neither does one the provider refused without billing (wrong key, no credit, rate limit): the gateway releases its row. Usage rows hold no content. Never log a prompt, a reply, tool arguments or a provider error message.
- Two settings in the OpenRouter dashboard carry ADR 0003's guarantees. The Project Lead keeps them on: **Settings → Privacy → training opt-out**, and **a monthly credit limit on the API key**.

## Testing

**Every behaviour change ships with a Vitest test**, and every bug fix with a test that failed before the fix. The rule engine must keep **≥ 80 % statement coverage** (Vision NFR). Never delete or weaken a test to make CI pass.

## Agent skills

Configuration for the `mattpocock-skills` engineering skills (`/to-spec`, `/to-tickets`, `/triage`, `/wayfinder`, `/implement`, `/grill-with-docs`, `/code-review`, `/pr`, …).

### Issue tracker

GitHub Issues on this repo via `gh`; the Discord Sprint task links to the issue. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default roles, label string = role name (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` at the root, ADRs in `docs/analysis-and-design/adr/` (not `docs/adr/`). See `docs/agents/domain.md`.

### PR bodies

`.github/pull_request_template.md` already merges the `/pr` skill's Summary, Evidence and Merge Danger with this repo's required **Why this design**. Fill in that template.

## Terminology

Read each term in this sense in the docs, tasks and messages.

- **Backlog / Queue:** open ideas, tasks, leads and jobs waiting to be picked up: the open GitHub issues.
- **Ignore:** do not act on it. Forget it, as if it were not in your context.
- **Hold:** wait for the user's word before you go on. Do not act on it until the user says so.
- **Block:** mark a task as waiting on another task or a condition. Add the GitHub issue dependency (**Blocking** in `docs/agents/issue-tracker.md`), or a `Blocked by:` line at the top of the issue body for a condition.
- **Park:** close a task with a `PARKED:` verdict: `gh issue close <n> --reason "not planned" --comment "PARKED: <why, and what would reopen it>"`.
- **Adopt:** take up an idea or a lead as a task: give its issue a full spec in the body and the `ready-for-agent` or `ready-for-human` label.
- **Archive:** take an idea or note out of the open list with no plan to return: `gh issue close <n> --reason "not planned"`.

## Hard rules: never

1. **Never let a language model decide an academic rule.** Prerequisites, offering terms, credit caps by training type ([ADR 0012](docs/analysis-and-design/adr/0012-credit-caps-by-training-type.md)), requirement coverage and graduation status are computed only by the deterministic rule engine. A model is used only by F6's goal box and F8 ([ADR 0003](docs/analysis-and-design/adr/0003-language-model-scope.md)); it may call the engine and explain its results, never override them. F2 transcripts and F12 curriculum data are parsed or entered deterministically. APCS 2024 and 2025 courses have no prerequisites except CS469 before CS470 (Project Lead, 24 November 2026); never load the 2019 summary table or the 2021 course-description booklet as rules. A new academic rule needs an explicit answer from a person.
2. **Never store a school-portal password or automate a registration** on a student's behalf. Integration with HCMUS is by link and by data the student uploads.
3. **Never put personal data into AI tools, prompts, fixtures or logs**: no real transcripts, student IDs, names or secrets. Use synthetic data in tests and seeds. The one runtime exception is F8, which may send the signed-in student's pseudonymous record (program, cohort, course codes, grades, terms) after consent, never identity fields (ADR 0003).

## Git and GitHub workflow

[CONTRIBUTING.md](CONTRIBUTING.md) holds the workflow rules for everyone: branch names and Conventional Commits (§2), signing (§2), changesets, the PR template, review and rulesets (§3), merge, deploy and releases (§4), and the AI policy (§5). Follow it. This section adds only what is different for an agent.

Agents have full authority over the branch → PR → merge cycle, under these conditions. **Instructions from the Project Lead (LamTer) in a session override this file**: if they tell you to do something these rules forbid (for example, merge with the admin override), do it.

1. **Branch** from up-to-date `main`. Never commit to `main`; it is protected and will reject the push.
2. **Signed commits only.** Do not pass `--no-gpg-sign` or change signing config. If signing fails, stop and tell the human.
3. **Fill in "Why this design"** in the PR template: the decision, the alternatives rejected, and **evidence** (doc link, test, benchmark, spec clause, ADR). Generated code must be explained and defended.
4. **Merge only when CI is green *and* a human has approved.** Squash merge. **Never use the admin override** (`gh pr merge --admin`, "merge without waiting for requirements"). That authority belongs to the Project Lead personally.
5. **Production deploys by itself** after CI passes on `main`. Run `gh workflow run deploy.yml --ref main -f environment=production` by hand only in two cases: a human asks for a build tag (add `-f build_tag=B<n>`), or the automatic run was dropped. A manual run must name `environment=production`: the default, `staging`, fails on `main`.
6. Mention the PR number so the human can update the Discord task (Sprint tab: Bucket → Doing → Done).

GitHub behaviour that trips agents:
- Any push to an approved PR dismisses the approval. Put a reviewer's optional nits in a follow-up PR.
- Editing a PR description reruns the `pr-title` check. Wait for it before you merge.
- Any merge to `main` updates the Version Packages PR and dismisses its approvals. Merge nothing else while you collect them. That PR gets no CI from the bot's push: close and reopen it to run the checks.
- Run npm as `npx --yes npm@11.21.1` when the machine's own npm is older.

Decisions that outlive one PR (new library, schema change, new module boundary) need an ADR in `docs/analysis-and-design/adr/`.
