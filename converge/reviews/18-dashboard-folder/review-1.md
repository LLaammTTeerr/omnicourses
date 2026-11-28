# Review round 1: 18-dashboard-folder

Verdict: approve. No blocking findings.

## What I checked
1. Behaviour: the five moved files differ from the originals only in import paths (git diff -M: DashboardView.vue 5 import lines, dashboard.ts 2, DashboardView.spec.ts 3, dashboard.spec.ts 2, messages.ts 100% similar). The dashboard route record in dashboard/routes.ts is byte-identical to the one removed from audit/routes.ts; router.ts spreads dashboardRoutes at the same position (after onboardingRoutes, before calendarRoutes).
2. Contract: git diff base..HEAD on openapi.json, migrations, package-lock.json is empty. No backend file touched.
3. Tests: only the two moved specs changed, each only in import lines; no it/test/expect lost. vitest on src/dashboard src/audit src/router src/shell: 12 files, 163 tests pass. Frontend typecheck passes. npm run lint (including lint.test.mjs, 43 tests) passes.
4. Completeness: no remaining reference to audit/DashboardView, audit/dashboard, dashboard-messages in src, scripts, deploy, .github, docs/analysis-and-design, AGENTS.md, README.md (only the stale built dist/ bundle, which is not tracked source). architecture.md (diagram and table), class-model.md, UC-03 diagram updated. README names no path.
5. Structure: depgraph at base vs HEAD: audit now depends only on (root), auth, curriculum, shell (before: also calendar, notifications, onboarding, plans). audit -> plans gone, so the audit<->plans cycle is broken; plans -> audit remains (pre-existing, plans/present.ts). The only folder cycle is the existing one through (root), unchanged apart from the new folder. No wrapper or copied code; dashboard imports audit's api/present/AuditGate/messages across folders.
6. Repo rules: no comments added, no dependency, no lockfile change; three commits, all G and Conventional; exactly one new changeset (.changeset/18-dashboard-folder.md, empty).
7. Scope: only the objective's files. The off-limits PR #214 files were touched only by the move the brief requires (import-path lines).
8. Route proof rebuilt independently (git archive of base and HEAD into scratch, temporary spec serialising routes: path, name, redirect, full meta, lazy/eager component, children, canonical key order): 26 records, outputs byte-identical.
- layers.mjs final frontend edges for these folders: audit -> curriculum, audit -> transcript; dashboard -> audit, calendar, notifications, onboarding, plans. Lint accepts them.

## Step D
Not taken, correctly: DashboardView.vue lines 141 and 683 use `GROUPS.find((g) => g.id === c)?.short[locale.lang]` with optional chaining (and a fallback at 141) over Colour = GroupId | 'none'. groupShort takes a GroupId and asserts the group exists, so replacing them would change behaviour for 'none'. Not the `!.glyph` pattern the brief names.

## Non-blocking
- class-model.md new dashboard/ row says "none" for store and API; accurate, but the composing note could also name AuditGate reuse. Optional.
- dashboard.spec.ts and DashboardView.spec.ts import ordering: '../audit/...' imports now sit after local './' imports; purely cosmetic.

## Implementer's report
report.md did not exist at review time, so its stated omissions and its route proof could not be cross-checked; my own route proof stands in for it. The report should include the route proof result and the final edge list as the brief requires.
