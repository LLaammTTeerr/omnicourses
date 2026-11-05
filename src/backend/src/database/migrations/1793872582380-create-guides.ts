import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGuides1793872582380 implements MigrationInterface {
  name = 'CreateGuides1793872582380';

  async up(q: QueryRunner): Promise<void> {
    // F11 guides (ADR 0010): written only by the seed, from the content files.
    // One row per guide ID, never deleted, so problem reports (B3) can keep pointing at it.
    await q.query(`
      CREATE TABLE "guides" (
        "id" varchar(64) PRIMARY KEY,
        "group" varchar(40) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_guides_id" CHECK ("id" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
        CONSTRAINT "ck_guides_group" CHECK ("group" IN ('accounts-and-portals', 'registration', 'timetable-and-exams',
          'tuition-and-fees', 'records-and-certificates', 'scholarships', 'internship-and-thesis', 'graduation'))
      )`);
    // One row per guide and language. Drafts are never loaded; a text whose file is
    // removed is withdrawn, not deleted. No user_id: a guide holds no personal data.
    await q.query(`
      CREATE TABLE "guide_texts" (
        "guide_id" varchar(64) NOT NULL REFERENCES "guides" ("id") ON DELETE CASCADE,
        "lang" varchar(2) NOT NULL,
        "status" varchar(20) NOT NULL,
        "version" integer NOT NULL,
        "change_note" text NOT NULL,
        "last_checked_on" date NOT NULL,
        "last_checked_by" varchar(100) NOT NULL,
        "title" varchar(200) NOT NULL,
        "keywords" text[] NOT NULL,
        "content" jsonb NOT NULL,
        "content_hash" char(64) NOT NULL,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("guide_id", "lang"),
        CONSTRAINT "ck_guide_texts_lang" CHECK ("lang" IN ('vi', 'en')),
        CONSTRAINT "ck_guide_texts_status" CHECK ("status" IN ('published', 'withdrawn')),
        CONSTRAINT "ck_guide_texts_version" CHECK ("version" >= 1)
      )`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "guide_texts"`);
    await q.query(`DROP TABLE "guides"`);
  }
}
