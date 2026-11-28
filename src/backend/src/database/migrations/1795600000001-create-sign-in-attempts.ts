import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSignInAttempts1795600000001 implements MigrationInterface {
  name = 'CreateSignInAttempts1795600000001';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS "sign_in_attempts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "attempt_key" character(64) NOT NULL,
        "attempted_at" TIMESTAMPTZ NOT NULL,
        CONSTRAINT "PK_sign_in_attempts" PRIMARY KEY ("id")
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_sign_in_attempts_key_time" ON "sign_in_attempts" ("attempt_key", "attempted_at")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "idx_sign_in_attempts_time" ON "sign_in_attempts" ("attempted_at")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "sign_in_attempts"`);
  }
}
