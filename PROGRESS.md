# Convergence mission: progress and recovery state

This file lives only on `refactor/converge`. It is the task pool and the recovery state of the mission in `/home/lamter/omnicourses/goal.txt`: converge the repo toward the simplest coherent architecture through small, verified, independently mergeable refactors. Public contract, rule-engine results and tests stay intact.

## How to resume

1. Read this file, then `git worktree list` and `git branch --list 'refactor/*'`.
2. Each batch is its own branch `refactor/<area>-<topic>` cut from `origin/main`, in its own worktree under `.claude/worktrees/`, with paths that overlap no other open batch.
3. Install with `npx --yes npm@11.21.1 ci` (the machine's npm is 9; it rewrites the lockfile). Never commit a lockfile change.
4. Verify with `<scratchpad>/verify.sh <worktree> <database name>` (typecheck, lint, unit, build, e2e, openapi diff, browser). Each worktree uses its own database on the Postgres at `127.0.0.1:5432`.
5. A batch is done when: full verify passes, `src/backend/openapi.json` is byte-identical, an independent reviewer has read the diff, the commit is signed, and it carries a changeset (`--empty` when nothing user-facing changes).

## Boundaries

- Fixed: routes, DTO fields, status and error codes, columns, existing migrations, `openapi.json`, rule-engine results.
- Files owned by in-flight PRs are off limits: #214 (frontend `audit/Dashboard*`, `audit/api.ts`, `audit/dashboard*.ts`, `shell/icons.ts`, `testing/fetch.ts`), #166 (`curriculum-admin/csv-import.service*`, its e2e spec, ADR 0011, `docs/test/test-cases-b2.md`), #77 (`src/backend/src/advisor/**` and the files that PR lists).
- Earlier untangle passes: #56 to #58 (9 Nov) and #183 to #203 (26 Nov). Do not redo them.

## Baseline (main at 3c4da22)

Pending.

## Task pool

Pending the survey.

## Completed batches

None yet.

## Pending decisions

- How the work reaches main (a PR per area, pushed branches only, or local only): asked, no answer yet. Until answered: signed local commits, pushed branches, no PR, no Discord post.

## Next

Merge the seven survey files into the task pool, pick the first batch, and take it through the whole pipeline once before running batches in parallel.
