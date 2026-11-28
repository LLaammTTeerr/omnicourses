# Batch 02: locks and seeds

Branch cvb/02-locks-and-seeds, 4 commits on 9eef108.

## Commits
1. c907841 common/advisory-locks.ts: SINGLE_KEY_LOCKS (adminWrite 11_012_001, accessManager 11_012_002) and NAMESPACED_LOCKS (signInAttempt 11_012_003, aiQuota 3003), a spec for uniqueness per group. Call sites in admin-write.service, account.service, seed-curricula, auth.service and ai-cost-guard.service (import + call site only) now import it; local constants and exports deleted. No shared lock helper: the statements differ.
2. 7aa354c git mv database/seeds -> curriculum/seeds, imports fixed (seed-curricula, program-admin.dto.spec, 6 e2e specs; curriculum-admin-import.e2e-spec.ts import path line only), doc paths fixed in ADR 0003/0005/0012 and design-differences.md.
3. 373f870 common/seed-options.ts (SeedOptions, Seeder, parseSeedOptions + spec); database/seed.ts is a SEEDERS list [seedGuides, seedCurricula]; both seeders take (dataSource, options). architecture.md updated. scripts/layers.mjs: removed account->curriculum-admin, curriculum->curriculum-admin, curriculum->database; ADDED database->common (seed.ts needs the shared type; lint required it).
4. a950f6d empty changeset.

## Left out
- BAC-1 step 2 (admin-access folder): not in this objective.
- ADR 0011 still mentions seeds/apcs-prerequisites.ts (PR #166 owns it; relative path stays accurate enough). docs/test/** untouched.
- curriculum seed takes an unused `_options` parameter to match the one signature.

## Look twice
- Added layer edge database -> common (brief only listed removals).
- Lock call-site SQL strings unchanged (existing specs assert them).
- depgraph folderCycles: [["auth","users"]] only.

## Seed proof (fresh DB omnicourse_cv_be_seed, after migrate)
Run 1: Guides inserted 4; curriculum Inserted programs 10, curriculums 11, requirement_groups 133, courses 249, links 1823, combined_minimums 2, overflows 2, prerequisite_lists 140, prerequisites 2.
Run 2: Guides inserted 0 unchanged 4; Inserted all 0; already present programs 11, curriculums 11, groups 133, courses 249, links 1823, 2, 2, 140, 2.
NODE_ENV=production --guide-fixtures: refused, exit 1.

## Verify tail
PASS lint (3s)
PASS unit-be (30s)
PASS typecheck-be (32s)
PASS typecheck-fe (37s)
PASS build-fe (15s)
PASS build-be (40s)
PASS contract (0s)
PASS openapi (6s)
PASS e2e (126s)
COUNTS unit-be=1135 unit-fe=- e2e=364 browser=-   (baseline 3c4da22: 1132 1246 364 68)
RESULT: ALL PASS (typecheck lint unit-be build e2e openapi contract)

