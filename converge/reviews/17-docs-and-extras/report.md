# Batch 17 docs-and-extras report

## Commits
1. docs: ADR 0010, 0013, 0014 decision rows and docs/test/test-cases-b1.md name current files (RulesService, rules/types.ts, rules/plan-issues.ts), each followed by "(renamed, see the amendment below)". test-cases-b1 has no amendment of its own, so that row points at the ADR 0014 amendment.
2. docs(architecture): sections 4-5 corrected: the module list is alphabetical, import edges point at backendEdges in scripts/layers.mjs, users owns account-state and the deletion column, admin-access exports and lock key, curriculum seed export, curriculum-admin references.ts, seed options split (database/seed-options.ts parses, common/seed-options.ts has types), seed data and lock keys owners, engine path src/backend/src/rules, frontend layers point at scripts/layers.mjs (no lists copied).
3. chore: .rgignore with the four dated record folders; one sentence in docs/agents/domain.md.
4. test(ai): removed the eslint-disable line, src/backend/src/ai/sse.spec.ts:135 (the one allowed edit inside ai/).
5. test: LONG_LOOP_TIMEOUT_MS (60 s) on two import-body-limit cases, LONG_INTERACTION_TIMEOUT_MS (60 s) on two PlanEditorView cases. Assertions unchanged.
6. test: curriculum-schema-migration.e2e-spec.ts: replaced resolves.toBeDefined() on a DELETE (always true) with a check that the curriculum's groups are gone.
7. test(admin): src/frontend/src/admin/references.spec.ts (FRO-1); COUNTED_REFERENCES is now exported from curriculum-admin/references.ts (one word, no contract change).
8. chore: empty changeset .changeset/17-docs-and-extras.md.

## Slow case timings (quiet machine, before -> after; the change is a timeout, not less work)
- import-body-limit "gives a caller without a session ...": 399 ms -> 388ms; "never inflates ... 415": 72 ms -> 70ms
- PlanEditorView keyboard move: 119 ms; caps + Add Term: 171 ms; after: moves a course with the keyboard: Space lifts, arrows pick a term, Enter drops, Escape cancels (A1) 120ms | caps + Add Term at MAX_PLAN_TERMS (30) and slices previewAll targets to 30 172ms
A memoised body builder was tried for the backend file and gave no gain (cost is the requests), so it was reverted.

## Removed comments
Only src/backend/src/ai/sse.spec.ts:135. Kept: frontend/src/env.d.ts:1 (triple-slash), groups.spec.ts:1 (vitest pragma). Not touched: migrations; advisor/regulations/regulation.ts:433,447 are generated markdown strings, not comments; notifications e2e SQL /* */ tags the query on purpose.

## Tests that could not fail
Scanned 142 changed specs (script: no assertion, always-true patterns, assertions only inside callbacks). Only one real finding (item 6). Not removed: index.spec.ts timestamp toBeDefined (regex can return undefined, so it can fail); attributes('disabled') toBeDefined (presence is the behaviour). Browser specs use expect.element, so they do assert. No test removed. Line-for-line repeats could only be sampled, not fully scanned. Off-limits files skipped.

## Left out
- BAC-3 (class-model.md) not in the objective. DTO description fix (BAC-4 tail) deferred to PR #77.
- FRO-1 step 2 (three missing wordings) by instruction.
- Migration comments untouched by instruction.

## Look twice
- test-cases-b1 wording points at the ADR 0014 amendment instead of a nonexistent local one.
- ADR 0013 line 75 now reads "RulesService serves the plan issues ... (RulesService, was the PlanIssuesProvider interface ...)": slightly redundant.
- architecture.md claims verified against features.ts, layers.mjs, lint.mjs layer rules.

## Verify
PASS lint (3s)
PASS typecheck-be (15s)
PASS typecheck-fe (22s)
PASS unit-be (30s)
PASS unit-fe (47s)
PASS build-fe (2s)
PASS build-be (6s)
PASS openapi (2s)
PASS browser (12s)
PASS e2e (60s)
COUNTS unit-be=1205 unit-fe=1376 e2e=365 browser=68   (baseline 3c4da22: 1132 1246 364 68)
RESULT: ALL PASS (typecheck lint unit-be unit-fe build e2e openapi browser)

