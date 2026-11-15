import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdvisorConsents1794400000000 implements MigrationInterface {
  name = 'CreateAdvisorConsents1794400000000';

  async up(q: QueryRunner): Promise<void> {
    // F8 consent (ADR 0003, UC-08 step 2 and A12): a row while the student consents to sending their
    // pseudonymous record to the AI provider; withdrawing deletes it. Keyed by user_id with ON DELETE
    // CASCADE, so account export and deletion cover it with no extra code (ADR 0004). No conversation
    // content is stored anywhere (ADR 0016).
    await q.query(`
      CREATE TABLE "advisor_consents" (
        "user_id" uuid PRIMARY KEY REFERENCES "users" ("id") ON DELETE CASCADE,
        "consented_at" timestamptz NOT NULL DEFAULT now()
      )`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "advisor_consents"`);
  }
}
