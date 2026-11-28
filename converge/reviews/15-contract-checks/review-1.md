# Review round 1: batch 15 contract checks (cvb/15-contract-checks, e22e303..120e2ee)

Verdict: approve. No blocking findings.

## What I checked
1. Behaviour: the batch changes only spec files, src/frontend/src/testing/contract.ts (a test helper), architecture.md and one changeset. No production module changed. contractEnum's return type now includes null; it already returned null at runtime, and the typecheck passes.
2. Contract: `git diff -- src/backend/openapi.json src/backend/src/database/migrations package-lock.json` is empty.
3. Tests: compared the it/it.each/test/expect counts of all 15 changed specs, base against head. Every count is the same or higher. The only removed lines are import lines and the hand-written CATALOGUES list in messages.spec.ts, which the glob replaces. The old blank-message assertion still runs over every catalogue it covered before (16 found by the glob). Ran the 16 affected spec files: 317 passed. `vue-tsc -p tsconfig.app.json` is clean, and it includes the specs, so the nullableKeys<T> type checks are enforced.
4. Coverage spec, tested without editing files: ran the same regex over every spec. Of 138 schemas, only NotificationNotFoundDto has no match, and that is the allowlisted one. Every match is a real table row or a helper call, including the ones in the off-limits audit/api.spec.ts. Deleting a schema's only row leaves it unchecked, and a new schema shows up in contractSchemaNames, so both failure modes are caught. The stale-allowlist test works.
5. Nullability: my own scan of every property finds none that is nullable in a way mayBeNull misses. allOf is not followed, but today every allOf wraps a non-nullable $ref. Every NULLABLE key is used by a table row; none is dead.
6. Limits: listed every maxLength, maxItems and maximum in openapi.json. Against the constants the brief names, the contract has numbers only for the plan name (100) and TranscriptRowDto.credits (30). Both now have assertions. The report correctly lists the constants the contract has no number for: MAX_NAME_LENGTH, grade 10, MIN_YEAR/MAX_YEAR, CREDITS_COLUMN_INT32_MAX, and rows/cohorts, which appear only in description text.
7. Group colours: the spec imports CURRICULUM_SEEDS from backend seeds/index.ts, which imports only local seed files. It checks both directions (every seeded name+kind is listed, and every listed one is still seeded).
8. Repo rules: no added comments (the only // hits are glob strings), no dependency, no lockfile change. All 6 commits are G-signed with Conventional subjects. Exactly one new changeset file, empty (test-only batch). No off-limits file touched.
9. Report: read after these findings. Its stated omissions match what I found, apart from the guides gap below.

## Non-blocking
- src/frontend/src/guides/api.spec.ts:33,34,84: contractShape('GuideListTextsDto'), contractShape('GuideTextsDto') and contractShape('GuideNoteSourceDto') are checked outside the table and have no contractNullable assertion. A field of GuideNoteSourceDto that becomes nullable would not fail. The report says "plus Health, Onboarding" and misses these. Fix: add `expect(contractNullable(...)).toEqual([])` next to each.
- src/frontend/src/transcript/api.spec.ts:31-33: the new test 'caps the credits of a row where the contract does' repeats the existing `toMatchObject({ minimum: 0, maximum: MAX_CREDITS })` two lines below. Fix: drop the new test, or keep only one of the two.
- src/frontend/src/testing/contract.ts mayBeNull: follows anyOf and oneOf but not allOf. Fix: add allOf to the recursion so a future `allOf: [$ref, {type:'null'}]` field is seen.
- src/frontend/src/contract-coverage.spec.ts CHECKED_SCHEMA: any `['Name'` in a spec counts as a check, for example the first name in the new it.each(['CreatePlanDto', ...]) limits test. That is acceptable today, but a schema whose only remaining mention is in such a list would pass with no shape check. Optional: match only `contractShape|contractNullable` calls and table rows followed by `{`/`satisfies`.
- src/frontend/src/messages.spec.ts: the new key-path equality between vi and en goes beyond the brief. It is harmless and useful, but it compares key order too.
- Plan placement credits (PlanPlacementDto.credits maximum 30) is not tied to a frontend constant. It is outside the brief's list, so this is only for information.
