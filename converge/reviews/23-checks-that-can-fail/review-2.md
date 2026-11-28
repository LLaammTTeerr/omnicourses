# Review round 2: batch 23 (checks that can fail)

Branch cvb/23-checks-that-can-fail, base 790ce3fa. New commit since round 1: da83780 (signed G, Conventional subject), touching only src/frontend/src/auth/store.spec.ts. Part B is still left out (real drift, Project Lead decides).

## Verdict: approve

## Round-1 blocking finding: fixed
src/frontend/src/auth/store.spec.ts: the 'auth store (ADR 0002)' describe now uses restoreMocksAfterCheckingCalls() in its afterEach (line 17). The one /x test (requestAsUser/sendAsUser) moved unchanged, in the same place in the file, into its own describe 'calls outside the contract' (line 145) with vi.restoreAllMocks() and the same beforeEach. The report lists it as rightly outside the contract. it( 18/18 and expect( 52/52 before and after; no expectation changed (the diff only adds the import, swaps the afterEach and opens the new describe).

## Blocking
None.

## Non-blocking
- store.spec.ts:146-150 repeats the beforeEach of the first describe (sessionStorage.clear, localStorage.clear, setActivePinia). A nested describe would inherit the parent's checking afterEach, so the split is right; a small shared reset function would avoid the copy.
- The moved test's full name changes from 'auth store (ADR 0002) > sends a call ...' to 'calls outside the contract > sends a call ...'. Optional: name the describe 'auth store: calls outside the contract'.
- Round-1 non-blocking items stay open, as the report says (fetchHealth in api.spec.ts, apiPath helper, hang(), threshold-key filter, widened glob, import order).

## Checked
1. Behaviour: no production code changed in da83780. The helper still restores mocks in a finally block.
2. Contract: no change to openapi.json, migrations or package-lock.json (diff since round 1 is one spec file).
3. Tests: store.spec.ts counts 18 it / 52 expect, same as base; spec runs 18/18.
4/7. Scope: only the named spec changed; nothing under dashboard/ or off-limits files.
6. Repo rules: no comments, no new dependency, signed commit, still exactly one changeset (.changeset/23-checks-that-can-fail.md).
8(c). Proofs on this file: (i) added a fetch to ${API_URL}/no-such-route inside the first test: it failed with "Call is not a route of openapi.json: GET /no-such-route"; restored. (ii) switched the new describe's afterEach to restoreMocksAfterCheckingCalls: the /x test failed with "Call is not a route of openapi.json: GET /x", which confirms /x is the only out-of-contract call and the other 12 tests' calls pass the check; restored. git status --short empty.
Runs: store.spec 18/18, frontend typecheck PASS, lint PASS.
