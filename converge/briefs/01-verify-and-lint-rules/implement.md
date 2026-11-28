You are implementing one batch of a whole-codebase architectural convergence of the OmniCourse repo. The aim of the mission: one change to a business concept lands in one place, and people and agents can work in parallel without colliding. The batch must leave the system simpler, with behaviour unchanged.

## Where
- Worktree: /home/lamter/omnicourses/.claude/worktrees/cv-stack (branch refactor/cv-01-verify-and-lint-rules is checked out; base commit 3c4da22d6c715e57b15dc255d9a9bebf410266ab). Work only there. Never touch another worktree or /home/lamter/omnicourses itself, never switch branches, never push, never open a pull request, never post to GitHub or Discord, never write a progress file. The orchestrator integrates your commits.
- npm: the machine's npm is 9 and rewrites the lockfile. Use `npx --yes npm@11.21.1 <command>` for every npm command. node_modules is installed.

## Objective: one verify command, and structural rules in the lint script
Sources: findings TES-1 and TES-2 in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/tests-ci-docs.md, FRO-1 in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/frontend-platform.md, and the lint part of BAC-6 in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/backend-platform.md. Read them first.

Why: the architecture rules of this repo are protected only by discipline. scripts/lint.mjs (a dependency-free Node script run by `npm run lint` and by CI) is the one existing checker. Extend it so the structure is machine-checked, and give developers one command that equals what CI runs. This batch changes no file under src/.

A. One command
1. Root package.json: add a `verify` script that runs lint, typecheck, unit tests and build, in that order.
2. AGENTS.md "Commands" block and the sentence under it, and the README.md "Checks" block: name `npm run verify`; keep e2e, browser tests and openapi as separate commands (they need the database or Chromium). Minimal edits.
3. Do not edit anything under .github/.

B. Structural rules in scripts/lint.mjs. Put the tables in a new data module scripts/layers.mjs, one entry per line and sorted, so parallel branches merge cleanly; keep the rule code in lint.mjs. Every rule must pass on the current tree with zero changes under src/: where today's code breaks the ideal, list the exception explicitly in layers.mjs so a later batch can remove it.
1. Import parsing: one helper that returns the imports of a .ts or .vue file: static `import` and `export ... from` (type-only ones too, and ones whose braces span several lines), side-effect imports and dynamic `import()`, each resolved to a repo file (`./x.js` to x.ts, .vue files, index.ts). Mask comments the way the script already does.
2. backend-import-direction (a ratchet): production files under src/backend/src (not *.spec.ts, not inside a `testing/` folder) may import across top-level folders only along edges listed in layers.mjs as 'from -> to'. Files directly in src/backend/src (app.module.ts, bootstrap.ts, main.ts, features.ts, openapi*.ts) are the composition root and may import anything. Generate the list from the real graph, do not type it by hand (`node /home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/depgraph.mjs src/backend/src` prints folderEdges; count type-only imports as edges too). A new edge fails with a message that says: add the edge to scripts/layers.mjs on purpose, or move the code. A listed edge that no longer exists also fails ("remove it from scripts/layers.mjs"), so the list only ever shrinks deliberately.
3. frontend-layers: three layers over the files where they are, no file moves. KERNEL files may import only kernel files: api.ts, locale.ts, async-load.ts, page-title.ts, groups.ts, terms.ts, course-code.ts, components/**, auth/store.ts, auth/api.ts, auth/redirect.ts, shell/{Icon.vue,icons.ts,toast.ts,theme.ts,messages.ts,LangButton.vue,ThemeButton.vue,BrandLink.vue}. COMPOSITION files may import anything and may be imported only by composition files: main.ts, app.ts, App.vue, router.ts, shell/{AppSidebar,MobileBars,PublicHeader,PublicFooter,ToastHost,TooltipHost}.vue, shell/{nav,sidebar}.ts. Every other production file is a FEATURE file: it may import kernel and feature files, never composition. Check this classification against the code and correct the lists where a file sits in the wrong layer (say which, and why, in your report). Exempt *.spec.ts, *.browser.spec.ts and testing/**. One known exception today: auth/store.ts imports plans/last-plan.ts and plans/lock.ts.
4. frontend-feature-edges (a ratchet): the mechanism of rule 2 for imports between feature folders (kernel and composition files left out of the count), generated from the real graph.
5. Extend the existing "no fetch( in .vue files" rule to every production frontend .ts file except src/frontend/src/api.ts: one function over .ts and .vue.
6. modules-registered: every *.module.ts under src/backend/src is imported by features.ts, app.module.ts or another *.module.ts.
7. module-index: the folder of every module listed in features.ts is named in the module table of docs/analysis-and-design/architecture.md section 4. If the table is stale, fix the table.
8. Widen the existing TypeScript rules (no ts-ignore, no debugger, no direct process.env) to src/backend/test.
Do not add a rule for what a spec already enforces (migrations listed: database/migrations/index.spec.ts; openapi drift; locale completeness).

C. The checker gets its own test: scripts/lint.test.mjs on node:test (no dependency). For each rule, old and new, build a small temporary workspace with one violation and assert that lintWorkspace reports that rule, plus one clean case per rule. Include a multi-line import, a type-only import, a dynamic import and the stale-list case. Change the root `lint` script so it runs the checker and then its test (CI already calls `npm run lint`, so CI needs no change).

D. Docs: one short paragraph in docs/analysis-and-design/architecture.md (cross-cutting concerns) saying that the layer and dependency tables live in scripts/layers.mjs and that lint enforces them; do not copy the tables into the doc. One line in the AGENTS.md "Conventions" list: a new cross-folder import must be added to scripts/layers.mjs on purpose, or lint fails.

Error messages are part of the interface: each names the rule, the file and line, and what to do about it.

## Boundaries
- Fixed contract: routes, DTO fields and class names, status and error codes, response bodies, database columns, existing migration files, and src/backend/openapi.json byte for byte. What the rule engine decides does not change (AGENTS.md hard rule 1).
- Tests are the safety net: never delete, skip or weaken a test or an assertion. A test may move with the code it tests; its assertions stay. New logic gets a spec that would fail if the logic were wrong; a pure move needs none.
- Repo rules that bite: no code comments at all, no new dependency, no lockfile change, relative imports with a .js suffix in the backend, no magic numbers, English, Conventional Commits.
- Off limits (owned by open pull requests): src/backend/src/curriculum-admin/csv-import.service.ts and its spec, src/backend/test/curriculum-admin-import.e2e-spec.ts, docs/analysis-and-design/adr/0011-curriculum-administration.md, docs/test/test-cases-b2.md (PR #166); everything under src/backend/src/advisor/ and src/backend/src/ai/ (PR #77). If the objective needs a one-line import-path change in one of these files because a module moved, make exactly that line and list it in your result.
- The survey findings named above are leads, not truth: confirm each claim in the code before acting on it. If a claim is wrong, or a step cannot be done without breaking a boundary, do not force it: leave that step out and say so in your result.
- Keep the diff to the objective: no drive-by renames, reformatting or unrelated cleanup.
- Docs: search docs/analysis-and-design, AGENTS.md, README.md, CONTRIBUTING.md and GLOSSARY.md for names or paths you moved or removed, and correct the lines that would now be wrong (not docs/test/**, not report/**: those are dated records).

## Verify
- The machine is shared with other jobs: run every test command at low priority and with few workers, like `cd src/backend && nice -n 10 npx vitest run --maxWorkers=4 <path>` or `cd src/frontend && nice -n 10 npx vitest run --maxWorkers=4 <path>`, never the whole suite in a loop. A test that fails with "Test timed out in 5000ms" while the machine is busy is load, not your change: run that file once more before you conclude anything.
- While working, run targeted checks as above, and `npx --yes npm@11.21.1 run typecheck -w src/backend` (or `-w src/frontend`), `npx --yes npm@11.21.1 run lint`.
- Before you finish: `/home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/verify.sh /home/lamter/omnicourses/.claude/worktrees/cv-stack omnicourse_cv_stack` must print `RESULT: ALL PASS`, and no number on its COUNTS line may be lower than the baseline it prints unless you can name the reason. It runs typecheck, lint, unit tests, build, e2e, the openapi and migration diffs and the browser tests; about 3 minutes, and it waits its turn if another run is active (allow up to 20 minutes). On failure, read the log path it prints and fix the cause; never the test.

## Commits
- Small commits, one coherent step each. Signing is configured: a plain `git commit` signs. Never pass --no-gpg-sign or change git config. If signing fails, stop and return status "blocked".
- Message: a Conventional Commit subject in English (`chore(lint): ...`), a body of one or two sentences that says why, and as the last line the Co-Authored-By trailer that your own session's attribution reminder gives for your model (if you have none: `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`).
- In the last commit add `.changeset/01-verify-and-lint-rules.md`. Nothing here is visible to a user, so it is an empty changeset: the file holds exactly two lines, `---` and `---`.

## Result
- Write /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/01-verify-and-lint-rules/report.md (with a shell heredoc if the Write tool refuses a path outside the worktree; if that fails too, put the content in your result): what changed and why, commit by commit; every step of the objective you left out and why; what a reviewer should look at twice; the last lines of the verify output.
- Return the structured result: status "done" only when verify printed RESULT: ALL PASS on your final commit and `git status --short` is empty.