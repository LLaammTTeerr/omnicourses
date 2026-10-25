import { MigrationInterface, QueryRunner } from 'typeorm';

/* This goes without saying if you read the schema, but this is only a working
 * prototype. This schema literally only works for APCS, not to mention different
 * years have different courses. I'm trying the evolutionary database approach.
 * The best way to make this schema suitable for public-facing is to use SQL
 * views instead of directly querying it. Can't complain about being slow in the
 * prototype phase.
 */
export class CreateCurriculumCourseSchema1792912952302 implements MigrationInterface {
  name = 'CreateCurriculumCourseSchema1792912952302';

  async up(q: QueryRunner): Promise<void> {
    await q.startTransaction();
    try {
      await q.query(`
        CREATE TABLE "curriculums" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "code" varchar(50) NOT NULL,
          "name_vi" varchar(255) NOT NULL,
          "name_en" varchar(255),
          "faculty" varchar(100),
          "total_credits_min" integer,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "uq_curriculums_code_year" UNIQUE ("code")
        )
      `);

      await q.query(`
        CREATE TABLE "requirement_groups" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "curriculum_id" uuid NOT NULL REFERENCES "curriculums" ("id") ON DELETE CASCADE,
          "name" varchar(255) NOT NULL,
          "official_notes" text,
          "credits_total" integer,
          "credits_total_min" integer,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now()
        )
      `);
      await q.query(`CREATE INDEX "ix_requirement_groups_curriculum_id" ON "requirement_groups" ("curriculum_id")`);

      await q.query(`
        CREATE TABLE "courses" (
          "code" varchar(50) PRIMARY KEY,
          "requirement_group_id" uuid NOT NULL REFERENCES "requirement_groups" ("id") ON DELETE CASCADE,
          "name_vi" varchar(255) NOT NULL,
          "name_en" varchar(255),
          "credits" integer NOT NULL,
          "theory_time" integer DEFAULT 0,
          "lab_work_time" integer DEFAULT 0,
          "exercise_time" integer DEFAULT 0,
          "project_time" integer DEFAULT 0,
          "compulsory" boolean NOT NULL DEFAULT false,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now()
        )
      `);
      await q.query(`CREATE INDEX "ix_courses_requirement_group_id" ON "courses" ("requirement_group_id")`);

      await q.commitTransaction();
    } catch (err) {
      await q.rollbackTransaction();
      throw err;
    }
  }

  async down(q: QueryRunner): Promise<void> {
    await q.startTransaction();
    try {
      await q.query(`DROP TABLE "courses"`);
      await q.query(`DROP TABLE "requirement_groups"`);
      await q.query(`DROP TABLE "curriculums"`);
      await q.commitTransaction();
    } catch (err) {
      await q.rollbackTransaction();
      throw err;
    }
  }
}
