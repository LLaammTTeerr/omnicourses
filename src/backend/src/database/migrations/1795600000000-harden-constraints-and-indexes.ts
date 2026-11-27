import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenConstraintsAndIndexes1795600000000 implements MigrationInterface {
  name = 'HardenConstraintsAndIndexes1795600000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "requirement_group_overflows" ADD COLUMN "curriculum_id" uuid`);
    await q.query(`
      UPDATE "requirement_group_overflows" o
      SET "curriculum_id" = g."curriculum_id"
      FROM "requirement_groups" g
      WHERE g."id" = o."from_group_id"
    `);
    await q.query(`
      ALTER TABLE "requirement_group_overflows"
        ALTER COLUMN "curriculum_id" SET NOT NULL,
        DROP CONSTRAINT "requirement_group_overflows_from_group_id_fkey",
        DROP CONSTRAINT "requirement_group_overflows_to_group_id_fkey",
        ADD CONSTRAINT "requirement_group_overflows_curriculum_id_fkey"
          FOREIGN KEY ("curriculum_id") REFERENCES "curriculums" ("id") ON DELETE CASCADE,
        ADD CONSTRAINT "requirement_group_overflows_from_group_id_fkey"
          FOREIGN KEY ("from_group_id") REFERENCES "requirement_groups" ("id") ON DELETE NO ACTION,
        ADD CONSTRAINT "requirement_group_overflows_to_group_id_fkey"
          FOREIGN KEY ("to_group_id") REFERENCES "requirement_groups" ("id") ON DELETE NO ACTION
    `);
    await q.query(`CREATE INDEX "ix_requirement_group_overflows_curriculum_id" ON "requirement_group_overflows" ("curriculum_id")`);
    await q.query(`
      ALTER TABLE "combined_minimum_groups"
        DROP CONSTRAINT "combined_minimum_groups_requirement_group_id_fkey",
        ADD CONSTRAINT "combined_minimum_groups_requirement_group_id_fkey"
          FOREIGN KEY ("requirement_group_id") REFERENCES "requirement_groups" ("id") ON DELETE NO ACTION
    `);

    await q.query(`CREATE INDEX IF NOT EXISTS "idx_transcript_rows_course_code" ON "transcript_rows" ("course_code")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_plan_placements_course_code" ON "plan_placements" ("course_code") WHERE "course_code" IS NOT NULL`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_onboarding_answers_program_code" ON "onboarding_answers" ("program_code")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_academic_calendar_starts_on_kind" ON "academic_calendar" ("starts_on", "kind")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_notifications_unread" ON "notifications" ("user_id") WHERE "read_at" IS NULL`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "idx_notifications_unread"`);
    await q.query(`DROP INDEX IF EXISTS "idx_academic_calendar_starts_on_kind"`);
    await q.query(`DROP INDEX IF EXISTS "idx_onboarding_answers_program_code"`);
    await q.query(`DROP INDEX IF EXISTS "idx_plan_placements_course_code"`);
    await q.query(`DROP INDEX IF EXISTS "idx_transcript_rows_course_code"`);

    await q.query(`
      ALTER TABLE "combined_minimum_groups"
        DROP CONSTRAINT "combined_minimum_groups_requirement_group_id_fkey",
        ADD CONSTRAINT "combined_minimum_groups_requirement_group_id_fkey"
          FOREIGN KEY ("requirement_group_id") REFERENCES "requirement_groups" ("id") ON DELETE CASCADE
    `);
    await q.query(`DROP INDEX IF EXISTS "ix_requirement_group_overflows_curriculum_id"`);
    await q.query(`
      ALTER TABLE "requirement_group_overflows"
        DROP CONSTRAINT "requirement_group_overflows_curriculum_id_fkey",
        DROP CONSTRAINT "requirement_group_overflows_from_group_id_fkey",
        DROP CONSTRAINT "requirement_group_overflows_to_group_id_fkey",
        DROP COLUMN "curriculum_id",
        ADD CONSTRAINT "requirement_group_overflows_from_group_id_fkey"
          FOREIGN KEY ("from_group_id") REFERENCES "requirement_groups" ("id") ON DELETE CASCADE,
        ADD CONSTRAINT "requirement_group_overflows_to_group_id_fkey"
          FOREIGN KEY ("to_group_id") REFERENCES "requirement_groups" ("id") ON DELETE CASCADE
    `);
  }
}
