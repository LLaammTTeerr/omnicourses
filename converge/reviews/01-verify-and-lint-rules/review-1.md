# Review round 1: batch 01-verify-and-lint-rules

Verdict: approve. No blocking findings.

## What I checked
1. Behaviour: the batch changes no file under src/ or .github/ and leaves package-lock.json alone (`git diff --stat` covers only .changeset, AGENTS.md, README.md, architecture.md, package.json and scripts/). The only rewritten logic is in scripts/lint.mjs. The old no-vue-fetch check was folded into checkFetchOutsideApi and now covers .vue and production .ts files except api.ts. It masks style blocks and comments exactly as before. The rule id changed from no-vue-fetch to no-fetch-outside-api, and no file in the repo references the old id. Small difference: .vue files inside testing/ are now exempt (none exist). checkVueSfcRules keeps its scoped-style logic unchanged.
2. Contract: no diff in openapi.json, migrations or the lockfile.
3. Tests: no existing spec changed. scripts/lint.test.mjs is new: 33 tests, all pass. Every rule has a failing case and a clean case. It includes a multi-line import, a type-only import, a dynamic import, export * from, a side-effect import, a Vue script block and the stale-list cases.
4. Completeness: nothing still points at no-vue-fetch. CI calls `npm run lint` (ci.yml:157), which now also runs the checker's test.
5. Structure: the generated lists match an independent graph I built with TypeScript's preProcessFile (static, type-only, re-export and dynamic imports; .vue script blocks; same resolution rules). Backend edges, frontend feature edges and frontend layer exceptions show no edge missing and none invented. observedLayerData() equals layers.mjs exactly. All 84 backend edges match the depgraph.mjs folderEdges (non-root). Every table is sorted and has no duplicates. The kernel and composition lists match the task, and the code needs no correction: lint finds zero layer violations apart from the two auth/store.ts exceptions, and my independent graph agrees.
6. Repo rules: no comments, no dependency, all 3 commits signed (G) with Conventional subjects, exactly one new changeset (empty, which fits a chore).
7. Scope: no off-limits file touched.
8. Defeat attempts. I planted each one on its own, ran `node scripts/lint.mjs`, then restored the tree (`git status --short` is empty):
   - backend terms -> plans as a static, multi-line, type-only, multi-line type-only, export *, export * as, side-effect, dynamic, or mixed default+named import: each FAILS with backend-import-direction at the right line.
   - a feature importing router.ts: FAILS with frontend-layers.
   - kernel groups.ts importing plans/lock.ts, statically or dynamically: FAILS with frontend-layers.
   - components/ApiStatus.vue importing a feature from <script setup>: FAILS with frontend-layers.
   - fetch( in admin/store.ts: FAILS with no-fetch-outside-api.
   - a new feature edge explorer -> admin: FAILS with frontend-feature-edges.
   - an orphan terms/orphan.module.ts: FAILS with modules-registered.
   - process.env in test/support, or debugger in an e2e spec: FAILS.
   - removing a still-existing edge (plans -> audit, privacy -> account) or the auth/store.ts -> plans/lock.ts exception: FAILS at the importing line.
   - deleting the health -> auth import: FAILS as stale at layers.mjs:45. An invented backend entry and an invented exception fail as stale too.
   - **Bypass:** a string containing "/*" before an import, with a block comment later in the file (`const p = 'src/*.ts';` then import, then `/* x */`), lets the import PASS. The cause is maskComments, which predates this batch and which the task told the batch to reuse.

## Non-blocking
- scripts/lint.mjs maskComments (used by importsOf): a "/*" inside a string literal masks every line up to the next "*/", so the imports in between go unseen (shown above). Fix: mask comments with a scanner that skips string and template literals, or at least do not start a block comment inside a quoted string. The no-fetch and process.env rules share the same hole.
- scripts/lint.mjs isBackendProduction: it only returns isProductionFrontendFile(relPath). A name that says "frontend" is applied to backend files. Fix: rename isProductionFrontendFile to isProductionFile and drop the wrapper.
- scripts/lint.mjs: the layer names 'kernel', 'composition' and 'feature' are repeated string literals in frontendLayerOf, layerViolation, checkFrontendFeatureEdges and observedLayerData. Fix: name them in one constant, e.g. LAYER = { kernel: 'kernel', ... }.
- scripts/lint.mjs checkModulesRegistered: two orphan modules that import each other both pass, because any *.module.ts counts as a registrar. This matches the task's wording. Fix if wanted: walk reachability from features.ts and app.module.ts instead.
- scripts/lint.mjs entryLine reads layers.mjs twice per stale entry. Fix: read it once.
- scripts/lint.test.mjs: no rule-level test plants a dynamic import in the frontend graph (importsOf covers it), and no test checks the style-block masking in no-fetch-outside-api.
- docs/analysis-and-design/architecture.md:280: the new paragraph is an undated bullet placed above the dated "2026-11-26:" decision bullets. Fix: make it a row of the cross-cutting table, or a sentence in the "Linting and typecheck" row, which could also name `npm run verify`.
- AGENTS.md:32 still says API calls go in api.ts "(or a sibling module)". Lint now allows fetch( only in api.ts. That is not a contradiction, because sibling modules call api.ts helpers, but the sentence could say so.
- The implementer's report.md does not exist at the expected path, so I could not check the stated omissions or the classification rationale. The classification needed no change; see check 5.
