# Review round 1: 19-route-contract

Verdict: approve. No blocking findings.

## Checked
1. Behaviour: mockApi's matching of calls is unchanged; the only addition is a registration-time check that throws "Route is not in openapi.json: <key>". contractHasRoute: prefixes /api, strips the query, splits on '/', requires same segment count, same method (case-insensitive), literal segments equal, {name} segments non-empty. Contract path items carry only get/put/delete/post/patch keys (no path-level parameters), and every path starts with /api/.
2. Contract: git diff base..HEAD -- src/backend package-lock.json is empty. No route, DTO, status or migration touched.
3. Tests: only admin/write.spec.ts changed: route key and the requestAsUser path '/admin/x' became '/admin/access/users/u/programs/p' (an arbitrary path the test sends itself; no assertion changed). New contract.spec.ts has 6 cases. Unit suite: base 1396 tests / 93 files, HEAD 1402 / 94 (+6 = the new spec). Browser suite HEAD: 68 passed / 13 files; no browser spec changed. Mutations of contractHasRoute (drop method check, drop length check, drop query strip, drop empty-segment check) are each caught by a contract.spec case.
4. Completeness: nothing retired.
5. Structure: one new import, testing/fetch.ts -> testing/contract.ts (same folder). depgraph edges identical (845) to base. No escape hatch added, none needed.
6. Repo rules: no comments, no dependency, no magic numbers (API_PREFIX, PARAMETER_SEGMENT named). Commits f508b96 and f0bc0fe both G, Conventional. One changeset (.changeset/19-route-contract.md, empty like 18). typecheck 0, npm run lint 0.
7. Scope: testing/fetch.ts is in the brief's off-limits list (PR #214) but PR #214 is MERGED (2026-11-27) and the objective requires editing it; accepted. No production file, no backend file changed. architecture.md: the sentence was added to both (pre-existing duplicate) "API types" rows, consistently.
8. Defeat: renaming '/academic-calendar' to '/academic-calendars' in calendar/api.ts and its CalendarView.spec key fails 19 tests with "Route is not in openapi.json: GET /academic-calendars". '/academic-calendar/extra' and 'POST /academic-calendar' are refused the same way. With write.spec reverted to base, the only refusal across unit and browser suites is PUT /admin/x, so no production route is missing from the contract. Worktree restored clean.

## Non-blocking
- testing/fetch.ts:9: a mockApi key with no space (e.g. 'GET/x') makes path undefined and throws a TypeError from contractHasRoute instead of the named error. Fix: check that the key splits into method and path and throw the same named error otherwise.
- testing/contract.ts:79: contractHasRoute upper-cases the method, so mockApi({'get /academic-calendar': ...}) passes the check yet never matches a call (mockApi compares case-sensitively). Harmless (the test would fail on "Unexpected API call"), but comparing the method exactly would keep the two in step.
- testing/contract.ts:68: API_PREFIX '/api' repeats the suffix of API_URL's default in api.ts; fine for tests, but worth noting if the prefix ever changes.
- Many specs still spy on fetch directly (api.spec.ts files, browser specs) and bypass the route check; out of scope for this batch, but the architecture sentence says "the test API mock (mockApi)", which is accurate.

## Implementer's report
report.md was not present at /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/19-route-contract/report.md when checked, so the implementer's stated omissions could not be compared. My own run shows the one refused route (PUT /admin/x in admin/write.spec.ts) and that no production route is missing from the contract.
