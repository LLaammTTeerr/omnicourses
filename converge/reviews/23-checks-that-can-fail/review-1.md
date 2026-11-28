# Review round 1: batch 23 (checks that can fail)

Branch cvb/23-checks-that-can-fail, base 790ce3fa. Commits: 499968f (part A), 1f5b30a (part C). Part B left out.

## Verdict: changes requested (one blocking finding)

## Blocking
1. src/frontend/src/auth/store.spec.ts:16 (part C incomplete). The brief names this file explicitly. The report leaves the whole file out because it "tests the generic request function with deliberately fake routes (/x)". That is true for 1 of the 13 tests in the 'auth store (ADR 0002)' describe (line 143, requestAsUser/sendAsUser on /x). The other 12 mock real contract routes (POST /auth/sign-in, POST /auth/refresh, POST /auth/sign-out), and none of them is checked against openapi.json. The brief says to leave the out-of-contract *call* as it is, not the whole spec.
   Fix: use restoreMocksAfterCheckingCalls() in the afterEach at line 16. Put the one /x test (line 143) in its own describe that keeps vi.restoreAllMocks(), with its assertions unchanged, and list it as rightly outside the contract. Keep the it/expect counts the same.

## Non-blocking
- src/frontend/src/api.spec.ts:22-29. The fetchHealth test calls GET /health, which is in the contract, and restores inline with vi.restoreAllMocks(). Only the 'request' describe (/things) is rightly outside. Optional: check the health test too.
- src/frontend/src/testing/fetch.ts:28. `String(input).slice(API_URL.length)` repeats the path logic from mockApi (line 17) and does not check that the URL starts with API_URL. Optional: one small apiPath(input) helper that both use.
- hang() in testing/fetch.ts spies on fetch with no route check. Its callers (api.spec.ts, notifications/NotificationsView.spec.ts) are only checked when the file's afterEach uses the new helper; NotificationsView.spec does not.
- src/backend/src/repo-config.spec.ts:68. `key.includes('*')` takes a key to be a glob only if it contains '*'. Vitest treats every key that is not an option name as a glob, so a file-path key (no '*') would be skipped. Optional: filter out Vitest's threshold option names (statements, branches, functions, lines, perFile, autoUpdate, 100) instead.
- The coverage test does not catch the gate being widened (for example 'src/**' still covers rules/ and passes, but that measures 80 % over all of src). This is outside the brief, so just noting it.
- The new import lines in the 17 frontend specs come after the other relative imports, not in the file's import order. Cosmetic.

## Checked
1. Behaviour: no production code changed (the diff touches only specs, testing/fetch.ts, docs/test/test-plan.md and a changeset). restoreMocksAfterCheckingCalls always calls vi.restoreAllMocks() (in a finally block), so mocks are restored just as before. The check only adds failures.
2. Contract: the diff of openapi.json, migrations and package-lock.json is empty.
3. Tests: in all 17 frontend specs the only change is restoreAllMocks to the helper, plus the import. it/expect counts are the same before and after (my counts: account 6/13, admin 10/27, SignInView 6/15, calendar api 3/6, Calendar.browser 5/16, curriculum 4/8, guides api 7/15, Guides.browser 2/3, notifications api 4/10, Notifications.browser 2/6, onboarding store 7/22, plans 8/20, Privacy.browser 1/2, router.browser 3/7, sharing 5/20, HomeView 5/2 plain expect(, App.browser 1/2). repo-config.spec.ts goes from 9 to 12 its, all new. No expectation was changed.
4. Completeness: nothing was renamed or retired. A search for direct fetch spies found two untouched files: api.spec.ts (rightly outside, /things) and auth/store.spec.ts (see blocking finding 1). Nothing under dashboard/ changed.
5. Structure: one helper in testing/fetch.ts reuses contractHasRoute, with no second matcher. The backend spec imports ../vitest.config.mjs, which tsconfig.json includes (*.config.mts); the build config excludes specs. Lint (layers) passes.
6. Repo rules: no comments, no new dependency (node:fs globSync is on Node 22), no magic numbers. Both commits are signed (G) with Conventional subjects. There is exactly one new changeset, and it is empty (fine for a test-only change).
7. Scope: no off-limits file changed. docs/test/test-plan.md is the one allowed docs file.
8. Proofs:
   (a) I set the glob key to 'src/rulez/**'. 2 tests failed ("matches at least one production file ... src/rulez/**" and "covers every production file of the rule engine"). Restored.
   (b) Not applicable: part B is not in the branch.
   (c) In calendar/api.spec.ts I added a call to ${API_URL}/no-such-route. It failed with "Call is not a route of openapi.json: GET /no-such-route". Restored. git status is clean.
9. Drift checks: none removed. Part B was left out, and the report gives the drift output: CHECK constraints that the migrations create but the entities do not declare (users has no @Check), and foreign-key name differences. That is a legitimate leftOut under the brief, and the decision belongs to the Project Lead.
10. Frontend counts: see 3.
11. test-plan.md: line 33 matches deploy.yml (workflow_run on CI for main goes to production, a push to staging goes to staging, over SSH). The CI backend job runs `npm run test -w src/backend`, which runs repo-config.spec.ts. Line 154 matches what the test does.
Runs: repo-config spec 12/12, typecheck PASS, lint PASS, the 10 jsdom specs 203/203, the 7 browser specs 26/26.
