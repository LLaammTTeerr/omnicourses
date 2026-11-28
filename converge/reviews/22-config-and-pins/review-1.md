# Review round 1: 22-config-and-pins (cvb/22-config-and-pins, base 43422c5)

Verdict: approve. No blocking findings.

## What I checked
1. Behaviour. logWithStack(logger, line, stack) is the old if/else exactly (same truthiness test on stack, same argument order). logFailure still logs `${line}: ${failureKind(error)}` with failureStack(error). NotificationsService.logFailure keeps its throttle and suffix text; only the final two lines became the call. failure-kind and notifications specs pass unchanged (61 tests).
2. Contract. git diff base..HEAD on openapi.json, migrations, package-lock.json, .github and deploy: empty.
3. Tests. Only failure-kind.spec.ts (one new describe, nothing removed) and repo-config.spec.ts (existing compose test untouched, new blocks added). No it/expect lost.
4. Completeness. Nothing retired; the old if/else no longer exists in notifications.service.ts; grep finds no other copy of the step.
5. Structure. No new import edge (notifications already imported common/failure-kind). npm run lint (layer rules) passes.
6. Repo rules. No comments, no dependency, .js suffix kept, constants named, 4 commits all G with Conventional subjects, exactly one new .changeset file (empty).
7. Scope. No off-limits files touched. README.md line 84 also switched to `npm run test:e2e` (beyond C's "AGENTS.md block", consistent and harmless).
8. Defeats, each done in the worktree and restored (git status clean afterwards); each failed the spec:
   - removed SESSION_TTL_DAYS from .env.example: settings test fails, diff shows the name.
   - added a getter for BRAND_NEW_SETTING in env.ts: fails, diff shows the name.
   - .nvmrc 22.22.2: Node test fails, diff names AGENTS.md and deploy/server/setup.sh.
   - compose.yaml postgres:18.7: PostgreSQL test fails, names the other three files.
   - pinia ^4.1.0 in src/frontend/package.json: fails with "src/frontend/package.json dependencies pinia@^4.1.0".
   - extra VITE_EXTRA in .env.example: frontend settings test fails.
   - AGENTS.md **npm 11.21.2**: npm test fails naming AGENTS.md.
   Also: typecheck backend clean, lint clean, full backend unit suite 79 files / 1212 tests pass.

## Non-blocking
- src/backend/src/repo-config.spec.ts:44 HOST_SET_SETTINGS is removed only from the names read, not from the names documented. Adding a commented `# NODE_ENV=production` to .env.example (a reasonable doc line) fails the test (verified). Fix: filter the documented list by HOST_SET_SETTINGS too.
- src/backend/src/repo-config.spec.ts:57-80 the AGENTS.md patterns take the first match in the whole file, not the Stack line. Other copies are not checked: AGENTS.md:17 (PostgreSQL 18.6 in the commands block), AGENTS.md:144 (npx npm@11.21.1), README.md:73, deploy/README.md:39-40 (survey 2.1 lists them). Outside the brief's file list, so not blocking; matchAll over AGENTS.md would cover its own extra copies cheaply.
- src/backend/src/repo-config.spec.ts:50 the VITE_ reader is fixed to src/frontend/src/api.ts; a second reader elsewhere in src/frontend/src would go unseen. Scanning all non-spec files under src/frontend/src would be sturdier.
- The settings test failure message names .env.example only through the test title; env.ts is not named. Acceptable.
