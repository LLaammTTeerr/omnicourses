import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsersDeletionRequestedAt1792886400000 implements MigrationInterface {
  name = 'AddUsersDeletionRequestedAt1792886400000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ADD COLUMN "deletion_requested_at" timestamptz`);
    await q.query(`CREATE INDEX "ix_users_deletion_requested_at" ON "users" ("deletion_requested_at") WHERE "deletion_requested_at" IS NOT NULL`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX "ix_users_deletion_requested_at"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN "deletion_requested_at"`);
  }
}
