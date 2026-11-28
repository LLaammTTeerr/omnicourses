# Batch 24: entities declare constraints

Commits
- 56815ee refactor(database): added @Check and foreignKeyConstraintName declarations to User (4 checks), OnboardingAnswers (11 + fk), TranscriptRow (7 + fk), Guide (2), GuideText (3 + fk), Session (fk). Copied names and expressions from the migrations. No property, column or relation changed.
- a2c57b5 test(database): added test/schema-drift.e2e-spec.ts (1 test, table list from db.entityMetadatas, ai_usage left out via TABLES_OF_THE_AI_GATEWAY_OWNED_BY_AN_OPEN_PULL_REQUEST). Removed the six filtered copies (academic-calendar, notifications, curriculum, curriculum-admin, plan-sharing, plans) and constants CURRICULUM_TABLES, NEW_TABLES, PLAN_TABLES. All six made the same call and assertion for a subset of the general tables; none asserted more.
- 7e21c43 docs: row in ADR 0020; empty changeset. No other doc described the per-feature drift checks.

Facts confirmed: before the fix the spec listed 35 up-queries (36 minus ai_usage's FK). sign_in_attempts needed nothing.
What is compared (RdbmsSchemaBuilder): check constraints by name only, expressions not compared. Foreign keys by name, referenced table, onDelete and onUpdate (not column lists beyond that). Columns by type, length, nullability, default etc. So the test does not catch a CHECK expression that differs from the migration's; I copied expressions by hand.
Proof it can fail: removing @Check ck_users_student_id gave DROP CONSTRAINT ck_users_student_id; changing email_verified_at to 'timestamp' gave DROP COLUMN / ADD queries. Both restored.
Left out: ai_usage entity (src/ai off limits, PR #77): its FK ai_usage_user_id_fkey stays undeclared; the constant is named for that.
E2E count: 368 -> 363 (+1 drift test, -6 removed). Unit 1224 unchanged.
Look twice: the filter in the spec matches queries containing the quoted table name, so a query touching another table through REFERENCES "users" also counts, which only widens it.
Verify tail: COUNTS unit-be=1224 unit-fe=1396 e2e=363 browser=68; RESULT: ALL PASS (typecheck lint unit-be build e2e openapi contract)


## Review round
- Blocking finding was right: TypeORM writes DROP INDEX without a table name, so the filter hid index drift. The spec now asserts on every up-query except those naming the excluded ai_usage table. It then showed DROP INDEX "ix_users_purge_after"; User now declares @Index('ix_users_purge_after', ['purgeAfter'], { where: "purge_after" IS NOT NULL }). This declares an index that already exists; the database is unchanged.
- Proofs re-run and restored: removing that index fails (DROP INDEX), removing @Check ck_users_student_id fails, changing display_name to text fails.
- Non-blocking: removed the double blank line in curriculum-admin.e2e-spec.ts; ADR 0020 row now lists indexes. Evidence logs left as they are.
- Commit e9568bc. Verify: RESULT: ALL PASS; COUNTS unit-be=1224 unit-fe=1396 e2e=363 browser=68.
