import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Term, toTerm } from '../terms/term.js';
import { isOfferedCohort } from './onboarding-options.js';
import { OnboardingAnswers } from './onboarding-answers.entity.js';
import { NO_INTERNSHIP, OnboardingDto } from './onboarding.dto.js';

export interface StudentCohort {
  programCode: string;
  cohortYear: number;
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly db: DataSource,
    @InjectRepository(OnboardingAnswers) private readonly answers: Repository<OnboardingAnswers>,
  ) {}

  offers(programCode: string, cohortYear: number): boolean {
    return isOfferedCohort(programCode, cohortYear);
  }

  async answersFor(userId: string): Promise<OnboardingDto> {
    return toOnboarding(await this.answers.findOneBy({ userId }));
  }

  async cohortOf(userId: string): Promise<StudentCohort | null> {
    const answers = await this.answersFor(userId);
    if (!answers.finished || answers.program === null || answers.cohort === null) return null;
    return { programCode: answers.program, cohortYear: answers.cohort };
  }

  async userIdsByProgram(programCodes: readonly string[], onlyUserId?: string): Promise<Map<string, string[]>> {
    const byProgram = new Map<string, string[]>();
    if (!programCodes.length) return byProgram;
    const rows: { user_id: string; program_code: string }[] = onlyUserId
      ? await this.db.query('SELECT "user_id", "program_code" FROM "onboarding_answers" WHERE "user_id" = $2 AND "program_code" = ANY($1::varchar[])', [programCodes, onlyUserId])
      : await this.db.query('SELECT "user_id", "program_code" FROM "onboarding_answers" WHERE "program_code" = ANY($1::varchar[]) ORDER BY "user_id"', [programCodes]);
    for (const { user_id, program_code } of rows) {
      const ids = byProgram.get(program_code);
      if (ids) ids.push(user_id);
      else byProgram.set(program_code, [user_id]);
    }
    return byProgram;
  }

  async save(userId: string, dto: OnboardingDto): Promise<OnboardingDto> {
    const columns = toColumns(dto);
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
        columns.programCode,
        columns.cohortYear,
        columns.targetGraduationTermYear,
        columns.targetGraduationTermNumber,
        columns.creditsPerTerm,
        columns.internshipTermYear,
        columns.internshipTermNumber,
        columns.noInternshipPlanned,
        dto.finished,
      ],
    );
    return this.answersFor(userId);
  }
}

type AnswerColumns = Omit<OnboardingAnswers, 'userId' | 'user' | 'finishedAt' | 'createdAt' | 'updatedAt'>;

const term = (year: number | null, number: number | null): Term | null => (year === null || number === null ? null : toTerm(year, number));

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
