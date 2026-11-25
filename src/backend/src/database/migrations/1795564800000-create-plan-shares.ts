import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePlanShares1795564800000 implements MigrationInterface {
  name = 'CreatePlanShares1795564800000';

  async up(q: QueryRunner): Promise<void> {
    // F9 shared plans (UC-09, ADR 0010): the live link of a plan. One row per plan (UC-09 A4), and
    // no row means "not shared": stopping a link deletes its row, so a stopped link and one that
    // never existed are the same to a reader (A2, A8). Deleting the plan or the account deletes it
    // too (A6). The key to plans is the pair (plan_id, user_id), as for plan_placements, so a link
    // is always its plan owner's; its own user_id makes export and purge cover it (ADR 0004).
    // share_token is 32 random bytes in base64url. It is kept readable because the owner must be
    // shown the live link again (A4); its name ends in _token, so the account export never selects it.
    // show_name and show_transcript_checks are the owner's two choices for the link, both off unless
    // the owner turns them on: the display name, and the checks the rule engine decides from the
    // owner's transcript (which tell a reader what the owner passed or is taking).
    await q.query(`
      CREATE TABLE "plan_shares" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "plan_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "share_token" varchar(43) NOT NULL,
        "show_name" boolean NOT NULL DEFAULT false,
        "show_transcript_checks" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "plan_shares_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "uq_plan_shares_plan_id" UNIQUE ("plan_id"),
        CONSTRAINT "uq_plan_shares_share_token" UNIQUE ("share_token"),
        CONSTRAINT "plan_shares_plan_fkey" FOREIGN KEY ("plan_id", "user_id") REFERENCES "plans" ("id", "user_id") ON DELETE CASCADE,
        CONSTRAINT "plan_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "ck_plan_shares_share_token" CHECK ("share_token" ~ '^[A-Za-z0-9_-]{43}$')
      )`);
    await q.query(`CREATE INDEX "ix_plan_shares_user_id" ON "plan_shares" ("user_id")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "plan_shares"`);
  }
}
