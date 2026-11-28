# Review round 2: 06-errors-and-limiter (cvb/06-errors-and-limiter, base e22e303)

Verdict: approve. The round 1 blocking finding is fixed. No new blocking findings.

## Round 1 fix
- Asked: a spec that pins the exact JSON body (key order), status and class of forbidden, conflict, prerequisiteCycle, importRejected and a call with no extra fields.
- Made in 96fe5d6 (signed G, Conventional subject): src/backend/src/common/api-errors.spec.ts. It asserts exact JSON.stringify(getResponse()) strings for all five cases, getStatus() for four, and toBeInstanceOf for three.
- Mutations it catches: forbidden switched to {after}, so test 1 fails. conflict switched to {before}, so test 2 fails. before and after swapped inside codedError: tests 1 to 4 fail. prerequisiteCycle or importRejected using the wrong slot: tests 3 or 4 fail. Spreading extra in when it is empty can't change anything, and test 5 covers it.
- The expected strings match the old bodies I serialized in round 1 (permission_required: statusCode, code, permission, message; prerequisite_cycle: statusCode, code, cycle, message; conflict and import: extra after message).

## Blocking
None.

## Non-blocking
- src/backend/src/common/api-errors.spec.ts:3 imports prerequisiteCycle and importRejected from ../curriculum-admin/admin-errors.js. A spec of the shared common/ folder now depends on a feature folder, the only common spec that does. Lint skips specs, so nothing fails, but the direction is backwards. Fix: move the prerequisiteCycle and importRejected cases into src/backend/src/curriculum-admin/admin-errors.spec.ts, and keep only the forbidden and conflict cases in common.
- api-errors.spec.ts:31 (importRejected case) checks the status but has no toBeInstanceOf(BadRequestException), although round 1 asked for the class too. The risk is low, since the 400 status already pins it in practice. Fix: add the one assertion.
- The round 1 non-blocking notes still stand: the forbidden/conflict parameter naming, purge being public, signInAttemptKey staying in auth.service.ts, the fixed "try again in a minute" text, the lint rule covering only new XException(, and the limiter spec going through AuthService.

## What I checked
1. Scope of round 2: git diff 9bb0fb3..HEAD --stat shows only the new spec file (40 lines). Every other file is as I reviewed it in round 1.
2. Contract: git diff base..HEAD on openapi.json, migrations and package-lock.json is empty.
3. Tests: vitest over src/common, admin-errors.spec and src/auth: 10 files and 77 tests pass. lint.test.mjs: 43 of 43 pass. node scripts/lint.mjs passes. tsc --noEmit is clean.
4. Rules: the spec has no comments, uses .js suffixes and adds no dependency. The commit is signed, and there is still exactly one changeset.
5. I mutation-checked each assertion's target (listed above).
