import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlans1794218005469 implements MigrationInterface {
  name = 'CreatePlans1794218005469';

  async up(q: QueryRunner): Promise<void> {
    // F5 plans (ADR 0014): a student keeps several, each planned against one curriculum, the
    // version of its cohort (UC-05 A6, TC-B2-ADM-03). RESTRICT: a curriculum a plan uses is
    // referenced data, which F12 refuses to delete (ADR 0011). UNIQUE (id, user_id) is the
    // target of plan_placements' composite key, which keeps both user_ids the same.
    await q.query(`
      CREATE TABLE "plans" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "curriculum_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "plans_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "uq_plans_id_user" UNIQUE ("id", "user_id"),
        CONSTRAINT "plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "plans_curriculum_id_fkey" FOREIGN KEY ("curriculum_id") REFERENCES "curriculums" ("id") ON DELETE RESTRICT,
        CONSTRAINT "ck_plans_name" CHECK (length(btrim("name")) > 0)
      )`);
    await q.query(`CREATE INDEX "ix_plans_user_id" ON "plans" ("user_id")`);
    await q.query(`CREATE INDEX "ix_plans_curriculum_id" ON "plans" ("curriculum_id")`);

    // One row per placement: a course, or a slot with no course chosen yet that holds credits
    // for a requirement group (the dashed tile of the planner prototype). Terms follow ADR 0009;
    // position orders the placements of one term. course_code is a plain code, like
    // transcript_rows (ADR 0007, ADR 0011): checked against the catalog when saved, kept as it is
    // after. Its own user_id makes export and purge cover it (ADR 0004).
    await q.query(`
      CREATE TABLE "plan_placements" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "plan_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "term_year" smallint NOT NULL,
        "term_number" smallint NOT NULL,
        "position" smallint NOT NULL,
        "course_code" varchar(20),
        "requirement_group_id" uuid,
        "slot_credits" smallint,
        CONSTRAINT "plan_placements_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "uq_plan_placements_term_position" UNIQUE ("plan_id", "term_year", "term_number", "position"),
        CONSTRAINT "plan_placements_plan_fkey" FOREIGN KEY ("plan_id", "user_id") REFERENCES "plans" ("id", "user_id") ON DELETE CASCADE,
        CONSTRAINT "plan_placements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "plan_placements_requirement_group_id_fkey" FOREIGN KEY ("requirement_group_id") REFERENCES "requirement_groups" ("id") ON DELETE RESTRICT,
        CONSTRAINT "ck_plan_placements_term_year" CHECK ("term_year" BETWEEN 2000 AND 2100),
        CONSTRAINT "ck_plan_placements_term_number" CHECK ("term_number" IN (1, 2, 3)),
        CONSTRAINT "ck_plan_placements_position" CHECK ("position" >= 0),
        CONSTRAINT "ck_plan_placements_course_code" CHECK ("course_code" ~ '^[A-Z0-9]{2,20}$'),
        CONSTRAINT "ck_plan_placements_course_or_slot" CHECK (("course_code" IS NULL) <> ("requirement_group_id" IS NULL)),
        CONSTRAINT "ck_plan_placements_slot_credits" CHECK (("slot_credits" IS NULL) = ("requirement_group_id" IS NULL)),
        CONSTRAINT "ck_plan_placements_slot_credits_range" CHECK ("slot_credits" BETWEEN 1 AND 30)
      )`);
    // A plan places a course once; a retake planned after a failed attempt is still one placement.
    await q.query(`CREATE UNIQUE INDEX "uq_plan_placements_course" ON "plan_placements" ("plan_id", "course_code") WHERE "course_code" IS NOT NULL`);
    await q.query(`CREATE INDEX "ix_plan_placements_user_id" ON "plan_placements" ("user_id")`);
    await q.query(`CREATE INDEX "ix_plan_placements_requirement_group_id" ON "plan_placements" ("requirement_group_id")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "plan_placements"`);
    await q.query(`DROP TABLE "plans"`);
  }
}
