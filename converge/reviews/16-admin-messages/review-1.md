# Review round 1: 16-admin-messages (cvb/16-admin-messages, b6055d6)

Verdict: changes requested (one small repo-rule fix).

## Blocking
1. src/frontend/src/admin/messages/import.ts:4-5 and src/frontend/src/admin/messages/shared.ts:7-8 — MAX_MIB and maxRecords are now defined twice (the base defined them once, messages.ts:356-357). AGENTS.md: "no repeated logic". If the import limit wording changes, one copy can drift.
   Fix: keep the two definitions in shared.ts, export them, and import them in import.ts (same folder, no cycle). Alternatively move them to admin/api.ts next to IMPORT_MAX_BYTES.

## Non-blocking
- shared.ts:62-227: the vi and en bodies are indented 2 spaces, at the same level as `vi: {` and `en: {`. Every other new file indents them 4 spaces. Re-indent (whitespace only, the proof stays the same).
- calendar.ts:1-2, curriculum.ts:2, access.ts:1, programs.ts:1, catalog.ts:2 write `import { type Lang }` / `import { type CalendarEventKind }` where `import type { ... }` is meant. Under verbatimModuleSyntax this leaves a side-effect import of locale.js / api.js. Harmless here, but use `import type`.
- The brief names audit/dashboard-messages.ts as the model. That file does not exist at the base; the real precedent is audit/messages.ts. The new files follow the same shape (interface plus Record<Lang, ...>), but they export their interfaces where audit/messages.ts does not. Exporting is needed for the composition, so this is fine.
- .changeset/16-admin-messages.md is empty (`---\n---`). That matches CONTRIBUTING's `--empty` for a non-user-facing refactor and the other converge batches (09, 13).
- The implementer's report.md was missing from scratchpad/batches/16-admin-messages/ at review time. Only before.json, after.json, bundle.mjs and dump.mjs were there; before.json and after.json are byte-identical (cmp). So I could not check the omissions the implementer listed.

## What I checked
1. Behaviour, rebuilt independently: I bundled admin/messages.ts at the base and at HEAD with rolldown (import.meta.env stubbed) and walked ADMIN_MESSAGES. For each node I recorded the key order, each primitive, each function's source text and arity, and each function's result on 14 fixed argument sets (reference() got every Reference kind, plus count for each `what` with 1 and 3, and group_plans with null and 1). That is 3545 entries per side and 0 differences, function source text included. Top-level key order is the same (the shared spread comes first, then the screens in the base order). Files: /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/rev16/base.json and /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/rev16/head.json.
2. Contract: `git diff --stat` on openapi.json, migrations and package-lock.json is empty. The batch touches only src/frontend/src/admin/messages.ts, src/frontend/src/admin/messages/*.ts and one changeset.
3. Tests: no spec, e2e-spec or test.mjs file changed. `vitest run src/admin src/messages.spec.ts`: 16 files and 383 tests pass. `vue-tsc --noEmit -p tsconfig.app.json` exits 0.
4. Completeness: the base exported only ADMIN_MESSAGES and AdminText, and both are still exported from admin/messages.ts, so no importer changed. The interfaces were module-private before, so nothing outside imported them. `./messages.js` still resolves to messages.ts next to the new messages/ folder.
5. Structure (depgraph, base vs HEAD): files 142 to 149, edges 743 to 761. The admin folder's dependsOn and usedBy are unchanged. Folder cycles are the same single existing SCC. No file cycles, nothing unresolved. Each screen's vi and en now sit next to each other: the objective is met.
6. Repo rules: no comments in the new files, no dependency or lockfile change, `node scripts/lint.mjs` passes. One commit, signature G, Conventional subject "refactor(admin): split the admin message catalogue by screen". Exactly one new changeset.
7. Scope: no off-limits file is touched.
8. Proof: see 1.
