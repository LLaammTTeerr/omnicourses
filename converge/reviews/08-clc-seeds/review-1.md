# Review round 1: 08-clc-seeds (cvb/08-clc-seeds, 146b8b4 over f51144c)

Verdict: approve. No blocking findings.

## Proof rebuilt independently (check 8)
- git archive of src/backend/src/curriculum/seeds at the base and at HEAD into /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/review08, each compiled with the repo's tsc (nodenext, strict), CURRICULUM_SEEDS + CATALOG_DECISIONS dumped with JSON.stringify (key order kept).
- base.json and head.json: sha256 fc57f3e09dac4b1dda45c86a710435333c93a9898e5b4627bd69dd1ac72a5404, both, 751740 bytes; cmp reports identical. util.isDeepStrictEqual also true. 11 seeds, row counts 69,71 then 187 x 9.
- Implementer's own harness files in this folder: acd2d17169d6ab3d03fdb638cc9214ece5622f96a4e7f659005623ce68e35e4a  /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/08-clc-seeds/old.json; acd2d17169d6ab3d03fdb638cc9214ece5622f96a4e7f659005623ce68e35e4a  /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/08-clc-seeds/new.json
- No group is computed as a remainder: every specialisation file lists toan_science, csn, bbcn, tccn, tn and free explicitly; clc2025Seed only maps members to rows.
- Shared vs own groups verified: across the nine files toan_science has 4 distinct contents and csn 2 (pages differ), so keeping them per file is correct; llct, khxh, toan_bb, toan_math, tin, gdtc, gdqp are shared once in CLC_2025_COMMON_GROUPS.

## Checks
1. Behaviour: clc2025Seed now builds ClcRows from CLC_2025_COMMON_GROUPS + spec.groups via clcPrintedRow; field order of the produced PrintedRow (code..type, counts_toward_total, counts_toward_gpa, page, needs_check) matches rows.ts row(); byte-identical output confirms. Only new runtime text: clcPrintedRow throws "CLC 2025 course X is not in CLC_2025_COURSES" for an unknown code (unreachable with today's data, spec guards it).
2. Contract: diff of openapi.json, migrations, package-lock.json is empty.
3. Tests: no existing test file changed or deleted; new clc-2025-courses.spec.ts (course table keyed by code, every listed code exists, no duplicates, 187 rows / 726 credits per specialisation, per-group row and credit tallies, seed row codes equal membership). vitest src/curriculum: 12 files, 311 tests pass. typecheck passes. npm run lint passes.
4. Completeness: no reference to *.rows.ts / clc2025*Rows left in src, scripts, deploy, .github, docs/analysis-and-design, AGENTS.md, README.md (only ignored coverage/dist artefacts and unrelated frontend transcript rows.ts). ADR 0005 wording updated. rows.ts stays: apcs-2024.ts and apcs-2025.ts still use bb/tc. catalog.ts conflict check stays and can still fire: APCS 2024 vs APCS 2025 and APCS vs CLC share codes.
5. Structure: imports stay inside curriculum/seeds; depgraph shows no new cycle (only pre-existing auth<->users and the curriculum entity cycle). Lines: 9 x 218 = 1962 rows lines before; after 9 x 181 + 288 course table = 1917 data lines + 71 spec. Course facts now written once (187 entries instead of 1683).
6. Repo rules: no comments added; no dependency or lockfile change; .js suffixes; one commit, G signature, Conventional subject; exactly one new .changeset file (empty, refactor).
7. Scope: no off-limits file touched.

## Non-blocking
- src/backend/src/curriculum/seeds/clc-2025-courses.ts:19-23: COMMON_GROUP_KEYS, OWN_GROUP_KEYS, ClcCommonGroups and ClcCourse are exported but used nowhere outside the file (and the two key arrays only as types). Drop the export, or replace the arrays with plain type unions.
- clc-2025-courses.ts:25-37 + clcPrintedRow repeats rows.ts row() (same column mapping, counts_toward_total/gpa true). Could reuse rows.ts by building the PrintedRow through row(course.type, ...), keeping one place for the column mapping.
- clc-2025-courses.ts: the table is a Record keyed by code with the code written again inside each entry (spec checks they agree). An array plus a derived map would write each code once.
- ClcMember is [code, page] only, so a future per-specialisation extra (needs_check on one file's row) cannot be expressed; today all extras are identical across the nine files, so this is fine, but worth a line in the PR body.
- clc-2025-courses.spec.ts: a swap of two equal-credit courses between tccn and free in one file passes every tally; acceptable per the brief (counts and totals), and curriculum-seeds.spec.ts / e2e cover group totals. Test titles "keeps today row count" read better as "keeps today's ...". Tally arrays are written [8,32] without spaces, unlike the rest of the code.
- The implementer's report.md was not present in the batch folder at review time, so its stated omissions could not be checked.
