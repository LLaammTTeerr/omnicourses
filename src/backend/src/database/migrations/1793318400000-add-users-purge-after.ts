import { MigrationInterface, QueryRunner } from 'typeorm';

// Stores the deadline promised to the student (ADR 0004). Deriving it from
// deletion_requested_at + the current grace setting moved the deadline of
// every waiting account whenever ACCOUNT_DELETION_GRACE_DAYS changed.
export class AddUsersPurgeAfter1793318400000 implements MigrationInterface {
  name = 'AddUsersPurgeAfter1793318400000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ADD COLUMN "purge_after" timestamptz`);
    await q.query(`UPDATE "users" SET "purge_after" = "deletion_requested_at" + interval '30 days' WHERE "deletion_requested_at" IS NOT NULL`);
    await q.query(`ALTER TABLE "users" ADD CONSTRAINT "ck_users_deletion_pending" CHECK (("deletion_requested_at" IS NULL) = ("purge_after" IS NULL))`);
    await q.query(`DROP INDEX "ix_users_deletion_requested_at"`);
    await q.query(`CREATE INDEX "ix_users_purge_after" ON "users" ("purge_after") WHERE "purge_after" IS NOT NULL`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX "ix_users_purge_after"`);
    await q.query(`CREATE INDEX "ix_users_deletion_requested_at" ON "users" ("deletion_requested_at") WHERE "deletion_requested_at" IS NOT NULL`);
    await q.query(`ALTER TABLE "users" DROP CONSTRAINT "ck_users_deletion_pending"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN "purge_after"`);
  }
}
