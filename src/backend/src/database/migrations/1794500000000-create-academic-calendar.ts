import { MigrationInterface, QueryRunner } from 'typeorm';

// F10 school dates (ADR 0016): the academic calendar a program administrator enters each term.
// Shared data of a program, not a student's record, so no user_id. The two actor columns point
// at someone else's account and are nulled on purge (AGENTS.md, ADR 0004). Production seeds none.
export class CreateAcademicCalendar1794500000000 implements MigrationInterface {
  name = 'CreateAcademicCalendar1794500000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "academic_calendar_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "program_id" uuid NOT NULL,
        "academic_year" smallint NOT NULL,
        "term" smallint,
        "kind" varchar(32) NOT NULL,
        "starts_on" date NOT NULL,
        "ends_on" date NOT NULL,
        "title" varchar(255) NOT NULL,
        "title_en" varchar(255),
        "source_url" varchar(2048),
        "notes" text,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "academic_calendar_events_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "academic_calendar_events_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs" ("id") ON DELETE RESTRICT,
        CONSTRAINT "academic_calendar_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "academic_calendar_events_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id") ON DELETE SET NULL,
        CONSTRAINT "ck_academic_calendar_events_kind" CHECK ("kind" IN ('term_start', 'term_end', 'registration', 'add_drop', 'exam_period', 'holiday', 'other')),
        CONSTRAINT "ck_academic_calendar_events_term" CHECK ("term" IN (1, 2, 3)),
        CONSTRAINT "ck_academic_calendar_events_academic_year" CHECK ("academic_year" BETWEEN 2000 AND 2100),
        CONSTRAINT "ck_academic_calendar_events_range" CHECK ("ends_on" >= "starts_on"),
        CONSTRAINT "ck_academic_calendar_events_source_url" CHECK ("source_url" LIKE 'https://%')
      )
    `);
    await q.query(`CREATE INDEX "ix_academic_calendar_events_program_starts_on" ON "academic_calendar_events" ("program_id", "starts_on")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "academic_calendar_events"`);
  }
}
