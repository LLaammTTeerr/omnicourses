You are finishing one refactor batch in the OmniCourse repo after an independent review. The batch and its rules:

You are implementing one batch of a whole-codebase architectural convergence of the OmniCourse repo. The aim of the mission: one change to a business concept lands in one place, and people and agents can work in parallel without colliding. The batch must leave the system simpler, with behaviour unchanged.

## Where
- Worktree: /home/lamter/omnicourses/.claude/worktrees/cv-build-fb (branch cvb/13-admin-screens is checked out; base commit a84e93478f689ccad36fedb38aa5bd27f94f304e). Work only there. Never touch another worktree or /home/lamter/omnicourses itself, never switch branches, never push, never open a pull request, never post to GitHub or Discord, never write a progress file. The orchestrator integrates your commits.
- npm: the machine's npm is 9 and rewrites the lockfile. Use `npx --yes npm@11.21.1 <command>` for every npm command. node_modules is installed.

## Objective: one saved-document composable for the scoped admin screens, and one calendar-event presentation module
Sources: FRO-2 and FRO-5 in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/frontend-admin-content.md. Read them first.

A. Saved document. admin/CalendarAdmin.vue (added by #207) copies from admin/CurriculumAdmin.vue the whole "pick a program and cohort, load the saved document, mark it stale, refresh, guard dialogs" scaffolding: the scope and on-screen check, the watch on granted and listed program ids, status / stale / newest-only reads, load and showSaved, the notice, the useAdminDialog wiring and the two problem computeds. The newest-only window rules are subtle and must not diverge.
1. Move the program-grant refresh watch into useProgramPicker (it already owns the program list and its loading).
2. Add a composable for a saved, scoped document (name it for what it is) that returns the document, its status, the stale state and the read / load / show-saved functions; useAdminDialog takes the stale object from it directly. Both screens use it. A status only one screen has (CurriculumAdmin maps not_found to 'missing') is expressed by that screen, not by a flag inside the composable.
3. Dialogs, forms, messages and the other admin screens do not change. The specs of both screens and the admin browser spec pass with their assertions untouched. The composable gets its own spec for the newest-only rule and the stale transitions.

B. Calendar event presentation. The kind-to-colour-group table is byte-identical in calendar/CalendarView.vue and admin/CalendarAdmin.vue; the bilingual title helpers are duplicated there, and notifications/messages.ts builds an event line a third way. Add calendar/present.ts with the table and the title / span helpers; the three callers import it; the copies go. One trap: the notification copy falls back with `titleEn ?? title`, the others on a falsy titleEn, so they differ for an empty string. Find out whether an empty titleEn can reach the client (the backend DTO and entity of academic-calendar decide that). If it cannot, use one rule. If it can, keep each caller's present behaviour and report it as a question; do not pick one.

C. scripts/layers.mjs: add or remove exactly the frontend feature edges this batch changes (lint tells you), and list them in the report.

## Boundaries
- Fixed contract: routes, DTO fields and class names, status and error codes, response bodies, database columns, existing migration files, and src/backend/openapi.json byte for byte. What the rule engine decides does not change (AGENTS.md hard rule 1).
- Tests are the safety net: never delete, skip or weaken a test or an assertion. A test may move with the code it tests; its assertions stay. New logic gets a spec that would fail if the logic were wrong; a pure move needs none.
- Repo rules that bite: no code comments at all, no new dependency, no lockfile change, relative imports with a .js suffix in the backend, no magic numbers, English, Conventional Commits.
- Off limits (owned by open pull requests): src/frontend/src/audit/{DashboardView.vue,DashboardView.spec.ts,api.ts,dashboard.ts,dashboard.spec.ts,dashboard-messages.ts}, src/frontend/src/shell/icons.ts, src/frontend/src/testing/fetch.ts (PR #214); src/backend/src/curriculum-admin/csv-import.service.ts and its spec, src/backend/test/curriculum-admin-import.e2e-spec.ts, docs/analysis-and-design/adr/0011-curriculum-administration.md, docs/test/test-cases-b2.md (PR #166); everything under src/backend/src/advisor/ and src/backend/src/ai/ (PR #77). If the objective needs a one-line import-path change in one of these files because a module moved, make exactly that line and list it in your result.
- The survey findings named above are leads, not truth: confirm each claim in the code before acting on it. If a claim is wrong, or a step cannot be done without breaking a boundary, do not force it: leave that step out and say so in your result.
- Keep the diff to the objective: no drive-by renames, reformatting or unrelated cleanup.
- Docs: search docs/analysis-and-design, AGENTS.md, README.md, CONTRIBUTING.md and GLOSSARY.md for names or paths you moved or removed, and correct the lines that would now be wrong (not docs/test/**, not report/**: those are dated records).

## Verify
- The machine is shared with other jobs: run every test command at low priority and with few workers, like `cd src/backend && nice -n 10 npx vitest run --maxWorkers=4 <path>` or `cd src/frontend && nice -n 10 npx vitest run --maxWorkers=4 <path>`, never the whole suite in a loop. A test that fails with "Test timed out in 5000ms" while the machine is busy is load, not your change: run that file once more before you conclude anything.
- While working, run targeted checks as above, and `npx --yes npm@11.21.1 run typecheck -w src/backend` (or `-w src/frontend`), `npx --yes npm@11.21.1 run lint`.
- Before you finish: `/home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/verify.sh /home/lamter/omnicourses/.claude/worktrees/cv-build-fb omnicourse_cv_fb typecheck lint unit-fe build browser contract` must print `RESULT: ALL PASS`, and no number on its COUNTS line may be lower than the baseline it prints unless you can name the reason. It runs typecheck, lint, frontend unit tests, build, browser tests and the contract diff (a "-" on the COUNTS line is a suite it did not run; the orchestrator runs the rest); about 3 minutes, and it waits its turn if another run is active (allow up to 20 minutes). On failure, read the log path it prints and fix the cause; never the test.

## Commits
- Small commits, one coherent step each. Signing is configured: a plain `git commit` signs. Never pass --no-gpg-sign or change git config. If signing fails, stop and return status "blocked".
- Message: a Conventional Commit subject in English (`refactor(admin): ...`), a body of one or two sentences that says why, and the last line `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- In the last commit add `.changeset/13-admin-screens.md`. Nothing here is visible to a user, so it is an empty changeset: the file holds exactly two lines, `---` and `---`.

## Result
- Write /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/13-admin-screens/report.md (with a shell heredoc if the Write tool refuses a path outside the worktree; if that fails too, put the content in your result): what changed and why, commit by commit; every step of the objective you left out and why; what a reviewer should look at twice; the last lines of the verify output.
- Return the structured result: status "done" only when verify printed RESULT: ALL PASS on your final commit and `git status --short` is empty.

## Now
The batch is already implemented on this branch (see `git log --oneline a84e93478f689ccad36fedb38aa5bd27f94f304e..HEAD` and /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/13-admin-screens/report.md). An independent reviewer found the problems listed below. For each blocking finding: check it against the code; if it is right, fix it in a new commit (do not amend or rebase); if it is wrong, say why in the report with evidence. Take a non-blocking finding only when it is cheap and clearly right. Then run the full verify again, append a "Review round" section to the report, and return the structured result (commits: only the new ones).

Findings:
