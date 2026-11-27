# Final read of the convergence stack (refactor/cv-16-clc-seeds at 3e5beaa)

Read-only review. Base of the stack: 3c4da22. origin/main is now 778d120 (#214, dashboard, merged after the stack was cut).

## 1. Did the stack make things worse anywhere?

1. **The stack fails lint on top of today's main.** #214 merged into main *before* #220. A clean `git merge-tree origin/main HEAD` (tree 660777c) followed by `node scripts/lint.mjs` fails with 9 problems in 4 new feature edges: `audit -> calendar`, `audit -> notifications`, `audit -> onboarding`, `audit -> plans` (`src/frontend/src/audit/DashboardView.vue:4-13`, `src/frontend/src/audit/dashboard.ts:1,4`). `audit -> plans` together with the listed `plans -> audit` makes a second two-way feature pair. I checked lint only. I did not run a typecheck on the merged tree. Every name the dashboard files import still exists as an export in the merged tree (a grep of the exports for all 20 imported modules), so I expect no type break. #220 is the bottom PR: auto-merge on, `REVIEW_REQUIRED`, merge state `BLOCKED`. Once someone approves it, it lands, and main's lint goes red with it, unless the branch must be up to date first, in which case #220 itself goes red. Smallest fix: add the 4 edges to `scripts/layers.mjs` in the commit that merges `origin/main` into `refactor/cv-01-verify-and-lint-rules`. They cannot land earlier, because the stale-edge check fails on edges that do not exist yet. The better fix is in 3.1.
2. **`docs/analysis-and-design/architecture.md:162` is now false.** It says the `SeedOptions` "that `common/seed-options.ts` parses from the command line". The parser is `src/backend/src/database/seed-options.ts` (`parseSeedOptions`). `common/seed-options.ts` only holds the `SeedOptions` and `Seeder` types. Fix: say "that `database/seed-options.ts` parses". This belongs in batch 17.
3. **Two files with the same name and different jobs.** `src/backend/src/common/seed-options.ts` holds the types and `src/backend/src/database/seed-options.ts` holds the parser. The doc slip above is the first symptom. On main the flag was parsed inline in `database/seed.ts`. Smallest fix: rename the common file to `common/seeder.ts`, since it exports `Seeder` and `SeedOptions`. Three files import it: `guides/seed-guides.ts`, `database/seed.ts` and `database/seed-options.ts`. The split itself is right: curriculum and guides must not import `database`.
4. **Low, keep it:** `codedError(..., { before, after })` in `src/backend/src/common/api-errors.ts:17-23`. The parameter exists only to keep the JSON key order of today's bodies, which `api-errors.spec.ts` pins. A caller has to know that order to pick `before` or `after`. That is the price of byte-identical responses with the contract fixed. Do not change it now. If BP-3a (every 4xx gets a `code`) is decided, drop the parameter then.
5. **Low, already parked:** `plans/CapMeter.vue` and `plans/IssueCard.vue` take a `variant: 'editor' | 'shared'` prop that carries two stylings. The duplication moved into the component instead of going away. It resolves itself with decision 8a (Hoà). No action until then.

6. **Low:** `checkModuleIndex` in `scripts/lint.mjs` finds the module table through the regex `^## 4\. ... ^## 5\. ` in architecture.md. If someone renumbers those sections, lint fails on every module (loudly, not silently). Leave it, or match the table by its header row instead.

What I read and found no worse than main: `admin-access/*`, `users/account-state.ts`, `common/advisory-locks.ts`, `common/api-errors.ts`, `auth/sign-in-limiter.ts`, `features.ts` and `app.module.ts`, `database/seed.ts`, the frontend `router.ts`, `route-meta.ts`, `*/routes.ts`, `App.vue`, `admin/access.ts`, `admin/grants.ts`, `admin/sections.ts`, `admin/saved-document.ts`, `account-storage.ts`, `async-load.ts` (`useAttempt`), `testing/routes.ts`, `plans/CapMeter.vue`, `plans/IssueCard.vue`, `curriculum/seeds/clc-2025-courses.ts` and one `*.groups.ts`, and the lint rules (identifier homes, coded-error homes, module reachability, module index, edge ratchet with a stale-edge check; lint runs in about 1 s). Not read line by line: the `rules/` batch-04 diff, `curriculum-admin/references.ts`, `sharing/view.ts`, `transcript/draft.ts`, `plans/actions.ts` and `contract-coverage.spec.ts`.

Fixed-contract checks: `openapi.json` and the migrations are untouched. The two `*.entity.ts` edits only move the `TRAINING_TYPES` and `REQUIREMENT_GROUP_KINDS` lists to `curriculum-rules.ts`, with columns unchanged. Test titles go from 1758 to 1909. Exactly two titles disappeared, and both were renamed to a wider check: `rules.service.spec.ts:138` now covers type imports too, and `admin/api.spec.ts:346` now covers `grants.ts` too. No test was removed.

## 2. Are the records true? (PROGRESS.md on refactor/converge at 0d314c3)

1. **"Follow-ups owed to teammates", #214: overtaken and incomplete.** It assumes #220 merges first and #214 rebases. In fact #214 merged first (778d120). It lists 3 edges, but 4 are needed (`audit -> onboarding` is missing). It also says nothing about `audit <-> plans` becoming a second two-way pair.
2. **"State of the structure at stack 14" is stale at the tip (stack 16):**
   - "97 folder edges (101 at the start)". At the tip it is 101 again, the same as the base: admin-access added 6 edges and removed 2. Without the root it is 83 vs 84. The backend win is the end of the `curriculum <-> curriculum-admin <-> database` cycle and of `common -> terms`, not the edge count.
   - "`plans <-> sharing` is the one two-way pair": true only without main. With main it is false (`audit <-> plans`).
   - "Largest files": leaves out `audit/DashboardView.vue`, which is 925 lines after the merge with main, the 3rd largest.
   - The test counts cannot be checked without running the suites. Not verified.
3. **The stack table** has no row for stack 16 (`refactor/cv-16-clc-seeds`, #235). Its State column is shifted: row 03 reads "stack 04, #223", row 04 "stack 06, #225", row 06 "stack 12, #231", row 07 "stack 15, #234", and row 08 says "building" although #227 is open.
4. **The plan table statuses are false:** 04 "building", 05/06/07/08/13/14/16 "todo", 11 "building", 09 "polishing", 15 "building". All of them are pushed as #222 to #235.
5. **"Completed batches"** lists only 01. **"Next"** says "Building: 07 ... Then 08". 07 is #234 and 08 is #235, both pushed.
6. **"Baseline (main at 3c4da22)"** is still the stack's base, but main has moved to 778d120. The record does not say so.
7. **Rejected, "Module self-registration by folder scan, dependency-cruiser, eslint-plugin-boundaries, generated API types: ... ADR 0002 and architecture.md already decided against them":** only partly true. ADR 0002:26 rejects globs for *migrations*, and architecture.md:216 rejects generated API types. No doc mentions dependency-cruiser, eslint-plugin-boundaries or module self-registration. The rejection may still be right (new machinery that `scripts/layers.mjs` makes unnecessary), but the stated basis is wrong.
8. **True as written:** `migrations/index.ts` is unchanged and `index.spec.ts:23` fails on an unlisted file. BA-5 is covered by `notifications/api.spec.ts:49-50`. #166 and #77 are still open, so both deferrals still hold. The backend cycle `auth <-> users` is the only folder cycle left, and the curriculum entity file cycle remains. There are 19 frontend feature edges and no layer exception. `admin/messages.ts` is a 40-line index over `admin/messages/*`. The `CreditCapsDto` and `audit -> plans` limitation is real.

## 3. What is still worth doing?

1. **Reconcile with #214: move the dashboard out of `audit/` into its own `dashboard/` feature folder** (frontend planning; blocking).
   - Evidence: `audit/DashboardView.vue` (925 lines on main), `audit/dashboard.ts` (346) and `audit/dashboard-messages.ts` import calendar, notifications, onboarding and plans. `audit/routes.ts` already exports `dashboardRoutes` apart from `auditRoutes`.
   - Cost today: the stack cannot merge green. If the 4 edges are simply added, `audit` becomes a hub, and `audit <-> plans` turns the plans feature and the audit feature into one unit for any future change.
   - Change: `git mv` the three dashboard files, their spec and `dashboardRoutes` into `src/frontend/src/dashboard/`. Add the edges `dashboard -> audit|calendar|notifications|onboarding|plans` to `scripts/layers.mjs`. `audit` then stays a leaf over `curriculum` and `transcript`, and no new two-way pair appears.
   - Risk: low. The route path and name stay, and so do the messages. Nothing outside `audit/` imports the dashboard files except `router.ts`, through `audit/routes.ts`. Other files only mention the route name. The dashboard specs move with the files. They still import `audit/testing/fixtures.ts` (test files, outside the production layer check). One open branch, `feat/dashboard-term-classification` (aefbf9a), edits `audit/api.ts` and `audit/testing/fixtures.ts`, but not the dashboard files, so it does not conflict.
   - Why a PR: it is required to land the stack, and it is the cheaper of the two ways to make it pass. The other way is to add 4 edges plus a two-way pair. PROGRESS already offers this as "if Hoà prefers", so ask Hoà once, then do it.
Not separate pull requests:
- Fold into batch 17: fix the `architecture.md:162` sentence and rename `common/seed-options.ts` to `common/seeder.ts` (see 1.2 and 1.3).
- Refresh PROGRESS.md with every item in section 2.

Per area:
- **Backend platform:** nothing more is worth doing. BP-8 waits for #77 and BP-3a waits for a decision. `FEATURE_SETUPS` with one entry is justified (survey section 4).
- **Backend domain:** nothing more is worth doing. BAC-6 (`courseCodesOf` in `rules/plan-issues.ts:58`, `groupIdsOf` in `plans/plan-board.ts:35`) is real but its own survey rates it low value. `audit.dto.ts` was looked at and correctly left alone.
- **Backend admin and content:** nothing beyond BA-4, which waits for #166.
- **Frontend kernel:** nothing more is worth doing.
- **Frontend planning features:** item 1 only. `plans/PlanEditorView.vue` (956 lines) and `sharing/SharedPlanView.vue` (769) are big but not hot: neither is among the 30 files with the most commits since 1 Nov. Splitting them would be symmetry work.
- **Frontend admin and content:** nothing more is worth doing. `admin/api.ts` (368 lines) serves five screens but is not a collision hotspot.
- **Tests and tooling:** item 1 (the lint/main reconciliation). Nothing else. T-3 stays rejected.
- **Docs and agent instructions:** nothing beyond batch 17 as planned, plus the two batch-17 notes above.

not yet: 1 item: move the dashboard into dashboard/ so the stack passes lint on top of main after #214.
