import { MigrationInterface, QueryRunner } from 'typeorm';

// Account deletion (ADR 0004): when the student asked, and the deadline promised
// to them then. The deadline is stored, never derived from deletion_requested_at
// and the current ACCOUNT_DELETION_GRACE_DAYS, so changing the setting can't move
// the deadline of an account already waiting. Both are set and cleared together.
export class AddUsersDeletionRequestedAt1792886400000 implements MigrationInterface {
  name = 'AddUsersDeletionRequestedAt1792886400000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ADD COLUMN "deletion_requested_at" timestamptz, ADD COLUMN "purge_after" timestamptz`);
    await q.query(`ALTER TABLE "users" ADD CONSTRAINT "ck_users_deletion_pending" CHECK (("deletion_requested_at" IS NULL) = ("purge_after" IS NULL))`);
    await q.query(`CREATE INDEX "ix_users_purge_after" ON "users" ("purge_after") WHERE "purge_after" IS NOT NULL`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX "ix_users_purge_after"`);
    await q.query(`ALTER TABLE "users" DROP CONSTRAINT "ck_users_deletion_pending"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN "purge_after", DROP COLUMN "deletion_requested_at"`);
  }
}
