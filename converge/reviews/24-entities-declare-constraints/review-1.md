# Review round 1: batch 24, entities declare constraints

Verdict: changes requested (1 blocking finding).

## Blocking

1. src/backend/test/schema-drift.e2e-spec.ts:24. The table filter cannot see index drift, and real index drift is hiding behind it today.
   - The spec keeps only up-queries that contain a quoted table name. TypeORM writes `DROP INDEX "public"."<index>"` without naming the table, so every dropped index slips past the filter.
   - Probe (a temporary edit, then restored): I asserted on all of `upQueries` instead of `touching`. TypeORM still wants to run two queries. One is `ALTER TABLE "ai_usage" DROP CONSTRAINT "ai_usage_user_id_fkey"`, which is the expected exclusion. The other is `DROP INDEX "public"."ix_users_purge_after"`.
   - That index comes from migration 1792886400000-add-users-deletion-requested-at.ts:13: `CREATE INDEX "ix_users_purge_after" ON "users" ("purge_after") WHERE "purge_after" IS NOT NULL`. User does not declare it.
   - So the goal is not met ("TypeORM would run no up-query for any table"; "the entities say everything the migrations say"). The ADR 0020 row also over-claims what the test proves.
   - The six removed checks had the same blind spot, so no test was lost.
   - Fix, part 1: invert the filter. Assert on every up-query and drop only those that name the excluded table, for example `upQueries.map((q) => q.query).filter((q) => !EXCLUDED.some((t) => q.includes(\`"${t}"\`)))`. The list then can no longer under-select.
   - Fix, part 2: declare `@Index('ix_users_purge_after', ['purgeAfter'], { where: \`"purge_after" IS NOT NULL\` })` on User, in the style of notification.entity.ts:10. This declares an index that already exists. It changes no index, so it fits the brief, but the report should say so. Then re-run the spec and both proofs.

## Non-blocking

- src/backend/test/curriculum-admin.e2e-spec.ts:15-16: removing NEW_TABLES left two blank lines in a row. Delete one.
- The ADR 0020 row names checks and foreign-key names. After the fix, add "or index" to that list.
- docs/test/evidence/*/local-e2e-output.txt still lists the removed test names. These are historical run logs, so leave them.

## What I checked

- Commits: 3, all signed (G), all with Conventional subjects. Exactly one new changeset (empty, which matches the batch convention).
- Contract: the diff of openapi.json, migrations, package-lock.json, src/ai and src/advisor is empty. No off-limits file was touched.
- Entity diff: only class-level @Check decorators and `foreignKeyConstraintName` in existing @JoinColumn options were added. No column, type, nullability, default, index, cascade or relation property changed, and no new property appeared.
- Constraint by constraint: I compared all 27 checks with their migration lines (create-users-and-sessions, add-users-deletion-requested-at, add-users-student-id-and-class-name, create-transcript-rows, create-onboarding-answers, create-guides). Name and expression match for every one; ck_guides_group differs only in line wrapping. The 4 foreign-key names are PostgreSQL's default `<table>_<column>_fkey` for the inline REFERENCES in those migrations. No later migration renames or drops them.
- Removed filtered checks (6): each made the same `createSchemaBuilder().log()` call with the same filter-and-toEqual([]) assertion over a subset of the metadata tables, and none asserted more. bootApp boots AppModule, so every feature's entities are in the metadata. The removed constants (NEW_TABLES, CURRICULUM_TABLES, PLAN_TABLES) were used only by those tests. Imports that remain are still used.
- Proofs, run myself and restored with git checkout:
  - Removing @Check ck_transcript_rows_grade makes the spec fail with DROP CONSTRAINT.
  - Changing users.display_name to text makes it fail with DROP/ADD COLUMN.
  - Removing sessions_user_id_fkey also makes it fail.
  - git status is empty at the end.
- What TypeORM compares (node_modules/typeorm 1.1.2, RdbmsSchemaBuilder.js:202-209, 337, 707, 768):
  - Checks by name only.
  - Foreign keys by name, referenced table, onDelete and onUpdate.
  - Indices by name.
  - The report's and the ADR's claim about checks is true.
- Runs:
  - Typecheck: pass.
  - Lint: pass.
  - The six edited e2e specs plus schema-drift: 137 tests pass.
- Completeness: no doc other than ADR 0020 described the per-feature drift checks. AGENTS.md and architecture.md need no change.
- Structure: no new imports and no new cross-folder edges.
- Implementer's report: its stated omission (the ai_usage foreign key) is real and handled. It does not mention the users index blind spot above.
