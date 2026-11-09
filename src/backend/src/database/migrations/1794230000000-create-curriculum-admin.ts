import { MigrationInterface, QueryRunner } from 'typeorm';

// F12 (ADR 0011, amended 9 November 2026): administration grants, and the prerequisites and
// offering terms of a course within one curriculum.
export class CreateCurriculumAdmin1794230000000 implements MigrationInterface {
  name = 'CreateCurriculumAdmin1794230000000';

  async up(q: QueryRunner): Promise<void> {
    // A grant row is about its recipient (user_id, CASCADE: purged with them, exported to them).
    // granted_by points at someone else, so purging the granter keeps the grant (SET NULL).
    await q.query(`
      CREATE TABLE "program_admin_grants" (
        "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
        "program_id" uuid NOT NULL REFERENCES "programs" ("id") ON DELETE RESTRICT,
        "granted_at" timestamptz NOT NULL DEFAULT now(),
        "granted_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        PRIMARY KEY ("user_id", "program_id")
      )
    `);
    await q.query(`CREATE INDEX "ix_program_admin_grants_program_id" ON "program_admin_grants" ("program_id")`);

    // Separate from program grants, so a missing program can never read as global access.
    await q.query(`
      CREATE TABLE "global_admin_grants" (
        "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
        "permission" varchar(32) NOT NULL,
        "granted_at" timestamptz NOT NULL DEFAULT now(),
        "granted_by" uuid REFERENCES "users" ("id") ON DELETE SET NULL,
        PRIMARY KEY ("user_id", "permission"),
        CONSTRAINT "ck_global_admin_grants_permission" CHECK ("permission" IN ('catalog_maintainer', 'access_manager'))
      )
    `);

    // A row says "the prerequisites of this course in this curriculum have been entered",
    // even when the list is empty. Without it, no prerequisite reads as "not recorded".
    await q.query(`
      CREATE TABLE "course_prerequisite_lists" (
        "curriculum_id" uuid NOT NULL REFERENCES "curriculums" ("id") ON DELETE CASCADE,
        "course_code" varchar(20) NOT NULL REFERENCES "courses" ("code") ON DELETE RESTRICT,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("curriculum_id", "course_code")
      )
    `);
    await q.query(`CREATE INDEX "ix_course_prerequisite_lists_course_code" ON "course_prerequisite_lists" ("course_code")`);

    // Every listed prerequisite must be passed first (a conjunction); no alternatives or kinds.
    await q.query(`
      CREATE TABLE "course_prerequisites" (
        "curriculum_id" uuid NOT NULL,
        "course_code" varchar(20) NOT NULL,
        "prerequisite_code" varchar(20) NOT NULL REFERENCES "courses" ("code") ON DELETE RESTRICT,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("curriculum_id", "course_code", "prerequisite_code"),
        FOREIGN KEY ("curriculum_id", "course_code") REFERENCES "course_prerequisite_lists" ("curriculum_id", "course_code") ON DELETE CASCADE,
        CONSTRAINT "ck_course_prerequisites_not_self" CHECK ("prerequisite_code" <> "course_code")
      )
    `);
    await q.query(`CREATE INDEX "ix_course_prerequisites_prerequisite" ON "course_prerequisites" ("curriculum_id", "prerequisite_code")`);
    await q.query(`CREATE INDEX "ix_course_prerequisites_prerequisite_code" ON "course_prerequisites" ("prerequisite_code")`);

    // The term numbers (ADR 0009, 0012) a course is offered in. No rows: not recorded.
    await q.query(`
      CREATE TABLE "course_offering_terms" (
        "curriculum_id" uuid NOT NULL REFERENCES "curriculums" ("id") ON DELETE CASCADE,
        "course_code" varchar(20) NOT NULL REFERENCES "courses" ("code") ON DELETE RESTRICT,
        "term_number" smallint NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("curriculum_id", "course_code", "term_number"),
        CONSTRAINT "ck_course_offering_terms_term_number" CHECK ("term_number" IN (1, 2, 3))
      )
    `);
    await q.query(`CREATE INDEX "ix_course_offering_terms_course_code" ON "course_offering_terms" ("course_code")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "course_offering_terms"`);
    await q.query(`DROP TABLE "course_prerequisites"`);
    await q.query(`DROP TABLE "course_prerequisite_lists"`);
    await q.query(`DROP TABLE "global_admin_grants"`);
    await q.query(`DROP TABLE "program_admin_grants"`);
  }
}
