# Convergence mission: progress and recovery state

This file lives only on `refactor/converge`. It is the task pool and the recovery state of the mission in `/home/lamter/omnicourses/goal.txt`: converge the repo toward the simplest coherent architecture through small, verified, independently mergeable refactors. Public contract, rule-engine results and tests stay intact.

## How to resume

1. Read this file, then `git worktree list` and `gh pr list --search "head:refactor/cv-"`.
2. The work is one stack of small pull requests (Lâm, 28 Nov 2026). Stack branches are `refactor/cv-NN-<topic>`: 01 is based on `main`, each later one on the branch below it, and each PR's base is that branch. The stack worktree is `.claude/worktrees/cv-stack`; build worktrees are `.claude/worktrees/cv-build-{be,fa,fb}` (local branches `cvb/<batch slug>`, never pushed).
3. Install with `npx --yes npm@11.21.1 ci` (the machine's npm is 9; it rewrites the lockfile). Never commit a lockfile change.
4. Verify with `converge/tools/verify.sh <worktree> <database name>` (on this branch): typecheck, lint, unit, build, e2e, openapi and migration diffs, browser. It runs at `nice 10` with 4 test workers, one run at a time, and removes `node_modules/.vitest-cache` first (Vitest 5 caches transformed modules by file content; a spec that finds files by glob otherwise runs with a stale file list and its counts differ from CI). Each worktree uses its own database on the Postgres at `127.0.0.1:5432` (a docker container left by an earlier session).
5. A batch is done when: full verify passes on the stack branch, `src/backend/openapi.json` is byte-identical, an independent reviewer has read the diff, every commit is signed, and it carries a changeset (empty when nothing user-facing changes).
6. A new batch branches from the current stack tip. Brief, review brief and fix brief of every batch are in `converge/briefs/`; every independent review and each workflow's results are in `converge/reviews/`; the surveys are in `converge/survey/` (the seven first ones, `dashboard.md`, `config-deploy-ci.md`); `converge/final-read.md`, `converge/tests-scan.md` and `converge/goal-audit.md` are the three whole-stack checks.

## Merging the stack (one approval per PR; the table below marks what is merged and which PR is the bottom)

- Only the bottom PR is ready for review and has auto-merge on. Every PR above it is a draft.
- When the bottom PR is squash-merged: in `cv-stack`, merge `origin/main` into the next branch (never rebase a pushed branch, never force-push), run the verify script, push, check on GitHub that its base is now `main` and that its diff shows only its own files and exactly one changeset, mark it ready, request the four teammates as reviewers (`gh api repos/LLaammTTeerr/omnicourses/pulls/<n>/requested_reviewers`), and turn on auto-merge. Then merge that branch into the one above it, and so on up, so every layer contains `main`.
- The ruleset does not require a PR to be up to date with `main`. If another PR that adds a cross-folder import merges before a stack PR, `npm run lint` on `main` goes red until the edge is added to `scripts/layers.mjs`. Check lint on `main` after each merge. This already happened once: #214 merged while #220 was open; `main` was merged into every layer and the four dashboard edges were listed in #220.
- It happened a second time on 28 Nov: #245 (credit totals and training type, a feature PR) merged while #229 was the bottom. `npm run lint` on `main` stayed green. Merging `main` up the stack gave two textual conflicts at stack 15 (an import line and a doc line; both sides kept) and two test failures that a clean merge hid: the nullable-field table of stack 13 (#232) had to list the four new nullable fields of #245, and stack 20 (#239) had removed an import that the new tests of #245 used. Each was fixed at its own layer and merged upward. So a clean merge is not enough: run the full verify at the tip after every merge of `main`.
- A reviewer asked for a change once: on #237 Dũng found two table rows of `architecture.md` twice (my resolution of an earlier merge kept both sides). Fix on that layer, merge upward, verify the tip, push. Another session of the Project Lead's answered the same review and pushed the same fix to the branch a minute earlier, so one push here was refused; nothing was forced, the two fixes were identical. Before pushing a fix to a stack branch, fetch and look for a newer commit; the other session has been asked to send stack changes here instead.
- Any merge to `main` updates the Version Packages PR (#211).

## Boundaries

- Fixed: routes, DTO fields, status and error codes, response bodies, columns, existing migrations, `openapi.json`, rule-engine results. No test deleted or weakened.
- Files owned by open PRs: #166 (`curriculum-admin/csv-import.service*`, its e2e spec, ADR 0011, `docs/test/test-cases-b2.md`), #77 (`src/backend/src/advisor/**`, `src/backend/src/ai/**`; its other files are shared hubs and got minimal edits). #214 merged on 28 Nov.
- Earlier untangle passes: #56 to #58 (9 Nov) and #183 to #203 (26 Nov).

## The stack (bottom first)

| Stack | Branch | Batch | PR | Title |
| --- | --- | --- | --- | --- |
| 01 | `refactor/cv-01-verify-and-lint-rules` | 01 | #220 (merged 28 Nov as 3f29068, approved by Dũng) | chore(lint): add npm run verify and structural lint rules |
| 02 | `refactor/cv-02-plan-view` | 10 | #221 (merged 28 Nov as fc0c34d, approved by Dũng) | refactor(plans): split the pure issue view out of the planner loaders |
| 03 | `refactor/cv-03-locks-and-seeds` | 02 | #222 (merged 28 Nov as f7d0c5a, approved by Dũng) | refactor(backend): one lock-key registry, curriculum seeds in curriculum |
| 04 | `refactor/cv-04-engine-vocabulary` | 03 | #223 (merged 28 Nov as d13f5b9, approved by Dũng) | refactor(rules): move engine input types into pure curriculum-rules.ts |
| 05 | `refactor/cv-05-fe-kernel` | 09 | #224 (merged 28 Nov as df2826e, approved by Dũng) | refactor(frontend): give sign-out keys, grants and busy text one owner |
| 06 | `refactor/cv-06-rules-one-derivation` | 04 | #225 (merged 28 Nov as 3100de2, approved by Dũng) | refactor(rules): derive course status and prerequisite sets once |
| 07 | `refactor/cv-07-admin-screens` | 13 | #226 (merged 28 Nov as 8f71e41, approved by Dũng) | refactor(admin): share the saved-document and calendar-event code |
| 08 | `refactor/cv-08-plan-components` | 11 | #227 (merged 28 Nov as 931d809, approved by Dũng) | refactor(plans): share issue cards and credit meter with the shared page |
| 09 | `refactor/cv-09-admin-messages` | 16 | #228 (merged 28 Nov as 0098f92, approved by Dũng) | refactor(admin): split the admin message catalogue by screen |
| 10 | `refactor/cv-10-account-state` | 05 | #229 (merged 28 Nov as f9ddfa4, approved by Dũng) | refactor(users): own the account deletion check and student row lock |
| 11 | `refactor/cv-11-actions-and-drafts` | 14 | #230 (merged 28 Nov as 69066dd, approved by Dũng) | refactor(frontend): share one action helper, move the transcript draft |
| 12 | `refactor/cv-12-errors-and-limiter` | 06 | #231 (merged 28 Nov as a93c250, approved by Dũng) | refactor(backend): build coded errors in one place, move sign-in limiter |
| 13 | `refactor/cv-13-contract-checks` | 15 | #232 (merged 28 Nov as ac080bd, approved by Dũng) | test(frontend): fail when a contract schema or limit goes unchecked |
| 14 | `refactor/cv-14-routes-and-effects` | 12 | #233 (merged 28 Nov as 9677598, approved by Dũng) | refactor(frontend): let each feature own its routes and effects |
| 15 | `refactor/cv-15-admin-access` | 07 | #234 (merged 28 Nov as 09cb69a, approved by Dũng) | refactor(backend): move the admin write gate into admin-access |
| 16 | `refactor/cv-16-clc-seeds` | 08 | #235 (merged 28 Nov as 89d088f, approved by Dũng) | refactor(curriculum): write each CLC 2025 course once |
| 17 | `refactor/cv-17-docs-and-extras` | 17 | #236 (merged 28 Nov as 69917fa, approved by Dũng) | docs: match decision records and architecture map to the code |
| 18 | `refactor/cv-18-dashboard-folder` | 18 | #237 (merged 28 Nov as 07c0220, approved by Dũng) | refactor(dashboard): move the dashboard screen into its own folder |
| 19 | `refactor/cv-19-route-contract` | 19 | #238 (merged 28 Nov as 3b0c704, approved by Dũng) | test(frontend): make mockApi refuse routes outside openapi.json |
| 20 | `refactor/cv-20-tests-that-can-fail` | 20 | #239 (merged 28 Nov as 9af7944, approved by Dũng) | test: make weak tests able to fail and drop assertions that cannot |
| 21 | `refactor/cv-21-structure-adr` | 21 | #243 (merged 28 Nov as ff6a5bf, approved by Dũng) | docs(adr): record module boundaries, owners and their enforcement |
| 22 | `refactor/cv-22-config-and-pins` | 22 | #244 (merged 28 Nov as 689b034, approved by Dũng) | test(config): check settings, pinned versions and exact pins |
| 23 | `refactor/cv-23-checks-that-can-fail` | 23 | #252 (merged 28 Nov as 53d426a, approved by Dũng) | test: fail on an unmatched coverage glob or an off-contract fetch |
| 24 | `refactor/cv-24-entities-declare-constraints` | 24 | #253 (ready, auto-merge on) | refactor(database): declare every migrated constraint on the entities |

Base of the stack: `main` at 53d426a (#252, merged 28 Nov), merged into every remaining layer after each merge. Every layer passed the full verify when it was stacked; each new bottom passed it again on `main` before it was marked ready, and the tip (stack 22) passed after each restack with backend 1214 unit / 365 e2e and frontend 1402 unit / 68 browser (`main`: 1132 / 364 / 1263 / 68). Stack 20 removed two tests and three assertions that had nothing of their own to check; each is listed in PR #239 with the reason.

## State of the structure at the stack tip

- Backend: the folder cycle `curriculum <-> curriculum-admin <-> database` is gone; `common` and `config` import no feature. One folder pair still imports both ways, `auth <-> users` (the users controller uses the auth decorators; `auth` uses the users service and entity; no two files import each other; left on purpose, see ADR 0020), and one file cycle, the curriculum entities (TypeORM relations). The import graph has 102 folder edges with the root (101 at the start); the gain is direction, not count.
- Owners that did not exist before: lock keys (`common/advisory-locks.ts`), "account waiting for deletion" and the student row lock (`users/account-state.ts`), coded API errors (`common/api-errors.ts`), the admin write gate (`admin-access/`), the rule engine's input vocabulary (`curriculum/curriculum-rules.ts`), curriculum seed data (`curriculum/seeds/`), each CLC course (`curriculum/seeds/clc-2025-courses.ts`).
- Frontend: three enforced layers (kernel, features, composition) with no exception left; feature-to-feature imports are a ratchet list. Two-way pairs: `plans <-> sharing` only (accepted: the editor mounts the share dialog, the shared page reuses plan components). Stack 18 moves the dashboard out of `audit/`, which ends `audit <-> plans`; until it merges, layers 01 to 17 list four `audit -> ...` edges for the dashboard. Largest files: `plans/PlanEditorView.vue` 956, `dashboard/DashboardView.vue` 925 (from #214), `admin/CurriculumAdmin.vue` 796, `sharing/SharedPlanView.vue` 769 (1077 at the start).
- Enforcement, all in `npm run lint` (`scripts/lint.mjs`, tables in `scripts/layers.mjs`, 40-odd tests of its own): backend import direction, frontend layers and feature edges, `fetch(` only in `api.ts`, modules reachable from the registry, the module table of architecture.md, identifier homes, coded-error homes. In specs: rule-engine purity including type imports, contract coverage and nullability, seeded group colours, message catalogues by glob, server reference sentences.

## Decisions from the Project Lead (28 Nov 2026)

- Landing: a stack of small PRs, auto-merge on, a teammate approves each; one heads-up in the team channel before the first PR.
- Extras from the untangle skill, both, done last: remove comments that only restate the code; remove tests that could not catch a real bug and fix the ones that fail without one. Every removed test is listed in its PR with the reason it could not fail (AGENTS.md forbids weakening tests to pass CI).
- Subagents: set model and effort on every call. Sonnet/medium for repetitive surveys, mechanical refactors and chores; Opus/medium for design judgment and reviews; more only for one named hard step.

## Authorization for pushing, pull requests and Discord posts (goal section 9)

- Lâm, in the session, 27 Nov 2026 at 20:07 UTC (28 Nov, 03:07 in Vietnam), answer to the prompt "How should the refactor reach main?": **"A PR per area (Recommended)"**, whose text was: "I open one small PR per area once it passes every check, with auto-merge on. A teammate approves. Each merge deploys production. I post one heads-up in the team channel first."
- Lâm, same session: "do this task as a bunch of pull request stack on each other to prevent disruption", and "create new sprite in discord and occasionally report progress for me there".
- Standing rules: the user's global instructions ("When work is done and checks pass, commit and push without asking, but only on a non-default branch"; never push to main, never force-push) and AGENTS.md ("Agents have full authority over the branch → PR → merge cycle"; merge only with green CI and a human approval; never the admin override).
- Done under it: 22 pull requests opened (21 as drafts), auto-merge turned on and reviewers requested for the bottom PR only, one at a time as each PR below it merged, one heads-up in the main team channel before the first pull request (27 Nov, 20:12 UTC), one thread per PR and a progress thread in the sprite forum, three issues (#240 to #242). Merged PRs (marked in the stack table) were each merged by GitHub's auto-merge after a teammate's approval; production deploys by itself after each merge, as the chosen option says. No admin override, no manual deploy, no push to `main`, no force-push.

### Needs a decision (none blocks the stack; tracked in issues #240 and #241)

1. BP-3a: should every 4xx carry a `code` (auth, account, plans, curriculum, guides, sharing answer with Nest's default body today)? Changes response bodies. And rename `AdminErrorDto` to `ApiErrorDto` (changes openapi.json)?
2. BD-5: make graduation-condition ids a contract (`kind` enum + `subjectId`) so the frontend parser is checked? Changes openapi.json.
3. BD-4: the description of `CourseStandingDto.readiness` is stale ("null for in progress"; the engine returns `locked`). Text-only openapi.json change.
4. FP-4/FP-8B: may DTOs gain `maxLength`/`maximum` and requirement groups a stable category? Additive openapi.json changes.
5. BP-4: with `SESSION_TTL_DAYS` above 30 the "hard 30-day cap" follows the TTL (`auth.service.ts:216`). Intended?
6. BD-3: must `class-model.md` keep field-level copies of engine types (it has already drifted), or may it point at `rules/types.ts`?
7. T-8: ADR 0019 still says "proposed" although #217 shipped it.
8. Hoà: should the import admin screen reload its program list when the admin's grants change, as the curriculum and calendar screens do? One line (`reloadProgramsOnGrantChange`); today's behaviour kept.
8a. Hoà: the plan editor and the shared plan page differ in nine small style details (listed in PR #227). Should the shared page look like the editor? If yes, `CapMeter` and `IssueCard` lose their variants.
8b. T-1: the backend CI job exports and uploads `openapi.json` as an artifact that no workflow downloads. Remove the step? (CI gates are Lâm-only.)
9. FA-1: Vietnamese and English wording for three reference kinds (owner: Hoà). FK-4: menu labels from the feature's messages or literal on the route (owner: Hoà).
10. BD-3: `class-model.md` now has the two standing types it lacked, but it is still a hand copy of `rules/types.ts`. Keep the field lists (course deliverable?) or point at the file?
11. Hoà: three server "reference" sentences have no Vietnamese or English wording in the admin screens (overflow rules, combined-minimum rules, counting rule). `admin/references.spec.ts` lists them as known gaps; wording them is a small fix PR with a real changeset.

## An outside review (28 Nov)

Another session reviewed the repository at an older commit (bd9f32c) and sent its findings. `converge/review-triage.md` re-checks each against the top of the stack: most were already fixed by #207, five were agent-doable, the rest need a person.

- Done as stack 23 (#252): the rule-engine coverage gate can no longer pass when its glob matches no file, and every frontend spec that spies on `fetch` checks its calls against `openapi.json`.
- Done as stack 24 (#253): a schema-drift check for every table. It needed the entities of eight tables to declare the constraints their migrations already create (27 checks, 4 key names, 1 index; no database change). It replaces six per-feature copies. `ai_usage` is left out until #77 merges (#242).
- Filed for a person, at Lâm's word passed on by that session: five academic-rule questions and six other points in #240, four frontend points in #241.
- Kept out of this public repository: every security and deploy finding of that review. The Project Lead has them directly.
- Not done (too little benefit): a test that compares the README feature table with the contract.

## Deferred (tracked in issue #242)

- BA-4 split `curriculum-admin.dto.ts` by service: after PR #166 merges (it imports from that file).
- BP-8 `ai/` owns its config shape: after PR #77 (all files are its).
- Moving the frontend kernel files or the shell kit into their own folders: about 100 import lines in every open branch for no behaviour gain; the lint rule gives the guarantee without the move.
- `CreditCapsDto` in `rules/` instead of `plans/` (it would remove the backend edge `audit -> plans`): the purity check exempts only a fixed list of loader files and would need a special case.
- Sharing the term-load text line and the coverage list between the editor and the shared page: markup and data-test ids differ; waits for Hoà's answer to question 8a.

## Rejected

- One export line per migration: built in batch 07 and taken out again. It put timestamp-sorting logic into the migration registry while two branches that each append a migration still collide on the same line. `database/migrations/index.ts` is unchanged; its spec already fails on an unlisted migration.
- Removing the unused openapi artifact upload from `ci.yml`: CI gates are the Project Lead's; listed under decisions.
- Parallel e2e: the suite takes about 80 s; not worth the flakiness risk.
- A notification-kind guard: `notifications/api.spec.ts` already compares the kinds with the contract.
- Excluding `testing/` folders from the backend build: staging may seed guide fixtures from dist.
- dependency-cruiser or eslint-plugin-boundaries: a new dependency and config language for what `scripts/layers.mjs` and 300 lines of `scripts/lint.mjs` already do. Module self-registration by folder scan: ADR 0002 rejects globs for migrations for the same reason (ts and dist differ), and the explicit list is how a reader finds the modules. Generated API types: architecture.md rejects them (the generator needs TypeScript 5).

## Known limitations

- The machine is shared: on 28 Nov another long-running job ran beside the builds and the load average passed 80 for about ten minutes, which made 5 s test timeouts fire. Since then the verify script runs at `nice 10` with 4 test workers, briefs tell agents to do the same, and at most three build tracks run. It happened once more on 28 Nov at 12:50 (Vietnam time), during the restack after #227: one e2e setup hook hit its 10 s timeout at the stack tip under load, and the re-run passed 365 of 365. Since then the restack script re-runs a failed step once, and only when its log shows a timeout.
- `gh pr edit` fails on this machine (GitHub's Projects-classic GraphQL error). Set a PR body with `gh api repos/<owner>/<repo>/pulls/<n> -X PATCH -F body=@file` and reviewers with `.../requested_reviewers`.
- Workflow subagents cannot write files outside their worktree with the Write tool; their reports come back in the structured result (journal in the session's `subagents/workflows/<run>/journal.jsonl`).
- Commits made by subagents carry the Co-Authored-By trailer of the model that wrote them (Sonnet or Opus); the orchestrator's own commits carry Fable's.

## Follow-ups owed to teammates

- PR #166 (csv empty periods): the stack changed three import-path lines in `curriculum-admin/csv-import.service.ts` and one in its e2e spec. When #166 rebases, resolve those for its author.
- PR #77 (advisor harness): conflicts with `main` since before this mission; `features.ts` is now one module per line, `ai-cost-guard.service.ts` imports its lock key from `common/advisory-locks.ts`. Whoever rebases #77 re-adds its module line.
- Sprite threads: one per PR, named `#N title`; the progress log is the thread "refactor: converge the codebase (stacked PRs), progress log".

## Next

All 24 batches are pushed as PRs #220 to #239, #243, #244, #252 and #253 (merge order: that order). The stack table marks the merged ones. Nothing is building.

Where the mission stands against `goal.txt`: an independent audit of every section of the goal (`converge/goal-audit.md`, 28 Nov) found the code converged, the contract preserved, and two things still actionable without a decision. Both are done: the two stale doc facts (and one imprecise ADR sentence) are corrected at the layers they belong to, and these records, the issues and the saved reviews now match the repository. The audit also judged an earlier "stopping conditions reached" line premature: at that time configuration, dependencies and deploy had not been surveyed. They have been since (`converge/survey/config-deploy-ci.md`); what an agent could do became stack 22 (#244), the rest is the Project Lead's and is in #240.

As of this commit there is no known item an agent can do without a person. What is left:

- **Approvals.** One per PR. The stack table marks each merged PR (date, commit, approver) and the current bottom (ready, auto-merge on, reviewers requested); every layer above the bottom contains `main`. Each merged PR was approved by a teammate and merged by GitHub's auto-merge. When the bottom merges, follow "Merging the stack" for the next one. In the session of 28 Nov a script did exactly those steps after each merge and stopped on any conflict, failed check or failed run on `main`. When a teammate asks for a change on a PR: fix it on that PR's branch in `cv-stack`, then merge that branch into each branch above it and push them all.
- **#240**, decisions for the Project Lead: error codes on every 4xx, graduation-condition ids in the contract, a stale contract sentence, limits without a contract number, the session cap, notifications created on read, `class-model.md`, ADR statuses (0019, 0020), an unused CI step, the deploy and CI points (AI settings on the host, a migration error printed into the public deploy log, environment facts in four files, the repeated CI setup), and five questions from the first surveys (purge date, offered cohorts, "unlocks" in the browser, a figure the dashboard sums, test guides in the build). Four of these (error codes on every 4xx, the two ADR statuses, the contract sentence with the limits, the session cap) were also put to Lâm as a prompt in the session on 28 Nov. The prompt was withdrawn with no answer; each of the four carries its recommended answer in #240, which is now the only place they are asked.
- **#241**, points for the frontend owner: shared page against editor, the import screen and grant changes, three reference wordings, menu labels, the strict test mock, the dashboard findings and questions, four weak dashboard-spec assertions, two helpers the dashboard borrows, indexing of the shared page. Nothing in `dashboard/` is changed without Hoà's word.
- **#242**, follow-ups blocked by #166 and #77, or by an answer in #241.
- Too little benefit to do (the audit agrees): a handful of one-line helpers that would not pass a deletion test on their own (`platformImports`, three one-liners in `sharing/view.ts`, `database/seed-options.ts`); removing them is churn across the open stack.

The structural decisions of the stack, with alternatives and accepted exceptions, are in ADR 0020 (PR #243; an independent check corrected nine statements before it was opened). Its status is "proposed" until the Project Lead accepts it. The audit notes one cost to weigh there: `scripts/layers.mjs` is a file every cross-folder import must edit, and a PR that was green can turn `main` red when another lands first (it happened once, with #214).

The "Tests" extra: all 139 specs changed since the last test clean-up were read; 25 tests rewritten in 25 spec files, 23 of them after a mutation of the code showed the old test still passing; 5 removals listed in #239. The "Comments" extra removed one line; the 76 comment lines in migrations stay, because applied migrations are never edited.

The Version Packages PR (#211) holds #214's changeset and may merge mid-stack: after each restack check that a layer's diff against `main` has exactly one changeset.

Local leftovers that can be removed once the stack is merged: worktrees `.claude/worktrees/cv-build-{be,fa,fb}` and `cv-stack`, local branches `cvb/*`, databases `omnicourse_cv_*` and `omnicourse_converge` in the docker Postgres.
