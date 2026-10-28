import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTranscriptRows1793159431000 implements MigrationInterface {
  name = 'CreateTranscriptRows1793159431000';

  async up(q: QueryRunner): Promise<void> {
    // One row per course taken in a term (ADR 0007); a retake is another row.
    // course_code has no FK to the curriculum: a course outside it is kept (UC-02 step 5).
    await q.query(`
      CREATE TABLE "transcript_rows" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
        "course_code" varchar(20) NOT NULL,
        "course_name" varchar(255) NOT NULL,
        "credits" smallint NOT NULL,
        "grade" numeric(3,1),
        "term_year" smallint NOT NULL,
        "term_number" smallint NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_transcript_rows_course_code" CHECK ("course_code" ~ '^[A-Z0-9]{2,20}$'),
        CONSTRAINT "ck_transcript_rows_credits" CHECK ("credits" BETWEEN 0 AND 30),
        CONSTRAINT "ck_transcript_rows_grade" CHECK ("grade" BETWEEN 0 AND 10),
        CONSTRAINT "ck_transcript_rows_term_year" CHECK ("term_year" BETWEEN 2000 AND 2100),
        CONSTRAINT "ck_transcript_rows_term_number" CHECK ("term_number" IN (1, 2, 3))
      )`);
    await q.query(`CREATE INDEX "ix_transcript_rows_user_id" ON "transcript_rows" ("user_id")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "transcript_rows"`);
  }
}
