You are implementing one batch of a whole-codebase architectural convergence of the OmniCourse repo. The aim of the mission: one change to a business concept lands in one place, and people and agents can work in parallel without colliding. The batch must leave the system simpler, with behaviour unchanged.

## Where
- Worktree: /home/lamter/omnicourses/.claude/worktrees/cv-build-fa (branch cvb/11-plan-components is checked out; base commit 3139043d55819a8e71724ec31985842fb9a4e735). Work only there. Never touch another worktree or /home/lamter/omnicourses itself, never switch branches, never push, never open a pull request, never post to GitHub or Discord, never write a progress file. The orchestrator integrates your commits.
- npm: the machine's npm is 9 and rewrites the lockfile. Use `npx --yes npm@11.21.1 <command>` for every npm command. node_modules is installed.

## Objective: the shared plan page and the editor render term load, issue cards and coverage through the same components
Sources: FRO-1 (steps 2 and 3) in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/frontend-planning.md. Read it first. The batch before this one moved the shared page's logic into sharing/view.ts and the pure presentation helpers into plans/issue-view.ts; read both.

Why: sharing/SharedPlanView.vue repeats the editor's markup and styles for a term's load meter, an issue card and the coverage list. Of its 105 style rules, 46 use a selector that plans/PlanEditorView.vue or plans/IssuesPanel.vue also styles: 16 are identical and 30 have drifted. A change to how a term row or an issue card looks must be made twice, and the public page is the one nobody opens.

A. Proof first. Before you change anything, write a temporary browser spec (vitest browser mode with Playwright is set up: see src/frontend/vitest.browser.config.ts and the existing *.browser.spec.ts files, which mount views against a mocked API) that mounts the shared page and the plan editor with rich fixtures (issues of every kind shown, a term over its cap, a term under its minimum, withheld courses, coverage) and saves screenshots in the light and the dark theme at a desktop and a phone width. Run it on the untouched tree and keep the images outside the repo. Run it again on your final commit. The images must be identical; for any that differ, find the cause and fix it, or undo that part. Do not commit the temporary spec or any image. Put the comparison result (a list of image names, identical or not) in your report.

B. Extract presentational components that both views use, each owning its scoped styles. The survey suggests a term-load meter, an issue card (with the citation link) and a coverage list; choose the cuts the markup supports. The editor's drag, preview, lift and undo behaviour stays in the editor: pass what differs through props or slots, and do not give a shared component a prop only one caller understands when a slot would do. data-test ids, text and DOM order stay as they are in both views.

C. Remove the copies: the rules and markup a shared component now owns leave SharedPlanView.vue, PlanEditorView.vue and IssuesPanel.vue. Where two copies of a rule differ today, the difference must survive (screenshots identical) until a person decides: keep it as a variant of the component, and list every such difference in your report as a question for the frontend owner. Do not unify drifted styles on your own judgment.

D. The existing specs of both views (unit and browser) pass with their assertions untouched. New components get a spec only for logic they hold; pure markup needs none.

If a cut cannot be shared without changing pixels or adding caller-specific flags, leave that part duplicated and say so: a smaller honest extraction beats a forced one.

## Boundaries
- Fixed contract: routes, DTO fields and class names, status and error codes, response bodies, database columns, existing migration files, and src/backend/openapi.json byte for byte. What the rule engine decides does not change (AGENTS.md hard rule 1).
- Tests are the safety net: never delete, skip or weaken a test or an assertion. A test may move with the code it tests; its assertions stay. New logic gets a spec that would fail if the logic were wrong; a pure move needs none.
- Repo rules that bite: no code comments at all, no new dependency, no lockfile change, relative imports with a .js suffix in the backend, no magic numbers, English, Conventional Commits.
- Off limits (owned by open pull requests): src/frontend/src/audit/{DashboardView.vue,DashboardView.spec.ts,api.ts,dashboard.ts,dashboard.spec.ts,dashboard-messages.ts}, src/frontend/src/shell/icons.ts, src/frontend/src/testing/fetch.ts (PR #214); src/backend/src/curriculum-admin/csv-import.service.ts and its spec, src/backend/test/curriculum-admin-import.e2e-spec.ts, docs/analysis-and-design/adr/0011-curriculum-administration.md, docs/test/test-cases-b2.md (PR #166); everything under src/backend/src/advisor/ and src/backend/src/ai/ (PR #77). If the objective needs a one-line import-path change in one of these files because a module moved, make exactly that line and list it in your result.
- The survey findings named above are leads, not truth: confirm each claim in the code before acting on it. If a claim is wrong, or a step cannot be done without breaking a boundary, do not force it: leave that step out and say so in your result.
- Keep the diff to the objective: no drive-by renames, reformatting or unrelated cleanup.
- Docs: search docs/analysis-and-design, AGENTS.md, README.md, CONTRIBUTING.md and GLOSSARY.md for names or paths you moved or removed, and correct the lines that would now be wrong (not docs/test/**, not report/**: those are dated records).

## Verify
- While working, run targeted checks: `cd src/backend && npx vitest run <path>`, `cd src/frontend && npx vitest run <path>`, `npx --yes npm@11.21.1 run typecheck -w src/backend` (or `-w src/frontend`), `npx --yes npm@11.21.1 run lint`.
- Before you finish: `/home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/verify.sh /home/lamter/omnicourses/.claude/worktrees/cv-build-fa omnicourse_cv_fa typecheck lint unit-fe build browser contract` must print `RESULT: ALL PASS`, and no number on its COUNTS line may be lower than the baseline it prints unless you can name the reason. It runs typecheck, lint, frontend unit tests, build, browser tests and the contract diff (a "-" on the COUNTS line is a suite it did not run; the orchestrator runs the rest); about 3 minutes, and it waits its turn if another run is active (allow up to 20 minutes). On failure, read the log path it prints and fix the cause; never the test.

## Commits
- Small commits, one coherent step each. Signing is configured: a plain `git commit` signs. Never pass --no-gpg-sign or change git config. If signing fails, stop and return status "blocked".
- Message: a Conventional Commit subject in English (`refactor(plans): ...`), a body of one or two sentences that says why, and the last line `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- In the last commit add `.changeset/11-plan-components.md`. Nothing here is visible to a user, so it is an empty changeset: the file holds exactly two lines, `---` and `---`.

## Result
- Write /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/11-plan-components/report.md (with a shell heredoc if the Write tool refuses a path outside the worktree; if that fails too, put the content in your result): what changed and why, commit by commit; every step of the objective you left out and why; what a reviewer should look at twice; the last lines of the verify output.
- Return the structured result: status "done" only when verify printed RESULT: ALL PASS on your final commit and `git status --short` is empty.