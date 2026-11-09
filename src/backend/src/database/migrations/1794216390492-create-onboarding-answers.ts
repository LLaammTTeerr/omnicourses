import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOnboardingAnswers1794216390492 implements MigrationInterface {
  name = 'CreateOnboardingAnswers1794216390492';

  async up(q: QueryRunner): Promise<void> {
    // F1 onboarding answers (UC-01 steps 6–10): one row per student, keyed by user_id, so account
    // export and deletion cover it with no extra code (ADR 0004). Null means not answered.
    // Program and cohort are a code and a year, not a key to curriculums: which ones are offered is
    // a constant in the onboarding module for B1, and a plan keeps its own curriculum (UC-01 A9).
    // Terms follow ADR 0009. The goal-term window (current term to 8 years ahead) moves with the
    // date, so the API checks it, not a CHECK.
    await q.query(`
      CREATE TABLE "onboarding_answers" (
        "user_id" uuid PRIMARY KEY REFERENCES "users" ("id") ON DELETE CASCADE,
        "program_code" varchar(50),
        "cohort_year" smallint,
        "target_graduation_term_year" smallint,
        "target_graduation_term_number" smallint,
        "credits_per_term" integer,
        "internship_term_year" smallint,
        "internship_term_number" smallint,
        "no_internship_planned" boolean NOT NULL DEFAULT false,
        "finished_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ck_onboarding_answers_program_cohort" CHECK (("program_code" IS NULL) = ("cohort_year" IS NULL)),
        CONSTRAINT "ck_onboarding_answers_cohort_year" CHECK ("cohort_year" BETWEEN 2000 AND 2100),
        CONSTRAINT "ck_onboarding_answers_target_term" CHECK (("target_graduation_term_year" IS NULL) = ("target_graduation_term_number" IS NULL)),
        CONSTRAINT "ck_onboarding_answers_target_term_year" CHECK ("target_graduation_term_year" BETWEEN 2000 AND 2100),
        CONSTRAINT "ck_onboarding_answers_target_term_number" CHECK ("target_graduation_term_number" IN (1, 2, 3)),
        CONSTRAINT "ck_onboarding_answers_credits_per_term" CHECK ("credits_per_term" >= 1),
        CONSTRAINT "ck_onboarding_answers_internship_term" CHECK (("internship_term_year" IS NULL) = ("internship_term_number" IS NULL)),
        CONSTRAINT "ck_onboarding_answers_internship_term_year" CHECK ("internship_term_year" BETWEEN 2000 AND 2100),
        CONSTRAINT "ck_onboarding_answers_internship_term_number" CHECK ("internship_term_number" IN (1, 2, 3)),
        CONSTRAINT "ck_onboarding_answers_no_internship" CHECK (NOT "no_internship_planned" OR "internship_term_year" IS NULL),
        CONSTRAINT "ck_onboarding_answers_finished" CHECK ("finished_at" IS NULL OR "program_code" IS NOT NULL)
      )`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "onboarding_answers"`);
  }
}
