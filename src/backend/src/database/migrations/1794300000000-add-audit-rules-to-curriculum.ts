import { MigrationInterface, QueryRunner } from 'typeorm';

// The curriculum rules the degree audit needs that #23's schema could not hold (ADR 0013):
// - programs.training_type sets the credit caps and the kind of term 3 (ADR 0012, QĐ 1175/QĐ-KHTN
//   Điều 6.4 and 7.2). Nullable: a program entered without one gets no cap check, never a guessed one.
// - A course link may count toward neither the cohort total nor the GPA (Điều 15.1.c: Giáo dục thể
//   chất, Giáo dục quốc phòng - An ninh; APCS p.6, CLC booklet p.9).
// - A combined minimum: several groups must reach a number of credits together (APCS (B) + (C) ≥ 43, p.5).
// - An overflow: credits passed in a group beyond its own minimum count toward another group of the
//   same curriculum (APCS: "Sinh viên có thể dùng số tín chỉ dư thuộc (A) cho (C)", p.5).
// The seed fills the two new tables on its next run (insert-only). It never updates an existing
// row, so the link flags and the training type of rows seeded before this migration are set here.
export class AddAuditRulesToCurriculum1794300000000 implements MigrationInterface {
  name = 'AddAuditRulesToCurriculum1794300000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "programs" ADD COLUMN "training_type" varchar(20),
        ADD CONSTRAINT "ck_programs_training_type" CHECK ("training_type" IN ('advanced', 'joint', 'high_quality', 'standard'))
    `);
    // APCS is the Advanced Program (Chương trình Tiên tiến); the CLC 2025 programs are Chất lượng cao (ADR 0012).
    await q.query(`UPDATE "programs" SET "training_type" = 'advanced' WHERE "code" = 'APCS'`);
    await q.query(`UPDATE "programs" SET "training_type" = 'high_quality' WHERE "code" LIKE 'CNTT-TCTA-%'`);

    await q.query(`
      ALTER TABLE "requirement_group_courses"
        ADD COLUMN "counts_toward_total" boolean NOT NULL DEFAULT true,
        ADD COLUMN "counts_toward_gpa" boolean NOT NULL DEFAULT true
    `);
    // The rows the seed marks counts_toward_total: false (APCS p.6; CLC groups 7.1.5 and 7.1.6, booklet p.9).
    await q.query(`
      UPDATE "requirement_group_courses" AS l
      SET "counts_toward_total" = false, "counts_toward_gpa" = false
      FROM "requirement_groups" g
      JOIN "curriculums" c ON c."id" = g."curriculum_id"
      JOIN "programs" p ON p."id" = c."program_id"
      WHERE l."requirement_group_id" = g."id"
        AND (
          (p."code" = 'APCS' AND c."cohort_year" IN (2024, 2025) AND l."course_code" IN ('BAA00021', 'BAA00022', 'BAA00030'))
          OR (p."code" LIKE 'CNTT-TCTA-%' AND c."cohort_year" = 2025 AND g."name" IN ('Giáo dục thể chất', 'Giáo dục quốc phòng - An ninh'))
        )
    `);

    await q.query(`
      CREATE TABLE "combined_minimums" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "curriculum_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "credits_min" integer NOT NULL,
        "official_notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "combined_minimums_curriculum_id_fkey" FOREIGN KEY ("curriculum_id") REFERENCES "curriculums" ("id") ON DELETE CASCADE,
        CONSTRAINT "uq_combined_minimums_curriculum_name" UNIQUE ("curriculum_id", "name"),
        CONSTRAINT "ck_combined_minimums_credits_min" CHECK ("credits_min" > 0)
      )
    `);
    await q.query(`
      CREATE TABLE "combined_minimum_groups" (
        "combined_minimum_id" uuid NOT NULL,
        "requirement_group_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "combined_minimum_groups_pkey" PRIMARY KEY ("combined_minimum_id", "requirement_group_id"),
        CONSTRAINT "combined_minimum_groups_combined_minimum_id_fkey" FOREIGN KEY ("combined_minimum_id") REFERENCES "combined_minimums" ("id") ON DELETE CASCADE,
        CONSTRAINT "combined_minimum_groups_requirement_group_id_fkey" FOREIGN KEY ("requirement_group_id") REFERENCES "requirement_groups" ("id") ON DELETE CASCADE
      )
    `);
    await q.query(`CREATE INDEX "ix_combined_minimum_groups_requirement_group_id" ON "combined_minimum_groups" ("requirement_group_id")`);
    // One target per group: the primary key is the source group.
    await q.query(`
      CREATE TABLE "requirement_group_overflows" (
        "from_group_id" uuid NOT NULL,
        "to_group_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "requirement_group_overflows_pkey" PRIMARY KEY ("from_group_id"),
        CONSTRAINT "requirement_group_overflows_from_group_id_fkey" FOREIGN KEY ("from_group_id") REFERENCES "requirement_groups" ("id") ON DELETE CASCADE,
        CONSTRAINT "requirement_group_overflows_to_group_id_fkey" FOREIGN KEY ("to_group_id") REFERENCES "requirement_groups" ("id") ON DELETE CASCADE,
        CONSTRAINT "ck_requirement_group_overflows_not_self" CHECK ("from_group_id" <> "to_group_id")
      )
    `);
    await q.query(`CREATE INDEX "ix_requirement_group_overflows_to_group_id" ON "requirement_group_overflows" ("to_group_id")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "requirement_group_overflows"`);
    await q.query(`DROP TABLE "combined_minimum_groups"`);
    await q.query(`DROP TABLE "combined_minimums"`);
    await q.query(`ALTER TABLE "requirement_group_courses" DROP COLUMN "counts_toward_gpa", DROP COLUMN "counts_toward_total"`);
    await q.query(`ALTER TABLE "programs" DROP CONSTRAINT "ck_programs_training_type", DROP COLUMN "training_type"`);
  }
}
