import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersAndSessions1761696000000 implements MigrationInterface {
  name = 'CreateUsersAndSessions1761696000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(254) NOT NULL,
        "password_hash" text,
        "display_name" varchar(100) NOT NULL,
        "google_sub" varchar(255),
        "email_verified_at" timestamptz,
        "consent_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "uq_users_email" UNIQUE ("email"),
        CONSTRAINT "uq_users_google_sub" UNIQUE ("google_sub"),
        CONSTRAINT "ck_users_email_lowercase" CHECK ("email" = lower("email")),
        CONSTRAINT "ck_users_has_credential" CHECK ("password_hash" IS NOT NULL OR "google_sub" IS NOT NULL)
      )`);
    await q.query(`
      CREATE TABLE "sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
        "token_hash" char(64) NOT NULL,
        "user_agent" varchar(512),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "rotated_at" timestamptz,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        CONSTRAINT "uq_sessions_token_hash" UNIQUE ("token_hash")
      )`);
    await q.query(`CREATE INDEX "ix_sessions_user_id" ON "sessions" ("user_id")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "sessions"`);
    await q.query(`DROP TABLE "users"`);
  }
}
