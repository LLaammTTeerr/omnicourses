# Review round 2: batch 24 entities-declare-constraints

Verdict: approve.

## Round 1 fix (schema-drift filter hid DROP INDEX)
- Made, in commit e9568bc (signed, Conventional). src/backend/test/schema-drift.e2e-spec.ts now asserts on every up-query and drops only those naming "ai_usage", via the named constant.
- User declares @Index('ix_users_purge_after', ['purgeAfter'], { where: `"purge_after" IS NOT NULL` }), which matches migration 1792886400000-add-users-deletion-requested-at.ts:13 (name, column, partial predicate). Same style as notification.entity.ts:10. No column, type, nullability, relation or property changed. Database unchanged.
- The report notes the index declaration.

## Checked
- Spec passes on omnicourse_cv_fa (1 test).
- Proofs, each restored with git checkout: removing @Check ck_users_student_id fails; changing password_hash type text->varchar fails; removing the new @Index fails with ix_users_purge_after (the gap round 1 found is now covered). git status --short empty at the end.
- tsc --noEmit (backend) passes; npm run lint passes (43/43).
- e9568bc also removes one blank line in curriculum-admin.e2e-spec.ts (whitespace only) and adds "index" to the ADR 0020 row. The row is now accurate.
- No diff in migrations, openapi.json, package-lock.json, src/ai, src/advisor. Every commit is G. One changeset.
- The six removed filtered checks: each made the same createSchemaBuilder().log() call and asserted an empty filtered list. The general test asserts an empty list over a superset (every query except ai_usage). None asserted more.
- curriculum.e2e-spec.ts still uses its DataSource import (line 31).

## Non-blocking
- report.md still says the spec takes its table list from db.entityMetadatas. After e9568bc it filters by exclusion and does not read the metadata. That is stronger, but the report sentence is out of date.
