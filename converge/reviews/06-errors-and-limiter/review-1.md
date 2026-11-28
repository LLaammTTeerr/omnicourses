# Review round 1: 06-errors-and-limiter (cvb/06-errors-and-limiter, base e22e303)

Verdict: changes requested (one blocking finding, a missing test).

## Blocking
1. src/backend/src/common/api-errors.ts:17-23 (codedError, forbidden) has no spec that pins JSON key order.
   - Problem: the only new logic in part A is where `extra` goes: `before` the message for forbidden and prerequisiteCycle, `after` it for conflict and importRejected. No unit or e2e test checks key order. Every existing assertion uses toMatchObject, toEqual on single fields, or body.code. So if `before` and `after` were swapped, or `forbidden` passed `{ after: extra }`, every test would still pass, and the permission_required body would change from statusCode, code, permission, message to statusCode, code, message, permission. The brief calls key order part of the contract.
   - Fix: add src/backend/src/common/api-errors.spec.ts (or extend admin-errors.spec.ts) that asserts `JSON.stringify(e.getResponse())` as exact strings for: `forbidden('permission_required', msg, { permission })`, `conflict(code, msg, { references })`, `prerequisiteCycle(['A','B','A'])`, `importRejected(msg, errors)`, and one call with no extra fields. Also assert getStatus() and the exception class.

## Non-blocking
- api-errors.ts: `conflict(code, message, extra)` and `forbidden(code, message, extra)` take the same arguments but put `extra` in different places (after vs before the message). A future caller of forbidden with extra fields gets an order it may not expect. Either name the forbidden parameter for where it goes (for example `fieldsBeforeMessage`), or add a one-line note in an ADR or doc. The spec above will pin the behaviour either way.
- sign-in-limiter.ts:41 `purge` is public, but only reserve() calls it. The brief listed it, so keeping it is fine, but `private` would make the surface smaller.
- signInAttemptKey stays in auth.service.ts. BAC-4 step 1 wanted it in the limiter, but the brief lists only reserve, clear and purge, and the implementer says moving it would create an import cycle. Acceptable.
- The 429 text "try again in a minute" is still a fixed string, while the window now comes from PASSWORD_ATTEMPTS.ttl. This was already true before the batch; the risk is drift.
- The lint rule matches only `new XException(`. A subclass calling `super({ code: ... })` outside ai/ is not caught. The brief scoped the rule to `new`, so this is fine for now.
- sign-in-limiter.spec.ts drives the limiter through a real AuthService, so it is really an integration test of both classes. That is the same test moved over, so it is acceptable, but a later direct limiter test would be cleaner.

## What I checked
1. Behaviour, line by line:
   - reserve/purge/clear against the old reserveSignInAttempt/purgeExpiredSignInAttempts and signInAttempts.delete: same SQL, the same advisory lock call (NAMESPACED_LOCKS.signInAttempt, hashtext), the same order (lock, prune own key, count, 429, insert, then purge outside the transaction), the same 429 text and status, and the same batch of 100. PASSWORD_ATTEMPTS is { ttl: MINUTE_MS, limit: 10 }, which matches the old MAX_FAILED_SIGN_INS and FAILED_SIGN_IN_WINDOW_MS, and PASSWORD_LIMIT stays the same object shape.
   - references.ts is identical, character for character, to the removed block. admin-errors.ts re-exports REFERENCES and CountedReference, so its callers (catalog-admin.service, curriculum-admin.service, admin-errors.spec) are unchanged. references.ts imports nothing.
2. Contract: `git diff -- openapi.json migrations package-lock.json` is empty. No route, DTO, class name, status or code changed. AdminErrorDto is untouched.
3. Tests: the three limiter cases in auth.service.spec.ts moved to sign-in-limiter.spec.ts unchanged (I compared them visually: every it() and expect() is the same, and the fake repo is copied verbatim). The AuthService spec now uses a stub limiter; none of its remaining tests lost anything. The lint test adds two cases, which catch dropping the home exemption, dropping argumentsEnd, and missing comment masking. Results: 24 unit spec files and 195 tests pass for auth, curriculum-admin, notifications, audit and common. `node scripts/lint.mjs` passes, and lint.test.mjs passes 43 of 43. `tsc --noEmit` is clean.
4. Completeness: grep finds no reserveSignInAttempt, purgeExpiredSignInAttempts, MAX_FAILED_SIGN_INS or FAILED_SIGN_IN_WINDOW in src, scripts, docs, AGENTS.md or README. The only hand-built envelopes left are ai/ai-unavailable.error.ts (allowed, uses super) and csv-import.service.ts:313 (no code, and the file is off limits).
5. Structure: no new edges between folders. audit->common and notifications->common already existed at base; sign-in-limiter->rate-limits is inside auth/. The depgraph run shows no new cycle. codedError has more than two callers, so the brief's condition for a general helper is met.
6. Repo rules: no comments in the added code (the only `//` is inside a lint test fixture string), .js import suffixes, no magic numbers (SIGN_IN_ATTEMPT_PURGE_BATCH is named), no new dependency. All three commits are signed (G) and have Conventional subjects. Exactly one new changeset, which is empty, as in the other refactor batches.
7. Scope: no off-limits file touched; nothing under ai/, advisor/ or the PR #214 and #166 files. The diff touches only the frontend: none.
8. Serialization: in a scratch vitest spec, I compared [class, status, JSON.stringify(getResponse()), message] for the old and new construction of all 13 sites and helpers: notificationNotFound, notFound, validationFailed (array), conflict with extra, onboarding_required, curriculum_not_found, permission_required, account_deletion_pending, prerequisite_cycle, importRejected, payloadTooLarge, compressedBody, referencedItem. All 13 strings are identical, key order included.

## Implementer's report, read after my findings
It matches what I found. The changes it calls out (the admin builders moved onto codedError, signInAttemptKey kept in auth.service.ts) are explained and check out. The report does not mention the missing key-order test.
