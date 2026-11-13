import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Term, termFromColumns } from '../terms/term.js';
import { OnboardingAnswers } from './onboarding-answers.entity.js';
import { NO_INTERNSHIP, OnboardingDto } from './onboarding.dto.js';

// The student's onboarding answers (UC-01 steps 6–10, A8, A9): their program, cohort and default
// planning goal. Stored as given: the credit cap and every other academic rule belong to the rule
// engine when it builds a plan (AGENTS.md hard rule 1, UC-01 §7).
@Injectable()
export class OnboardingService {
  constructor(
    private readonly db: DataSource,
    @InjectRepository(OnboardingAnswers) private readonly answers: Repository<OnboardingAnswers>,
  ) {}

  /** The saved answers; every answer null and finished false before the first save. */
  async answersFor(userId: string): Promise<OnboardingDto> {
    return toOnboarding(await this.answers.findOneBy({ userId }));
  }

  /** Replaces every answer. finished_at keeps the first Finish; finished false clears it. */
  async save(userId: string, dto: OnboardingDto): Promise<OnboardingDto> {
    const c = toColumns(dto);
    // One statement: two saves at once never interleave or fail on the primary key.
    await this.db.query(
      `INSERT INTO "onboarding_answers" AS a (
         "user_id", "program_code", "cohort_year", "target_graduation_term_year", "target_graduation_term_number",
         "credits_per_term", "internship_term_year", "internship_term_number", "no_internship_planned", "finished_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $10::boolean THEN now() END)
       ON CONFLICT ("user_id") DO UPDATE SET
         "program_code" = EXCLUDED."program_code",
         "cohort_year" = EXCLUDED."cohort_year",
         "target_graduation_term_year" = EXCLUDED."target_graduation_term_year",
         "target_graduation_term_number" = EXCLUDED."target_graduation_term_number",
         "credits_per_term" = EXCLUDED."credits_per_term",
         "internship_term_year" = EXCLUDED."internship_term_year",
         "internship_term_number" = EXCLUDED."internship_term_number",
         "no_internship_planned" = EXCLUDED."no_internship_planned",
         "finished_at" = CASE WHEN $10::boolean THEN COALESCE(a."finished_at", now()) END,
         "updated_at" = now()`,
      [
        userId,
        c.programCode,
        c.cohortYear,
        c.targetGraduationTermYear,
        c.targetGraduationTermNumber,
        c.creditsPerTerm,
        c.internshipTermYear,
        c.internshipTermNumber,
        c.noInternshipPlanned,
        dto.finished,
      ],
    );
    return this.answersFor(userId);
  }
}

type AnswerColumns = Omit<OnboardingAnswers, 'userId' | 'user' | 'finishedAt' | 'createdAt' | 'updatedAt'>;

const term = (year: number | null, number: number | null): Term | null =>
  year === null || number === null ? null : termFromColumns(year, number);

export function toOnboarding(row: OnboardingAnswers | null): OnboardingDto {
  if (!row) {
    return { program: null, cohort: null, targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: null, finished: false };
  }
  return {
    program: row.programCode,
    cohort: row.cohortYear,
    targetGraduationTerm: term(row.targetGraduationTermYear, row.targetGraduationTermNumber),
    creditsPerTerm: row.creditsPerTerm,
    internshipTerm: row.noInternshipPlanned ? NO_INTERNSHIP : term(row.internshipTermYear, row.internshipTermNumber),
    finished: row.finishedAt !== null,
  };
}

export function toColumns(dto: OnboardingDto): AnswerColumns {
  const internship = dto.internshipTerm === NO_INTERNSHIP ? null : dto.internshipTerm;
  return {
    programCode: dto.program,
    cohortYear: dto.cohort,
    targetGraduationTermYear: dto.targetGraduationTerm?.year ?? null,
    targetGraduationTermNumber: dto.targetGraduationTerm?.number ?? null,
    creditsPerTerm: dto.creditsPerTerm,
    internshipTermYear: internship?.year ?? null,
    internshipTermNumber: internship?.number ?? null,
    noInternshipPlanned: dto.internshipTerm === NO_INTERNSHIP,
  };
}
