# Compliance audit of the convergence mission against goal.txt

Audit date 2026-11-28, about 08:37 +0700. This audit is read-only: nothing was edited, committed, pushed or commented. It did not run the test suites.

**Snapshot audited**
- Stack tip: `refactor/cv-21-structure-adr` at 43422c5, in worktree `.claude/worktrees/cv-stack`. It contains origin/main at 778d120 (merge-base 778d120).
- Records: `refactor/converge` at 692ee5d, pushed. That commit landed *during* this audit.
- Batch 22: 5 signed commits made between 08:30 and 08:34 on `cvb/22-config-and-pins` (worktree `.claude/worktrees/cv-build-be`). It was pushed as `refactor/cv-22-config-and-pins` (30a6049) and opened as **draft PR #244** at 08:37, during this audit, with 6/6 checks passing. PROGRESS.md does not mention it.
- Audit side effect: one `git fetch origin refactor/converge` in the converge worktree. It updated a remote-tracking ref only. Nothing else was written outside the scratchpad.
- The session's start snapshot named `refactor/cv-21-structure-adr` as the user checkout's branch. Its reflog shows no such checkout, and the checkout is on main now.

**Evidence markers:** [checked] = I verified it myself. [sub] = a read-only sub-reader I started verified it, and I spot-checked part of it. [claimed] = it is stated in the records or a PR body and I could not re-run it.

## Key measurements (all [checked])

**Commits and contract**
- `git log --no-merges --format=%G? origin/main..HEAD`: 117 non-merge commits plus 22 merge commits. All 139 are signed with a good signature (G).
- `git diff --stat origin/main..HEAD`: 334 files, +8385 / −5483.
  - Production `src` (specs, e2e and testing/ excluded): 196 files, +4934 / −4764.
  - Tests: +2361 / −652.
  - `scripts/`: +1029 / −17.
  - Docs: +175 / −61.
- `git diff origin/main..HEAD -- src/backend/openapi.json src/backend/src/database/migrations`: empty.
- Route decorators: `git diff ... | grep -E '^[-+].*@(Controller|Get|Post|Put|Patch|Delete|Public|Authenticated|HttpCode|Throttle)'` returns nothing.

**Lint and the import graph**
- `node scripts/lint.mjs`: "Lint passed."
- depgraph, backend, origin/main → tip:
  - Folder edges: 101 → 102.
  - Folder cycles: `auth<->users` and `curriculum<->curriculum-admin<->database` → `auth<->users` only.
  - File cycles: the three curriculum entities, unchanged.
- depgraph, frontend, origin/main → tip:
  - Folder edges: 94 → 99.
  - The tool still reports one 19-folder cycle, because the root folder holds both the kernel files and the composition files.
  - File cycles: none.
  - Biggest files: `admin/messages.ts` 1163 → split into seven files of at most 253 lines. `SharedPlanView.vue` 1077 → 769. `PlanEditorView.vue` 964 → 956. `CurriculumAdmin.vue` 840 → 796. `DashboardView.vue` 926, unchanged.

**Pull requests**
- `gh pr list --search head:refactor/cv-`: 21 open PRs, #220–#239 and #243, when the audit started. #244 was added at 08:37.
  - #220 is ready, based on main, with auto-merge (squash) on and REVIEW_REQUIRED. Reviewers requested: Rookie001MC, VoNguyenMinhTriet, Anhdung1478, rakun68.
  - The other 20 are drafts, each based on the branch below it.
  - 0 reviews and 0 comments on all 21.
- `gh pr checks`: all 21 PRs pass all 6 checks (backend, frontend, changeset, pr-title, scope, signed-commits).
- The backend CI job runs unit, build, e2e and openapi. The frontend job runs lint, unit, browser and build.
- CI log of run 46091327644 (#239): unit-be 1205, e2e 365, unit-fe 1402, browser 68. These match the counts in PROGRESS.md.

**The user's checkout** (`/home/lamter/omnicourses`)
- Branch main at 3c4da22, behind origin by 1. Only `goal.txt` is untracked. No stash, and `git diff --stat` is empty.
- Reflog: the last entries are `pull --all` and "checkout main to main" at 02:56. That is before the session scratchpad appeared (02:58), and I cannot attribute those two entries to anyone.
- Nothing after that point.

## Sections 1 and 2: First principles and the optimisation objective

| Item | Verdict | Evidence |
|---|---|---|
| Ideal architecture used as direction, not a rewrite | met | Each survey has an "Ideal direction" section (for example `survey/tests-ci-docs.md` §2). There are 21 small PRs and no rewrite. [checked] |
| Essential complexity kept, accidental complexity reduced | partly met | Accidental complexity removed: one backend folder cycle, ~10 copies of the deletion check, lock numbers scattered over three modules, hand-built error bodies, a 1163-line catalogue. Some complexity was moved rather than removed: the CapMeter and IssueCard `variant` props, and `codedError` before/after. ADR 0020 and final-read §1.4–1.5 admit this. [checked] |
| Cognitive and coordination cost minimised; no proxy optimisation | partly met | Locality improved: per-feature `routes.ts`, the split catalogue, `features.ts` with one module per line. But `scripts/layers.mjs` is a new shared file that every cross-folder import must edit. It already turned main red once (#214, recorded in PROGRESS). Edge counts did not drop and were not chased (good). [checked] |

## Section 3: Architectural principles

| Item | Verdict | Evidence |
|---|---|---|
| 3.1 Single source of truth | partly met | New owners: `common/advisory-locks.ts`, `users/account-state.ts`, `common/api-errors.ts`, `admin-access/`, `curriculum/curriculum-rules.ts`, `curriculum/seeds/clc-2025-courses.ts` [checked]. Lists still kept in step by hand: `.env.example` vs `env.ts` and the runtime pins in 4–5 files (fixed by batch 22, #244); `class-model.md` vs `rules/types.ts` (decision #240); frontend limits vs DTOs (decision #240). |
| 3.2 Canonical implementation | met (with bounded exceptions) | One IssueCard, CapMeter, `useAttempt`, `useSavedDocument` and calendar `present.ts`. No old copy remains (the sub-reader checked the callers). The two styles inside IssueCard and CapMeter are a documented exception that waits on Hoà (#241). [sub] |
| 3.3 Deep modules, deletion test | partly met | Good: `account-state.ts`, `admin-access`, `saved-document.ts`. New shallow helpers: `platformImports` (features.ts:39), `noDeletionWaitingSql`, `ROW_LOCK`/`activeOnly` for one caller, `orderedGroups`/`shortCount` (sharing/view.ts:121–123), `database/seed-options.ts` (one `argv.includes`), and `SeedOptions` passed to a seeder that ignores it. All small. [sub, spot-checked view.ts and features.ts] |
| 3.4 High cohesion, low coupling | met | The `curriculum<->curriculum-admin<->database` cycle is gone. `common` and `config` import no feature. The engine's purity check now also follows type imports. The backend cycle that remains, `auth<->users`, is accepted in ADR 0020. Note: depgraph shows value imports in both directions (users.controller → auth.decorators), so "type-only" in PROGRESS is loose wording. [checked] |
| 3.5 Locality of change | partly met | Per-feature routes and effects (#233), the catalogue split (#228), the append-only module list (#234). The cost of `layers.mjs` is above. |
| 3.6 Deletion before addition | partly met | Production code is net +170 lines. The migration-list rework was built and then reverted (PROGRESS "Rejected"). No old/new pairs are left behind. Most of the growth is tests (+1709) and lint (+1012). |
| 3.7 Explicitness | met | Explicit module list, explicit route list, explicit lock modes (`ROW_LOCK`). No new globbing. [checked] |
| 3.8 Enforceable architecture | met, with a cost note | Lint rules: backend-import-direction, frontend-layers, frontend-feature-edges, identifier-home, coded-error-home, modules-registered, module-index, no-vue-fetch. Each has a test in `scripts/lint.test.mjs` (442 lines). dependency-cruiser was rejected with a deletion-test argument. About 1,050 lines of custom checker in total; see §12. [checked] |

## Section 4: Agent-native development

| Item | Verdict | Evidence |
|---|---|---|
| Find the authoritative implementation quickly | met | The architecture.md module table is lint-checked (line 141 `admin-access`). ADR 0020 lists the owners. [checked] |
| Understand a module without the whole repo | partly met | The routes and messages splits help. The biggest files are untouched: PlanEditorView 956, DashboardView 926. |
| Discover contracts, invariants and tests | met | ADR 0020, the AGENTS.md line on `layers.mjs`, `npm run verify`. |
| Know which files are yours | partly met | Ownership exists per folder. There is no ownership file. Appropriate for a 5-person repo. |
| Modify without coordinating | partly met | Fewer hubs (router.ts, App.vue, admin/messages.ts, features.ts). A new hub: `scripts/layers.mjs`. |
| Verify own work locally | met | `npm run verify` (package.json). Lint now runs its own tests. |
| Predict downstream consequences | met | The edge lists make the dependencies explicit. |
| High-contention files identified | met | PR #233's body cites commit counts for router.ts, App.vue and App.spec.ts. Surveys exist. |
| Delegation by module boundaries | met | Build tracks be/fa/fb with separate worktrees and databases (PROGRESS "How to resume"). [claimed + worktree list checked] |
| No microservices or artificial modularity | met | One new module (`admin-access`) with a real owner. |

## Section 5: Progressive discovery

Verdict: **met, but late for four surfaces.**
- Seven surveys were committed at 03:26. They are dated against 3c4da22 and each has a model, an ideal direction and findings.
- Later: `dashboard.md` and `tests-scan.md` at 07:27, then `config-deploy-ci.md` at 08:29. That last survey came 9 minutes *after* PROGRESS.md declared convergence (f65acf5, 08:20). [checked]

## Section 6: The 18 engineering surfaces

| Surface | Inspected? | Covered by and finding |
|---|---|---|
| UI components, styling, design system | yes | frontend-planning FP-1 → IssueCard and CapMeter (#227). frontend-platform §4 left `styles.css` and the duplicated `.avatar` alone. [sub] |
| Domain models and business logic | yes | backend-domain BD-2 → course status derived once in `rules/attempts.ts` (#225). |
| Application services and orchestration | yes | BA-1 → `admin-access/` (#234). BP-4 → sign-in limiter split out (#231). |
| API interfaces and data contracts | yes | BP-3 → `api-errors.ts` (#231). BP-3a and BD-5 → #240. FK-5 → contract coverage (#232, #238). |
| State management and data flow | yes | FK-2/FP-3 → `account-storage.ts` (#224). FA-4 → grants store split (#224). |
| Data access, persistence, caching | yes | BP-1/BD-7 → row locks in `users/account-state.ts` (#229). BP-2 → lock registry (#222). Caching (`useAccountCache`) left alone (frontend-platform §4). |
| Configuration and environment variables | yes, late | config-deploy-ci §1: 1.1 is in batch 22 (#244); 1.2 is for the Lead. BP-8 is deferred until #77. |
| Validation and serialization | partly | Only `backend-platform.md` mentions ValidationPipe. Limits are pinned by contract specs (FP-4 question in #240). No survey examined class-transformer or DTO serialization. [checked by grep] |
| Error handling and retry | yes | BP-3. FP-6 → `useAttempt`. Retry (`SAVE_RETRY_MS`) left alone. |
| Logging, telemetry, observability | partly, late | backend-platform "Error logging" left alone. config-deploy-ci 4.1 (logFailure duplicate) is in batch 22 (#244). No survey mentions telemetry, and none exists in the code. [checked by grep] |
| Authentication, authorization, permissions | yes | Admin write gate (#234). Account state (#229). Session cap → #240. `auth<->users` left alone. |
| Background jobs and async workflows | yes | Notifications created on read → #240. Timers left alone (config-deploy-ci §4). |
| Naming, directory structure, module boundaries | yes | T-2/FK-1 lint layers (#220). Dashboard folder (#237). ADR 0020 (#243). |
| Utilities and shared infrastructure | yes | BP-6: `common` became a leaf and `TermDto` moved (#223). `seeder.ts` rename (#236). |
| Dependency management | yes, late | config-deploy-ci §2 (2.1, 2.2) → batch 22 (#244). |
| Testing strategy and infrastructure | yes | tests-ci-docs T-3/T-4. `tests-scan.md` (#239). FK-5/FK-6. |
| Build, deployment, CI, dev toolchain | yes | T-1 `npm run verify` (#220). The unused CI artifact → #240. config-deploy-ci §3 → the Lead. |
| Repository documentation and agent instructions | yes | T-5, T-8, BD-3, BD-4 (#236). The AGENTS.md diff was checked. Stale points remain (see the end lists). |

## Section 7: Evidence-driven prioritisation

Verdict: **met.**
- Survey findings carry problem, evidence, cost, change, effort, risk, confidence, proof and decision (see config-deploy-ci 1.1).
- The task pool is in PROGRESS.md: decisions, deferred, rejected.
- Measurements are used without being made into targets: edge counts are reported as "direction, not count".

## Section 8: The refactoring loop, checked on three pull requests

| Step | #229 backend (account-state) | #233 frontend (routes and effects) | #239 tests |
|---|---|---|---|
| A Discover | BAC-1 / BAC-7 in surveys | frontend-platform findings; commit counts in the body | `tests-scan.md`: 139 specs read |
| B Understand | Brief `briefs/05-account-state/implement.md` §A lists every site | Brief 12 | The scan lists each finding with its file and line |
| C Evaluate | Body: alternatives "leave it" and "one helper" rejected | Body: glob discovery and derived test lists rejected | Body: rewrite-all and delete rejected |
| D Baseline | **met**: commit 517e7d9 adds tests only (4 files, +96) *before* the refactor commits [checked] | **met**: the route table was serialised before and after and is byte-identical (`proof-before/after.json` in the scratchpad) [claimed + file exists] | Mutation proofs for 23 findings [claimed, not re-run] |
| E/F Implement and retire | 13 sites migrated; the lint rule `identifier-home` forbids the old reads [checked] | `router.ts` −149 lines of records; effects moved out of App.vue [checked] | Removals listed with reasons |
| G Independent review | `scratchpad/batches/05-account-state/review-1.md`: approve, with an old/new SQL table for every site [checked] | review-1: **changes requested** (2 moved tests lost assertions); review-2: approve after the fix commit [checked] | review-1/review-2: 3 problems fixed, then approve [claimed + files exist] |
| H Verify | CI green, 6/6 [checked]; counts in the body | CI green [checked] | CI green; counts match the CI log [checked] |
| I Prevent regression | the `identifier-home` lint rule [checked] | `route-meta.ts` in the kernel list; layer lint [checked] | n/a (tests only) |
| J Checkpoint | All 12 commits G; PR; PROGRESS row | All G | All G |

Verdict: **met** for the loop.

Caveats [checked]:
1. The reviews and batch reports exist only in the session scratchpad (`/tmp/.../scratchpad/batches/`). They are not version-controlled and are lost on a reboot. Batches 01 and 21 have no brief in `converge/briefs/`.
2. GitHub shows 0 human reviews. Human approval is still pending, as AGENTS.md requires.
3. The "CI is green" checkbox is unticked in the bodies of #229, #230 and #233, though CI is green. Cosmetic.

## Section 9: Safety and decision authority

| Item | Verdict | Evidence |
|---|---|---|
| Product functionality and business semantics | met | Backend: the CLC 2025 seed bundles to byte-identical JSON (490,023 chars) [sub]. The rule-engine changes are equivalent; the sub-reader traced `coverage.ts:44`, `standing.ts` and `plan-issues.ts` [sub]. Frontend: 780 admin message leaves are identical in both languages [sub]. |
| Public APIs and external contracts | met | The openapi and migrations diffs are empty. No route decorator changed. The JSON key order of error bodies is pinned by `api-errors.spec.ts`. [checked] |
| Data compatibility | met | No migration or column change. [checked] |
| Auth guarantees and security | met | The SQL of all 13 sites is the same string, apart from one column alias (review-1 of 05). Lock modes are kept. [checked review + sub] |
| Performance and operations | met | Advisory lock numbers are unchanged: 11_012_001/002/003 and 3003 (`git grep` on origin/main vs `common/advisory-locks.ts`). [checked] |
| Ambiguous items deferred, not decided | met | #240, #241, #242 hold 9 + 7 + 5 open points. |
| Blocked items recorded with options | partly met | The open points in the issues have options and a recommendation. Several survey questions never reached a person (see the false claims list). |
| No push, merge, publish or external action without authorisation | claimed, not verifiable by me | 21 PRs were pushed and opened, auto-merge was turned on (#220, by the user's account), reviewers were requested, three issues were opened, and Discord posts were made. The authority is stated only in PROGRESS "Decisions from the Project Lead (28 Nov 2026)". Nothing was merged or deployed. |
| No fabricated verification | met | The counts I sampled (#239 CI log) match. The PR body of #239 is honest that 2 of its 25 rewrites have no mutation proof. |

**Every behaviour change I found in production code** (from the sub-readers, then spot-checked):
1. Backend module order changed. `features.ts:21` is now sorted by name and adds `AdminAccessModule`. In `app.module.ts`, `ThrottlerModule` now comes before the TypeORM root. This changes route registration and `onModuleInit` order. No two routes overlap, and the hooks (notification listener, schedule, purge) are independent. Not user-visible. #234 discloses "sorted by name" but not the effect on runtime order. [checked]
2. `auth.service.ts:101`: a truthy test became `!== null`. They are equal because the column is always Date or null. [sub]
3. `AdminWriteService` is now provided by `AdminAccessModule`, and `AcademicCalendarModule` no longer imports `CurriculumAdminModule`. Only the DI graph changes. [checked]
4. `assertActiveRecipient` selects the column `AS "deletionRequestedAt"`: a result alias only. [sub]
5. `seedCurricula` now receives `options` and ignores them. [sub]
6. The sign-in limiter now shares `PASSWORD_ATTEMPTS` with the route throttler (a new coupling, same values), and `purge()` is public. [sub]
7. `notifications/messages.ts:28`: `titleEn ?? title` became `titleEn || title`. It differs only for `''`, which the backend never stores (`nullIfBlank`). Disclosed in #226. [checked]
8. `groups.ts:24` `groupOf(...)!`: an unknown group id now throws instead of giving `''` (CourseDrawer, every glyph lookup). It cannot happen, because `GroupId` comes from `groupColour`, a closed map. Not disclosed in #230. [checked]
9. `sharing/view.ts:113`: `withheldTitles` dropped `?? []`, and the curriculum guard was dropped. Only a malformed response is affected. [checked]
10. Markup: the roots of IssueCard and CapMeter gain the class `in-editor` or `in-shared`. `.chip.line` became a global rule (`styles.css:184`; disclosed in #227). The shared-page unknown-issue text has different whitespace. None is visible. [sub]
11. ModalDialog shows its status line when `busy !== undefined`, with a default text. The output is identical for every existing caller. [sub]
12. `admin/sections.ts` moved into the entry chunk, so the bundle layout changed. [sub]

## Section 10: Git and execution discipline

| Item | Verdict | Evidence |
|---|---|---|
| Isolated worktree and dedicated branches | met | `cv-stack`, `cv-build-{be,fa,fb}`, `converge`; branches `refactor/cv-NN-*`, `cvb/*`. [checked] |
| Inspect state first; protect user work | met | The user checkout is untouched (see Key measurements). The other agents' worktrees are untouched as far as I can see. [checked] |
| Small, coherent, reviewable commits | met | 117 commits in 21 PRs of 4–12 commits each. A test-first commit where behaviour is sensitive (517e7d9). |
| Motivation, scope, migrations, retirement, verification, docs | met | PR template "Why this design" is filled in. Each batch updates the docs (ADR 0004/0018, architecture.md, class-model.md). An empty changeset per PR. |
| No unrelated mix | mostly met | #236 "docs and extras" is a grab-bag (docs, a rename to `seeder.ts`, test timeouts, a code-search hide), but every item is small. |
| Independently reversible | partly met | Stacked branches with merge commits. Each PR squash-merges on its own, but reverting a lower PR breaks the ones above it. Inherent to stacks. |
| Unsafe batch reverted only | met | The migration-list change was built and then taken out (f51144c "restore the migration registry"). |

## Section 11: Persistent engineering memory

| Record | Verdict | Evidence |
|---|---|---|
| Architecture map | met | `docs/analysis-and-design/architecture.md`: module table §4, lint-checked. [checked] |
| ADRs | met | ADR 0020 (proposed, #243). ADRs 0004, 0010, 0013, 0014 and 0018 updated. [checked] |
| Optimisation task pool | partly met | PROGRESS.md "Needs a decision / Deferred / Rejected" plus #240–#242. Survey items missing from both: see the false claims list. |
| Progress and recovery state | partly met | PROGRESS.md on the pushed branch `refactor/converge` gives resume steps. But: (a) it is stale against 692ee5d and `cvb/22` ("Nothing is building", "all 21 batches"); (b) the review and batch reports live only in /tmp; (c) `goal.txt` is untracked in the user checkout; (d) nothing on main or the stack points to PROGRESS.md except the last line of #242. |
| Concise; no verbose logs | met | PROGRESS.md is 17.9 KB. |

## Section 12: Anti-goals, checked in the stack itself

| Anti-goal | Verdict | Evidence |
|---|---|---|
| Aesthetic refactors | mostly respected | The alphabetical `FEATURE_MODULES` is justified as append-only and pinned by the openapi reversal spec. `style(admin): indent...` (40b42d5) is cosmetic, but confined to the newly split files. |
| Speculative rewrites | respected | none |
| Abstractions for hypothetical needs | minor violations | The generic error-status parameter of `useSavedDocument` has 2 callers. `ROW_LOCK`/`activeOnly` and `noDeletionWaitingSql(alias?)` each serve one or two sites. `SeedOptions` is passed to a seeder that ignores it. |
| Meaningless wrappers | minor violations | `platformImports` (features.ts), `orderedGroups`, `shortCount`, `withheldTitles` (one-liners in sharing/view.ts), `database/seed-options.ts`, and `admin-errors.ts` re-exporting `REFERENCES`. Each costs little, but none passes the deletion test on its own. |
| Centralising unrelated responsibilities | respected | `common/advisory-locks.ts` holds one concept. `account-storage.ts` takes the plan storage keys out of `plans/` to save one function (borderline). |
| Merging different concepts | respected | Lock modes were deliberately not unified (#229 body). |
| Moves without value | respected | The dashboard move ends `audit<->plans`. The catalogue split ends a 1163-line hub. |
| Unnecessary dependencies | respected | No package.json dependency was added. The lockfile is unchanged. |
| Readability sacrificed for LOC | respected | none found |
| Coordination costs raised for consistency | **partly violated** | `scripts/layers.mjs` is a new file that every cross-folder import must edit, and the stale-edge ratchet also forces an edit when an import is removed. ADR 0020 "Consequences" admits that a PR that was green can turn main red. This already happened with #214. |
| Governance costing more than it saves | borderline | About 1,050 lines of custom checker and tables (lint.mjs +447, lint.test.mjs 442, layers.mjs 157), plus contract-coverage specs. They replace prose that held for neither untangle pass, and lint runs in about 1 s. Proportionate today, but it is now a second bespoke tool to maintain. |
| Test expectations changed to hide regressions | respected | #239 changed tests only, with mutation proofs [claimed]. Production was untouched in that PR [checked: the #239 file list is specs and a changeset]. The 2 tests and 3 assertions removed are listed with reasons. |
| Modifying stable areas without benefit | respected | |

## Section 13: Acceptance criteria

| Criterion | Verdict |
|---|---|
| Each core concept has an owner | partly met: the new owners above; class-model.md and the config/pin lists are still copies |
| Coherent modules with discoverable contracts | met |
| No unexplained competing implementations | met (the `variant` props are explained) |
| Explicit dependency directions | met (`layers.mjs`) |
| Unapproved cycles eliminated | met (`auth<->users` and the entity trio are approved in ADR 0020; the frontend folder cycle in depgraph is the root-folder artefact, covered by the layer rule) |
| Business logic decoupled from UI and frameworks | met for the engine (purity check including type imports). Partly for the frontend: the dashboard still sums engine fields (dashboard.md Q2) |
| State ownership understandable | met (grants store, account-storage, effects composables) |
| Changes localised | partly met (the `layers.mjs` hub) |
| Predictable boundaries for features | met |
| Minimal shared context for agents | partly met |
| Proportionate automated enforcement | met |
| Legacy retired after migration | met |
| Functionality, data, security and contracts preserved | met |
| Exceptions intentional, justified, discoverable, bounded | met (ADR 0020 "Accepted exceptions") |

## Section 14: Autonomy and convergence

| Condition | Verdict | Evidence |
|---|---|---|
| High-value safe improvements converged | **not met when it was claimed; nearly met now** | PROGRESS (f65acf5, 08:20) says the stopping conditions are reached. At 08:29 the session itself committed `config-deploy-ci.md`, with 4 findings tagged "[agent] = an agent can do it without a decision". Batch 22 (5 commits, 9 files, +121/−12) covers all four plus the 3.3 alias. It is now draft PR #244 with CI green. What remains for an agent is small (list 1). |
| Remaining items need decisions | partly met | #240–#242 hold the decision items. Some decision items were never filed (see the false claims list). |
| Not stopping at an audit | met | 21 verified PRs. |
| Rolled back and recorded at the stop | partly met | The repo state is coherent, but the records lag the work in progress. |

### Remaining items, sorted

**A. Needs a human decision or approval**
- Approvals for #220, then each stack PR in turn: any teammate. ADR 0020 acceptance: Lâm.
- #240, the Project Lead (Lâm): a code on every 4xx (BP-3a), graduation-condition ids (BD-5), the stale `readiness` sentence (BD-4), the `maxLength`/`maximum` limits, the session cap, notifications created on read, class-model.md, the ADR 0019 status, the unused CI artifact.
- #241, the frontend owner (Hoà): editor vs shared-page styles (8a), the import screen on grant change, the three reference wordings, menu labels, the dashboard questions, the four weak dashboard assertions.
- #242, blocked: BA-4 waits on #166 (OPEN); BP-8 waits on #77 (OPEN); the frontend term-load and coverage sharing waits on the 8a answer; `CreditCapsDto` in rules needs a purity-check special case. All blockers still hold. [checked]
- README.md:24 lists "past-term view" under F3 "Not built yet", while the dashboard loads past-term audits (`DashboardView.vue:93-98`). Whether that counts as the Vision's past-term view is for Hoà or Lâm to say.
- **Not filed anywhere** (Lâm unless stated):
  - backend-platform.md:196: does a sign-in after `purge_after` count as pending?
  - backend-domain.md:146: should offered cohorts become curriculum data?
  - frontend-planning FRO-8: `unlockedBy` inverted in the browser vs an API field (engine owner).
  - dashboard.md Q2: `passedCredits + overflowInCredits` summed in the browser (Lâm and the engine owner).
  - dashboard.md Q5 and F7: moving `reducedMotion`/`compareTerms` to shared modules; the exported but unused `sector` (Hoà).
  - config-deploy-ci 1.2, 3.1, 3.2, 4.2 (deploy and CI belong to the Lead).

**B. Too little benefit**
- FP-7 remainder (the robots meta tag and `copyText`, one user each).
- BD-6 traversal half (low value, per the survey and final-read).
- T-3 migrate-once (the e2e suite takes about 80 s).
- final-read §1.6 (the lint regex on headings fails loudly anyway).
- `.avatar` defined twice. `SIGNED_OUT_BODY_MAX_KIB` is unchecked but has one reader.
- Advisory-lock numbers as literals. `common/advisory-locks.spec.ts` checks only uniqueness, but `account.service.spec.ts:80-81` and `curriculum.service.spec.ts:231` already pin 11_012_001 and 11_012_002 as literals. Only `signInAttempt` (11_012_003) and `aiQuota` (3003; `ai/` belongs to #77) are unpinned. A renumber would matter only during a rolling deploy.
- The ~11 "unsure" tests from tests-scan, left deliberately (#239 "Left as they are"). I read three:
  - `notifications.e2e-spec.ts:701` uses a ternary over a fixed fixture, but can still fail.
  - `CatalogAdmin.spec.ts:348` and `PlanEditorView.spec.ts:651` use an `every` that would pass on an empty list, but the lines before them make the list non-empty in practice.
  - None is shown to be unable to fail. Batch 20's rule needs a mutation proof first. Low value.
- The shallow wrappers in §12: each is cheap to keep, and removing them is churn across open PRs.

**C. Still safely actionable by an agent now, no decision needed** (see list 1 below)

---

## (1) Still safely actionable now

1. **Bring the records in line with the repo** (records only, no decision):
   - PROGRESS.md (`refactor/converge` at 692ee5d) has no row for stack 22 / #244 and no mention of `config-deploy-ci.md`. It still says "Nothing is building", "All 21 batches" and "reached the stopping conditions", and "folder edges the same as at the start" (101 → 102).
   - Issues #240/#241/#242: say "#220 to #239 and #243, #244", and file the unfiled person-questions listed under 14.A (the `purge_after` question, offered cohorts, FRO-8 `unlockedBy`, dashboard Q2/Q5/F7, config-deploy-ci 1.2/3.1/3.2/4.2).
   - Copy the review and batch reports from the session scratchpad (`batches/*/review-*.md`, `report.md`, `adr-0020-review.md`) into `converge/`, so §8 G evidence survives a reboot.
   - Add the missing briefs for batches 01 and 21.

   Safe: these change no code and decide nothing.
2. **Correct two doc facts.**
   - `docs/analysis-and-design/design-differences.md:30` says the past-term audit API is served and "no screen uses it yet". `src/frontend/src/dashboard/DashboardView.vue:97` has called `fetchAuditAsOf(term)` since #214. Replace the sentence with what the code does, without claiming the A2 picker is complete.
   - `AGENTS.md:11` says "TypeORM 1.1" in the "pinned exactly" stack line, while `src/backend/package.json:35` pins 1.1.2. #244's version test does not cover this line.

   Docs only. Either could go on #244 or a small follow-up PR.

Not in this list: batch 22 itself, because it is done and green as #244 and waits only for review. The advisory-lock literals and the unsure tests are under 14.B.

## (2) Claims in the records that are false

1. **PROGRESS.md "Next": "The mission has reached the stopping conditions of the goal (section 14)."** This was premature when written (f65acf5, 08:20).
   - Config, dependencies and CI pins had not been surveyed then, and logging only in part.
   - Nine minutes later the session's own survey (692ee5d) found 4 findings tagged as needing no decision. They shipped as #244.
   - "Nothing is building" was true at 08:20 and went stale at 08:30.
2. **PROGRESS.md:** "Everything that waits on a person is in the repo's backlog as issues." The `purge_after` question, offered cohorts, FRO-8 `unlockedBy`, dashboard Q2 and Q5, and config-deploy-ci 1.2/3.x/4.2 are in no issue (grep of the #240–#242 bodies).
3. **PROGRESS.md:** "The number of folder edges is the same as at the start (101 with the root)." depgraph gives 101 at the start (3c4da22 and 778d120 have the same `src/backend/src`) and **102** at the tip (43422c5).
4. **Issues #240, #241, #242:** "#220 to #239". The stack now ends at #244. #243 (ADR 0020) and #244 are not covered by the merge guidance in #242.
5. **PROGRESS.md:** "auth <-> users ... type-only". depgraph shows a value import in each direction (`users/users.controller.ts → auth/auth.decorators.ts`; auth → users in 9 files). Loose wording rather than an error, since there is no file cycle.
6. **`docs/analysis-and-design/design-differences.md:30`** (on main, not introduced by the stack): "no screen uses it yet" is false since #214 (`DashboardView.vue:97`).

Checked and true: the test counts (CI log of #239); all commits signed; openapi and migrations unchanged; the frontend layer exceptions list is empty; `plans<->sharing` is the only two-way frontend feature pair; only #220 is ready, with auto-merge on; nobody has approved; the blockers in #242 still hold; the user checkout is untouched.

## (3) Verdict

**not reached: 2 actionable items** (records sync; two doc-fact corrections). Both are small and records-only or docs-only. Once they are done, and with #244 landed, every remaining item needs a person's decision or approval, or has too little benefit. The code itself has converged.


---

## Re-check (2026-11-28, about 08:52 +0700)

**What I looked at**
- Stack tip: `refactor/cv-22-config-and-pins` at d43fd09. It is the same commit as on origin.
- Records: `refactor/converge` at 11c3aa8, pushed.
- All new commits are signed (G).
- `node scripts/lint.mjs`: passed.
- `openapi.json` and the migrations still have no diff against origin/main.
- The user checkout is still main with only `goal.txt` untracked.

### (a) The two actionable items

| Item | Status | Evidence |
|---|---|---|
| 1. Records sync | **done** | **PROGRESS.md (11c3aa8):** stack 22 / #244 recorded. `config-deploy-ci.md` named. Line 58 now says "102 folder edges with the root (101 at the start)". The auth/users wording is now precise. "Next" calls the earlier stopping claim premature and lists what remains. "Nothing is building" is true now: every PR is pushed. **Saved files:** `converge/reviews/` holds folders 01–20 and 22 plus `adr-0020-review.md` (batch 21's review). `converge/briefs/` now has 01 and 21. **Issues:** #240–#242 say "#220 to #239, #243 and #244". #240 now holds the purge date, offered cohorts, unlocks, the figure the dashboard sums, test guides, and the deploy/CI points. #241 holds the borrowed dashboard helpers (`reducedMotion`) and indexing of the shared page. |
| 2. Two doc facts | **done** | `design-differences.md:30` now says the dashboard reads the past-term audit (`fetchAuditAsOf`) when a past term is chosen (f888e0f). `AGENTS.md` says "TypeORM 1.1.2" (798a930). `repo-config.spec.ts:109-128` ("AGENTS.md stack line") now checks the stack line against the package versions (d43fd09). |

Also done, from my list of wrappers: `curriculum-admin/admin-errors.ts` no longer re-exports `REFERENCES`. Its callers import from `references.ts` (6b90b80).

### (b) The six false claims

| # | Claim | Now |
|---|---|---|
| 1 | "Stopping conditions reached" / "Nothing is building" | **corrected.** "Next" calls it premature and gives the reason. "Nothing is building" is true again now that #244 is pushed. |
| 2 | "Everything that waits on a person is in the issues" | **now true** for every item I listed (grep of the #240 and #241 bodies). |
| 3 | "Folder edges the same (101)" | **now true**: PROGRESS says 102, and depgraph at d43fd09 gives 102. |
| 4 | Issues say "#220 to #239" | **now true**: all three say "#220 to #239, #243 and #244". |
| 5 | `auth <-> users` "type-only" | **now true.** PROGRESS:58 and ADR 0020:33 say each folder imports the other and no two files do. depgraph confirms the folder cycle and no file cycle. |
| 6 | `design-differences.md:30` "no screen uses it yet" | **now true**: corrected in f888e0f. |

### (c) Further items an agent could do safely now

None found.
- I looked again at the untaken survey findings and the new commits. The remaining items are the ones in 14.A (now all in #240–#242) and 14.B (too little benefit: the one-line helpers, `.avatar`, the two unpinned lock numbers, the unsure tests, FP-7, BD-6, T-3).
- The five new commits are docs, one import-path change and one test. None of them opens new work.

### CI (`gh pr checks`, read at 08:49 and again at 08:52)

- At 08:49, backend and frontend were pending on #231–#239, #243 and #244. The other four checks passed.
- At 08:52, all 6 of 6 checks passed on #231, #232, #233, #234, #235, #236, #237, #238, #239, #243 and #244.

### New verdict

**stopping condition of section 14 reached: every remaining item needs a person's decision or approval, or has too little benefit**

What remains needs people:
- Teammates' approvals, starting with #220.
- Lâm: #240 and acceptance of ADR 0020.
- Hoà: #241.
- #242 waits for #166 and #77 to merge.
