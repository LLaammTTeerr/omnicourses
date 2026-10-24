import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiUsage1792800000000 implements MigrationInterface {
  name = 'CreateAiUsage1792800000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "ai_usage" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
        "feature" varchar(50) NOT NULL,
        "model" varchar(100) NOT NULL,
        "input_tokens" integer NOT NULL,
        "output_tokens" integer NOT NULL,
        "latency_ms" integer NOT NULL,
        "succeeded" boolean NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX "ix_ai_usage_user_id_created_at" ON "ai_usage" ("user_id", "created_at")`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "ai_usage"`);
  }
}
