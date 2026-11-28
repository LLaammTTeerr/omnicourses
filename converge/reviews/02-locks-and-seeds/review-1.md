# Review round 1: batch 02-locks-and-seeds (cvb/02-locks-and-seeds, 9eef108..a950f6d)

Verdict: approve. No blocking findings.

## What I checked
1. Behaviour. Lock keys: values 11_012_001, 11_012_002, 11_012_003 and 3003 unchanged; every SQL string at the 5 call sites (admin-write x2, account, seed-curricula, auth, ai-cost-guard) unchanged; lock order in lockAdminWrite unchanged. Seeds: all 20 files R100 (pure moves). seed.ts: same order (guides, then curriculum), same output lines, flag parsed with the same argv.includes('--guide-fixtures'), production refusal unchanged. Built and ran db:migrate + db:seed twice on a fresh database (omnicourse_cv_be_review, dropped afterwards): run 1 inserted guides 4, programs 10, curriculums 11, groups 133, courses 249, links 1823, 2, 2, 140, 2; run 2 inserted 0 everywhere. NODE_ENV=production --guide-fixtures: refused, exit 1. Deploy callers (deploy/server/omnicourse-deploy, package.json db:seed) still call dist/database/seed.js.
2. Contract. git diff of openapi.json, migrations and package-lock.json is empty. No route, DTO or error code touched.
3. Tests. Changed specs differ only in import paths; curriculum-seeds.spec.ts moved R100. Specs that pin the lock values (account.service.spec 11_012_002/001, curriculum.service.spec 11_012_001, ai-cost-guard.service.spec 3003) untouched and pass. New advisory-locks.spec fails on a duplicate key within a group; seed-options.spec fails if the flag is ignored or always on.
4. Completeness. No remaining ADMIN_WRITE_LOCK / ACCESS_MANAGER_LOCK / *_LOCK_NAMESPACE constants or re-exports in src. database/seeds gone from src, test, scripts, deploy, .github, docs/analysis-and-design, AGENTS.md, README.md.
5. Structure. depgraph folderCycles = [["auth","users"]] only. Removed edges: account->curriculum-admin, curriculum->curriculum-admin, curriculum->database. Added edge database->common (needed by seed.ts). No lock wrapper added (correct: the statements differ).
6. Repo rules. No comments in new files; .js suffixes; no new dependency; 4 commits, all G, Conventional subjects; exactly one new changeset (empty).
7. Scope. Off-limits files: ai/ai-cost-guard.service.ts changed only the constant into an import (plus the call-site argument); test/curriculum-admin-import.e2e-spec.ts changed the import line only. Nothing else off limits touched.
Ran: npm run lint (pass), typecheck backend (pass), backend unit tests (1135 pass; the first run had 3 failures in one file under machine load, then 2 clean reruns), build backend, e2e curriculum-seed, curriculum, account, curriculum-admin, audit, curriculum-admin-import (119 pass).

## Blocking
None.

## Non-blocking
- docs/test/test-cases-b1.md:448 links to ../../src/backend/src/database/seeds/catalog.ts, now a dead link. docs/test/evidence/b2/results-b1-regression-2026-11-27.md:172 links to database/seeds/apcs-prerequisites.ts (a dated evidence record; leave it or fix it). docs/test/test-plan.md:256 is pinned to a commit and is fine. Fix: point test-cases-b1.md at src/backend/src/curriculum/seeds/catalog.ts.
- src/backend/src/curriculum/seed-curricula.ts:20: the `_options: SeedOptions` parameter is never used. TypeScript already accepts `seed(dataSource)` as a Seeder, so the parameter could be dropped. Keeping it does match the brief's "one signature" wording.
- src/backend/src/common/seed-options.ts: parseSeedOptions and the flag constant are only used by database/seed.ts. Only the SeedOptions/Seeder types need to be in common. Optional: move the parser into database/seed.ts and its spec next to it.
- scripts/layers.mjs: the brief said to remove lines only, but the batch also adds 'database -> common'. The new import needs that edge, and the implementer flagged it. Fine, but say so in the PR body.
- The implementer report says "6 e2e specs"; the diff touches 5.
- Pre-existing, not from this batch: ADR 0012 names apcs-202{4,5}.teaching-plan.ts, which existed neither before nor after.

## Implementer's stated omissions (read after my findings)
BAC-1 step 2 left out (out of objective); ADR 0011 left alone (PR #166); docs/test untouched (that is my first non-blocking point); unused _options (my second point). All agree with what I found.
