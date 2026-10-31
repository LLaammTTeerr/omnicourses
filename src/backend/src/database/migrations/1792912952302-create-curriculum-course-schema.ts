import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCurriculumCourseSchema1792912952302 implements MigrationInterface {
  name = 'CreateCurriculumCourseSchema1792912952302';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "programs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(50) NOT NULL,
        "name_vi" varchar(255) NOT NULL,
        "name_en" varchar(255),
        "faculty" varchar(100),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_programs_code" UNIQUE ("code")
      )
    `);

    await q.query(`
      CREATE TABLE "curriculums" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "program_id" uuid NOT NULL REFERENCES "programs" ("id") ON DELETE RESTRICT,
        "cohort_year" integer NOT NULL,
        "code" varchar(50) NOT NULL,
        "name_vi" varchar(255) NOT NULL,
        "name_en" varchar(255),
        "language" varchar(10),
        "total_credits_min" integer,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_curriculums_program_cohort" UNIQUE ("program_id", "cohort_year"),
        CONSTRAINT "ck_curriculums_cohort_year_range" CHECK ("cohort_year" BETWEEN 2000 AND 2100)
      )
    `);
    await q.query(`CREATE INDEX "ix_curriculums_program_id" ON "curriculums" ("program_id")`);

    await q.query(`
      CREATE TABLE "requirement_groups" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "curriculum_id" uuid NOT NULL REFERENCES "curriculums" ("id") ON DELETE CASCADE,
        "name" varchar(255) NOT NULL,
        "kind" varchar(20) NOT NULL,
        "official_notes" text,
        "credits_total" integer,
        "credits_total_min" integer,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_requirement_groups_kind" CHECK ("kind" IN ('compulsory', 'elective')),
        CONSTRAINT "uq_requirement_groups_curriculum_name" UNIQUE ("curriculum_id", "name")
      )
    `);
    await q.query(`CREATE INDEX "ix_requirement_groups_curriculum_id" ON "requirement_groups" ("curriculum_id")`);

    await q.query(`
      CREATE TABLE "courses" (
        "code" varchar(20) PRIMARY KEY,
        "name_vi" varchar(255) NOT NULL,
        "name_en" varchar(255),
        "credits" integer NOT NULL,
        "theory_periods" integer DEFAULT 0,
        "lab_periods" integer DEFAULT 0,
        "exercise_periods" integer DEFAULT 0,
        "project_periods" integer DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_courses_code_format" CHECK ("code" ~ '^[A-Z0-9]{2,20}$'),
        CONSTRAINT "ck_courses_credits_positive" CHECK ("credits" > 0),
        CONSTRAINT "ck_courses_periods_non_negative" CHECK (
          COALESCE("theory_periods", 0) >= 0 AND
          COALESCE("lab_periods", 0) >= 0 AND
          COALESCE("exercise_periods", 0) >= 0 AND
          COALESCE("project_periods", 0) >= 0
        )
      )
    `);

    await q.query(`
      CREATE TABLE "requirement_group_courses" (
        "requirement_group_id" uuid NOT NULL REFERENCES "requirement_groups" ("id") ON DELETE CASCADE,
        "course_code" varchar(20) NOT NULL REFERENCES "courses" ("code") ON DELETE RESTRICT,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("requirement_group_id", "course_code"),
        CONSTRAINT "ck_requirement_group_courses_code_format" CHECK ("course_code" ~ '^[A-Z0-9]{2,20}$')
      )
    `);
    await q.query(`CREATE INDEX "ix_requirement_group_courses_course_code" ON "requirement_group_courses" ("course_code")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "requirement_group_courses"`);
    await q.query(`DROP TABLE "courses"`);
    await q.query(`DROP TABLE "requirement_groups"`);
    await q.query(`DROP TABLE "curriculums"`);
    await q.query(`DROP TABLE "programs"`);
  }
}
