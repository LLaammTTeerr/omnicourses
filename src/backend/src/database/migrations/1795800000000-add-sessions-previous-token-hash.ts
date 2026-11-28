import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionsPreviousTokenHash1795800000000 implements MigrationInterface {
  name = 'AddSessionsPreviousTokenHash1795800000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "sessions" ADD COLUMN "previous_token_hash" character(64)`);
    await q.query(`CREATE INDEX "ix_sessions_previous_token_hash" ON "sessions" ("previous_token_hash")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX "ix_sessions_previous_token_hash"`);
    await q.query(`ALTER TABLE "sessions" DROP COLUMN "previous_token_hash"`);
  }
}
