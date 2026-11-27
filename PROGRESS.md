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

Pending the survey.

## Completed batches

None yet.

## Decisions from the Project Lead (28 Nov 2026)

- Landing: a stack of small PRs, auto-merge on, a teammate approves each; one heads-up in the team channel before the first PR.
- Extras from the untangle skill, both, done last: remove comments that only restate the code; remove tests that could not catch a real bug and fix the ones that fail without one. Every removed test is listed in its PR with the reason it could not fail (AGENTS.md forbids weakening tests to pass CI).
- Subagents: set model and effort on every call. Sonnet/medium for repetitive surveys, mechanical refactors and chores; Opus/medium for design judgment and reviews; more only for one named hard step.

## Pending decisions

None.

## Next

Seven surveys are running (files in `<scratchpad>/survey/`). Merge them into the task pool, pick the first batch, and take it through the whole pipeline once before running batches in parallel.
