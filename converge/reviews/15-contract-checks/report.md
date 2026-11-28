# Batch 15 contract checks

## Commits
120e2ee docs: say what the contract checks now catch
f886b96 test(frontend): collect the message catalogues by glob
71a51c2 test(frontend): pin the colour of every seeded requirement group
a6bb527 test(frontend): check the plan name and credit limits against the contract
5aceb93 test(frontend): fail when a schema of openapi.json has no contract check
d325a22 test(frontend): compare nullability in every contract check

1. Nullability: contractNullable (keys whose type, enum, anyOf or oneOf may be null), nullableKeys<T> (typed so the listed keys must be exactly the keys the frontend type allows null in), one assertion in each check table of 12 specs (plus Health, Onboarding). Sabotage proved a wrong key fails the typecheck.
2. Coverage: src/frontend/src/contract-coverage.spec.ts reads every spec as text; each schema must be named in a row or contract call of a spec that imports testing/contract. Allowlist NOT_READ_BY_THE_SCREENS = NotificationNotFoundDto (the 404 body; screens read the status only). Proved: deleting the TranscriptDto row failed it, adding a ZzNewDto schema to openapi.json failed it; both reverted. Also adds contractMaxLength, contractMaximum, contractSchemaNames; contractEnum now types null.
3. Limits: PLAN_NAME_MAX_CODE_POINTS equals maxLength of CreatePlanDto, RenamePlanDto, DuplicatePlanDto name; MAX_CREDITS equals TranscriptRowDto.credits maximum.
4. Group colours: curriculum/group-colours.spec.ts imports CURRICULUM_SEEDS (APCS 2024, 2025 and the CLC 2025 seeds), 20 distinct name and kind pairs with the colour of today. Proved: changing a regex fails a row, renaming a seeded group fails the "lists every seeded group" check.
5. Message catalogues: messages.spec.ts globs ./**/*messages.ts, takes every *_MESSAGES export. Old assertions stay (49 tests: 32 old + 16 new + 1). New: exactly vi and en keys, and same key paths in vi and en (holds for all). Count must stay at least 16.
6. architecture.md sentence and empty changeset.

## Left out
- audit/api.spec.ts: no nullability assertion (off limits, PR #214). Its schemas are still checked for coverage.
- Frontend types wrong against nullability: none found (typecheck and tests pass). Gap: a schema with no nullable key in the contract has no NULLABLE entry, so a frontend type that is nullable where the API never is stays unchecked.
- Contract has no number for this: transcript MAX_NAME_LENGTH 255 (courseName has no maxLength), the grade maximum 10 (grade has no maximum), MIN_YEAR 2000 and MAX_YEAR 2100 (TermDto.year has none), CREDITS_COLUMN_INT32_MAX in onboarding/answers.ts (creditsPerTerm has no maximum; existing spec asserts that). Rows (300) and cohorts (APCS 2024, 2025) exist only inside description text; the existing specs already assert those texts and were left as they are. creditsPerTerm minimum 1 likewise stays on the existing toMatchObject.
- Route and path checks (FRO-5 third item) and FRO-8 option B: out of scope.

## Look twice
- The coverage test is textual: a schema counts when its name starts a table row or is the first argument of a contract helper in a spec importing testing/contract. A schema named only by contractEnum counts (TermDto is such a case).
- Vitest caches the transform of a spec by content: a new messages file is seen by a fresh run (CI), but a local run of an unchanged messages.spec.ts can miss it until the spec is touched.
- contractEnum return type widened to include null (it already returned null at runtime).

## Verify tail
PASS build-be (6s)
PASS contract (0s)
PASS browser (10s)
COUNTS unit-be=- unit-fe=1333 e2e=- browser=68   (baseline 3c4da22: 1132 1246 364 68)
RESULT: ALL PASS (typecheck lint unit-fe build browser contract)

