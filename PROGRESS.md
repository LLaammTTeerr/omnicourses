# Convergence mission: progress and recovery state

This file lives only on `refactor/converge`. It is the task pool and the recovery state of the mission in `/home/lamter/omnicourses/goal.txt`: converge the repo toward the simplest coherent architecture through small, verified, independently mergeable refactors. Public contract, rule-engine results and tests stay intact.

## How to resume

1. Read this file, then `git worktree list` and `git branch --list 'refactor/*'`.
2. The work lands as one stack of small pull requests (Lâm, 28 Nov 2026). Stack branches are `refactor/cv-NN-<topic>`: 01 is cut from `origin/main`, each later one from the one before it, and each PR's base is the branch below it. Batches may be built in parallel in their own worktrees (cut from the stack tip, with paths that overlap no other open batch), then cherry-picked onto the tip one at a time, verified, pushed and opened as the next layer.
   - Auto-merge (`gh pr merge N --auto --squash`) only on the bottom PR, whose base is `main`. A PR whose base is an unprotected branch would merge at once.
   - When the bottom PR is squash-merged: merge `origin/main` into the next branch (never rebase a pushed branch, never force-push), push, check its base is now `main`, then turn on auto-merge for it.
3. Install with `npx --yes npm@11.21.1 ci` (the machine's npm is 9; it rewrites the lockfile). Never commit a lockfile change.
4. Verify with `<scratchpad>/verify.sh <worktree> <database name>` (typecheck, lint, unit, build, e2e, openapi diff, browser). Each worktree uses its own database on the Postgres at `127.0.0.1:5432`.
5. A batch is done when: full verify passes, `src/backend/openapi.json` is byte-identical, an independent reviewer has read the diff, the commit is signed, and it carries a changeset (`--empty` when nothing user-facing changes).

## Boundaries

- Fixed: routes, DTO fields, status and error codes, columns, existing migrations, `openapi.json`, rule-engine results.
- Files owned by in-flight PRs are off limits: #214 (frontend `audit/Dashboard*`, `audit/api.ts`, `audit/dashboard*.ts`, `shell/icons.ts`, `testing/fetch.ts`), #166 (`curriculum-admin/csv-import.service*`, its e2e spec, ADR 0011, `docs/test/test-cases-b2.md`), #77 (`src/backend/src/advisor/**` and the files that PR lists).
- Earlier untangle passes: #56 to #58 (9 Nov) and #183 to #203 (26 Nov). Do not redo them.

## Baseline (main at 3c4da22, 28 Nov 2026)

All green: typecheck, lint, build, openapi unchanged. Backend unit 72 files / 1132 tests (statements 75.51 %, branches 76.18 %). Frontend unit 79 files / 1246 tests. Backend e2e 24 files / 364 tests (83 s). Browser 13 files / 68 tests. No pre-existing failure. One conditional skip: `ai/gateway.live-spec.ts` (needs a provider key, by design).

Import graph (production files): backend folder cycles `auth <-> users` and `curriculum <-> curriculum-admin <-> database`; one file cycle among the three curriculum entities (TypeORM relations). Frontend: the root folder holds shared leaves and the composition root, so every folder is in one cycle; two-way pairs `shell <-> admin/notifications/auth/components`, `auth <-> plans`, `plans <-> sharing`. Regenerate with `node <scratchpad>/depgraph.mjs <src dir>`.

## Task pool

Evidence for every item: the seven survey files (`<scratchpad>/survey/*.md`, findings with `path:line`). IDs: T tooling, BP backend platform, BD backend domain, BA backend admin/content, FK frontend kernel/platform, FP frontend planning, FA frontend admin/content. Status: todo, building, review, pushed (#PR), merged, deferred, rejected.

### The stack (bottom first)

| PR | Branch | Items | What changes | Risk | Status |
| --- | --- | --- | --- | --- | --- |
| 01 | cv-01-verify-and-lint-rules | T-1, T-2, FK-1 | One `npm run verify`; lint in the AGENTS.md commands; drop the unused openapi artifact step. `scripts/lint.mjs` gains: backend import-direction ratchet (today's edges allowed, new ones fail), frontend layers kernel <- features <- composition over the files where they are, `fetch(` only in api modules, every module registered; lint gets its own spec and also walks `src/backend/test`. | low | todo |
| 02 | cv-02-locks-and-seeds | BP-2, BA-3 | `common/advisory-locks.ts` owns every lock key (uniqueness spec). Curriculum seed data and loader move to `curriculum/seeds/`; `database/seed.ts` runs a list of seeders with one signature. Ends `curriculum <-> curriculum-admin <-> database`. | low | todo |
| 03 | cv-03-engine-vocabulary | BD-1, BP-6, BD-6 (CreditCapsDto only) | Rule-engine input types and the training-type / group-kind lists move to a pure `curriculum/curriculum-rules.ts`; the purity spec also walks type imports. `TermDto` moves to `terms/`; `common` and `config` become enforced leaves. | low | todo |
| 04 | cv-04-rules-one-derivation | BD-2 | One `courseStatus`, one `recordBefore`, two named prerequisite policies inside `rules/`. No result changes; existing specs pin it. | low | todo |
| 05 | cv-05-account-state | BP-1, BD-7 | `users/` owns "account pending deletion" (predicate, SQL fragment) and the student row lock; nine raw-SQL copies in five modules call it. | med | todo |
| 06 | cv-06-errors-and-limiter | BP-3, BP-4 | Coded API errors only through `common/api-errors.ts` (lint rule); the sign-in attempt limiter leaves `AuthService` and shares its numbers with `PASSWORD_LIMIT`. | low | todo |
| 07 | cv-07-admin-access | BA-1 step 2, BP-5 | The write gate, grants and 403 helpers become `admin-access/`; calendar and account stop importing `curriculum-admin`. Registries one entry per line; one `platformImports` for app and contract. | low | todo |
| 08 | cv-08-clc-seeds | BA-2 | Each CLC 2025 course written once; a specialisation lists only group membership and PDF pages. Proof: built seed arrays deep-equal before and after. Group membership stays explicit (no derived "free" group: that would be an academic assumption). | med | todo |
| 09 | cv-09-fe-kernel | FK-2/FP-3, FA-4, FK-7, FK-3 | `account-storage.ts` owns account-scoped browser keys (auth stops importing plans); grants store split so the shell does not import the admin stack; `ModalDialog` owns its busy text; the test-only route warm-up leaves `router.ts`. | low-med | todo |
| 10 | cv-10-plan-view | FP-2, FP-1 step 1, FP-7 | `plans/issue-view.ts` pure leaf; `sharing/view.ts` holds the shared page's view model (tested), the `toEngineIssue` adapter goes; dead sharing aliases go. | low | todo |
| 11 | cv-11-plan-components | FP-1 steps 2-3 | Shared presentational components (term load, issue card, coverage list) own their styles; 46 duplicated style rules leave `SharedPlanView.vue`. | med | todo |
| 12 | cv-12-routes-and-effects | FK-4, FA-3, T-4 | Each feature owns its route records and app-wide effects; `router.ts`, `App.vue`, `App.spec.ts` become short lists; admin and bell tests move to their features. | low-med | todo |
| 13 | cv-13-admin-screens | FA-2, FA-5, FA-1 | One saved-document composable for the two scoped admin screens; one calendar-event presentation module; the client's parsing of server reference sentences pinned to the server's list (fixes three unparsed kinds). | med | todo |
| 14 | cv-14-actions-and-drafts | FP-6, FP-5 | One attempt helper for "run, ignore 401, report"; explorer reuses the program-choice composable; `groupGlyph`; transcript draft logic in a tested module. | low-med | todo |
| 15 | cv-15-contract-checks | FK-5, FP-4, FP-8 (option A), FK-6 | Contract coverage spec (every schema checked or allow-listed), nullability, limits; group-colour rules pinned to the seeded group names; message catalogues collected by glob. | low | todo |
| 16 | cv-16-admin-messages | FA-6 | `admin/messages.ts` (1163 lines) split per screen, same keys. | low | todo |
| 17 | cv-17-docs-and-extras | BD-4, T-5, T-7, architecture map | Stale ADR rows, `.rgignore` for dated evidence, architecture.md layer and lock tables; then the two extras: comments that restate code, tests that cannot fail. | low | todo |

Build tracks (parallel, disjoint paths): tooling (01, 17) / backend A (02, 03, 04, 08) / backend B after 02 (05, 06, 07) / frontend A (10, 11, 14) / frontend B (09, 13, 16) / then 12 and 15, which touch every feature.

### Deferred

- BA-4 split `curriculum-admin.dto.ts` by service: after PR #166 merges (it imports from that file).
- BP-8 `ai/` owns its config shape: after PR #77 (all files are its).
- Moving the frontend kernel files or the shell kit into their own folders: about 100 import lines in every open branch for no behaviour gain; the lint rule gives the guarantee without the move.

### Rejected

- T-3 parallel e2e: the suite takes 83 s; not worth the flakiness risk.
- BA-5 notification-kind guard: already enforced by `notifications/api.spec.ts` (contractEnum).
- BA-6 exclude `testing/` from the build: staging may seed fixtures from dist; leave.
- Module self-registration by folder scan, dependency-cruiser, eslint-plugin-boundaries, generated API types: new machinery; ADR 0002 and architecture.md already decided against them.

### Needs a decision (none blocks the stack)

1. BP-3a: should every 4xx carry a `code` (auth, account, plans, curriculum, guides, sharing answer with Nest's default body today)? Changes response bodies. And rename `AdminErrorDto` to `ApiErrorDto` (changes openapi.json)?
2. BD-5: make graduation-condition ids a contract (`kind` enum + `subjectId`) so the frontend parser is checked? Changes openapi.json.
3. BD-4: the description of `CourseStandingDto.readiness` is stale ("null for in progress"; the engine returns `locked`). Text-only openapi.json change.
4. FP-4/FP-8B: may DTOs gain `maxLength`/`maximum` and requirement groups a stable category? Additive openapi.json changes.
5. BP-4: with `SESSION_TTL_DAYS` above 30 the "hard 30-day cap" follows the TTL (`auth.service.ts:216`). Intended?
6. BD-3: must `class-model.md` keep field-level copies of engine types (it has already drifted), or may it point at `rules/types.ts`?
7. T-8: ADR 0019 still says "proposed" although #217 shipped it.
8. FA-1: Vietnamese and English wording for three reference kinds (owner: Hoà). FK-4: menu labels from the feature's messages or literal on the route (owner: Hoà).

### In-flight zones, narrowed

PR #77 is two weeks stale and already conflicts with main, so only `src/backend/src/advisor/**` and `src/backend/src/ai/**` are treated as its own. Shared hubs it also lists (`features.ts`, `migrations/index.ts`, `config/env.ts`, `AGENTS.md`, `architecture.md`, `package.json`) get minimal edits; whoever rebases #77 re-adds one line. `openapi.json` never changes in this mission.

## Completed batches

None yet.

## Decisions from the Project Lead (28 Nov 2026)

- Landing: a stack of small PRs, auto-merge on, a teammate approves each; one heads-up in the team channel before the first PR.
- Extras from the untangle skill, both, done last: remove comments that only restate the code; remove tests that could not catch a real bug and fix the ones that fail without one. Every removed test is listed in its PR with the reason it could not fail (AGENTS.md forbids weakening tests to pass CI).
- Subagents: set model and effort on every call. Sonnet/medium for repetitive surveys, mechanical refactors and chores; Opus/medium for design judgment and reviews; more only for one named hard step.

## Pending decisions

None.

## Next

Build PR 01 through the whole pipeline (brief, implement, independent review, verify, signed commit, push, PR, thread), then run the tracks in parallel.
