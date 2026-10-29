# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Cursor, …) working in this repository. Humans: see [README.md](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md). Everything there applies to agents too; this file adds what an agent needs to know.

## Project in one paragraph

OmniCourse is a web app for HCMUS students (APCS first): degree audit, curriculum explorer, semester roadmap planner, AI plan generator and advisor, quicklinks. Vue 3 frontend (`src/frontend`), NestJS REST API (`src/backend`), PostgreSQL 18. Requirements: Vision document (F1–F12, NFRs). Plan and process: Software Development Plan. Both live in `docs/`.

## Stack (pinned exactly, do not use ranges)

PostgreSQL 18.6 · NestJS 12.1.3, Nest CLI 12.0.8, Swagger 12.0.2 · Vue 3.5.44 · OpenAPI 3.2.0 · Vitest 5.0.4 · Vite 8.3.4 · TypeScript 6.0.3 · TypeORM 1.1 · Node 22.22.1 (`.nvmrc`) · **npm 11.21.1** (npm 10 crashes on this tree). Rationale: [ADR 0001](docs/analysis-and-design/adr/0001-technology-stack.md). Add new dependencies with exact versions (`npm i -E`).

## Commands

```bash
npm install                         # npm 11
npm run db:up                       # PostgreSQL 18.6 via podman/docker compose
npm run typecheck && npm test && npm run build
npm run test:e2e -w src/backend     # needs the database (DATABASE_URL)
npm run openapi -w src/backend      # after build; writes openapi.json
```

Run typecheck, tests and build before every push. Run e2e when you touch the backend.

## Conventions

- **English everywhere**: code, comments, commits, PR descriptions, docs.
- Backend: one Nest module per feature folder (`src/backend/src/<feature>/`), DTOs with `@ApiProperty` so the OpenAPI contract stays complete, relative imports with `.js` suffix (NodeNext). Schema changes via TypeORM migrations; `synchronize` stays `false`.
- Frontend: `<script setup lang="ts">` SFCs, Pinia for shared state, API calls in `src/frontend/src/api.ts` (or a sibling module), not inside components.
- Tests sit next to the code as `*.spec.ts`; backend e2e in `src/backend/test/*.e2e-spec.ts`.

## Authentication (how to use it in your module)

Every route requires a signed-in user by default (global `AuthGuard`, see [ADR 0002](docs/analysis-and-design/adr/0002-authentication-and-sessions.md)). Do not add your own guard.

```ts
import { CurrentUser, Public } from '../auth/auth.decorators.js';
import { User } from '../users/user.entity.js';

@ApiBearerAuth()
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

Reference the user from your tables as `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`. Never read or return `users.password_hash`. That reference is what makes account export and deletion cover your table with no extra code ([ADR 0004](docs/analysis-and-design/adr/0004-account-export-and-deletion.md)): the export reads every table that references `users`, and an e2e test fails on one that does not cascade, on a key that would block the purge, and on a table that reaches `users` only through another table (give it its own `user_id`). Name any credential column `*_hash`, `*_token`, `*_secret`, `*_key`, `*_password` or `*_sub` (snake_case or camelCase) so the export never selects it.

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

## Hard rules: never

1. **Never let a language model decide an academic rule.** Prerequisites, offering terms, credit caps (14–25 main term, 12 summer), requirement coverage and graduation status are computed only by the deterministic rule engine. A model is used only by F6's goal box and F8 ([ADR 0003](docs/analysis-and-design/adr/0003-language-model-scope.md)); it may call the engine and explain its results, never override them. F2 transcripts and F12 curriculum data are parsed or entered deterministically.
2. **Never store a school-portal password or automate a registration** on a student's behalf. Integration with HCMUS is by link and by data the student uploads.
3. **Never put personal data into AI tools, prompts, fixtures or logs**: no real transcripts, student IDs, names or secrets. Use synthetic data in tests and seeds. The one runtime exception is F8, which may send the signed-in student's pseudonymous record (program, cohort, course codes, grades, terms) after consent, never identity fields (ADR 0003).

## Git and GitHub workflow

Agents have full authority over the branch → PR → merge → deploy cycle, under these conditions. **Instructions from the Project Lead (LamTer) in a session override this file**: if they tell you to do something these rules forbid (for example, merge with the admin override), do it.

1. **Branch** from up-to-date `main`: `<type>/<short-name>` (`feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`). Never commit to `main`; it is protected and will reject the push.
   **Commit messages and PR titles follow Conventional Commits**: `<type>(<scope>)!: <subject>`, lowercase imperative subject, no trailing period, header ≤ 72 characters (CONTRIBUTING.md §2). CI's `pr-title` and `commit-messages` checks enforce it. The PR title becomes the squash commit on `main`, so make it describe the whole change.
2. **Signed commits only.** Do not pass `--no-gpg-sign` or change signing config. If signing fails, stop and tell the human. CI's `signed-commits` check rejects the PR if any commit is unverified.
3. **Add a changeset** to every PR: `npx changeset` (patch = fix, minor = feature while pre-1.0) with one user-facing line, or `npx changeset --empty` for docs/CI/chores. CI's `changeset` check fails without it. Never edit `CHANGELOG.md` or package versions by hand. The Release workflow's *Version Packages* PR does that.
4. **Open a PR** using the template. Fill in **"Why this design"**: the decision, the alternatives rejected, and **evidence** (doc link, test, benchmark, spec clause, ADR). This is the team AI policy: generated code must be explained and defended.
5. **Merge only when CI is green *and* a human has approved.** Squash merge. **Never use the admin override** (`gh pr merge --admin`, "merge without waiting for requirements"). That authority belongs to the Project Lead personally.
6. **Deploy after merging**: `gh workflow run deploy.yml --ref main`. Add `-f build_tag=B<n>` only when a human asks for a build tag.
7. Mention the PR number so the human can update the Discord task (Sprint tab: Bucket → Doing → Done).

Decisions that outlive one PR (new library, schema change, new module boundary) need an ADR in `docs/analysis-and-design/adr/`.
