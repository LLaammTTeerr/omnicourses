# Review round 2: 16-admin-messages (cvb/16-admin-messages, c97d8cc)

Verdict: approve.

## Round 1 fix
- MAX_MIB and maxRecords duplicated (import.ts:4-5 vs shared.ts:7-8): fixed in c97d8cc. shared.ts:7-8 now exports both, and import.ts:3 imports them from './shared.js'. grep finds only one definition in src/frontend/src. Same folder; depgraph shows no file cycles (fileCycles []), unresolved [].

## New commit c97d8cc
- Also changes `import { type X }` to `import type { X }` in access, calendar, catalog, curriculum, programs (the round 1 nit). Types only, so runtime is the same.
- No other changes. No comments, no new files.

## Blocking
None.

## Non-blocking
- shared.ts:62 onward: the vi and en bodies are still indented 2 spaces, not 4 like the other files. report.md says it skipped this as "inside template literals". That is wrong: the indent is on object keys, not inside a template. Re-indenting is whitespace only and the proof would not change. Optional.
- MAX_MIB and maxRecords live in shared.ts, which is used by shared (tooLarge) and import. That is fine. Moving them to admin/api.ts next to IMPORT_MAX_BYTES would also work. Optional.

## What I checked
1. Behaviour / proof rebuilt: git archive of src/frontend/src at the base and at HEAD (c97d8cc) into scratchpad/rev162, bundled with rolldown, ADMIN_MESSAGES walked (key order, primitives, function source and arity, results on fixed argument sets, every Reference kind). 3545 vs 3545 entries, 0 differences, 0 source-text differences.
2. Contract: the diff of openapi.json, migrations and package-lock.json is empty.
3. Tests: no spec, e2e-spec or test.mjs changed. vitest src/admin + src/messages.spec.ts: 16 files, 383 tests pass. vue-tsc --noEmit -p tsconfig.app.json exits 0.
4. Completeness: ADMIN_MESSAGES and AdminText are still exported from admin/messages.ts. Files: 142 to 149, edges 743 to 762 (one more than round 1, from import.ts to shared.ts).
5. Structure: the folder cycle set is the same as at the base, there are no file cycles, and admin's dependsOn is unchanged.
6. Repo rules: `node scripts/lint.mjs` passes, no comment lines in the new files. Both commits are signed G with Conventional subjects. Exactly one changeset (empty, fine for a refactor).
7. Scope: only admin/messages.ts, admin/messages/*.ts and the changeset changed. No off-limits file was touched.
