import { MigrationInterface, QueryRunner } from 'typeorm';

// F10 notification inbox (ADR 0018). One row per notification of one student; user_id cascades,
// so the account export and the purge cover the table (AGENTS.md, ADR 0004).
// calendar_event_id deliberately has no foreign key to academic_calendar: deleting a school date
// must neither delete a notification a student already received (CASCADE) nor lose which date it
// was about (SET NULL would also free the uniqueness key). The row keeps a copy of the date.
// The uniqueness key is (user, event, kind), never the date: a moved date and two runs at once
// both insert nothing twice. NULLs are distinct, so transcript notifications are not limited.
export class CreateNotifications1795564800000 implements MigrationInterface {
  name = 'CreateNotifications1795564800000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "kind" varchar(32) NOT NULL,
        "calendar_event_id" uuid,
        "program_code" varchar(50),
        "academic_year" smallint,
        "term" smallint,
        "starts_on" date,
        "ends_on" date,
        "title" varchar(255),
        "title_en" varchar(255),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "read_at" timestamptz,
        CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "uq_notifications_user_event_kind" UNIQUE ("user_id", "calendar_event_id", "kind"),
        CONSTRAINT "ck_notifications_kind" CHECK ("kind" IN ('registration_soon', 'registration_open', 'term_start', 'transcript_changed')),
        CONSTRAINT "ck_notifications_event" CHECK (("kind" = 'transcript_changed') = ("calendar_event_id" IS NULL)),
        CONSTRAINT "ck_notifications_snapshot" CHECK (
          CASE WHEN "calendar_event_id" IS NULL
            THEN num_nonnulls("program_code", "academic_year", "term", "starts_on", "ends_on", "title", "title_en") = 0
            ELSE num_nulls("program_code", "academic_year", "starts_on", "ends_on", "title") = 0 END)
      )
    `);
    // The inbox reads one student's rows newest first; PostgreSQL scans this index backwards.
    await q.query(`CREATE INDEX "ix_notifications_user_created" ON "notifications" ("user_id", "created_at", "id")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "notifications"`);
  }
}
