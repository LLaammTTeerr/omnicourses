import { ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsObject, ValidateBy, ValidateIf, ValidateNested, ValidationOptions } from 'class-validator';
import { vietnamDate } from '../config/time.js';
import { termLabel } from '../terms/current-term.js';
import { TermDto } from '../terms/term.dto.js';
import { Term, TERM_NUMBERS } from '../terms/term.js';
import { goalTermWindow, isInGoalTermWindow, isOfferedCohort, OFFERED_COHORTS, OFFERED_PROGRAMS, YEARS_AHEAD } from './onboarding-options.js';

/** internshipTerm when the student plans no internship: kept apart from null, which means not answered (B1 §6 item 3). */
export const NO_INTERNSHIP = 'none';

// The column is an integer. Onboarding has no upper limit (B1 §6 item 2): the rule engine applies
// the credit cap when it builds a plan, so no message here mentions the cap.
const MAX_STORED_CREDITS = 2_147_483_647;
const CREDITS_MESSAGE = 'creditsPerTerm must be a whole number of 1 or more';

const isTermShape = (value: unknown): value is Term =>
  typeof value === 'object' &&
  value !== null &&
  Number.isInteger((value as Term).year) &&
  (TERM_NUMBERS as readonly unknown[]).includes((value as Term).number);

/** A term from the current one up to YEARS_AHEAD academic years ahead (B1 §6 item 4), on today's Vietnam date. */
function IsGoalTerm(options?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isGoalTerm',
      // A malformed term is reported by TermDto's own rules; this only places a well-formed one.
      validator: {
        validate: (value: unknown) => !isTermShape(value) || isInGoalTermWindow(value, vietnamDate(new Date())),
        defaultMessage: (args) => {
          const { first, last } = goalTermWindow(vietnamDate(new Date()));
          return `${args?.property} must be from ${termLabel(first)} (the current term) to ${termLabel(last)}`;
        },
      },
    },
    options,
  );
}

// The same shape is read and saved: GET returns what PUT took. PUT replaces every answer, so each
// key must be sent; null means not answered.
export class OnboardingDto {
  @ApiProperty({
    type: String,
    enum: OFFERED_PROGRAMS,
    nullable: true,
    example: 'APCS',
    description: 'Program code. Only the programs offered in this release; null until the student picks one (UC-01 A7).',
  })
  @ValidateIf((dto: OnboardingDto) => dto.program !== null)
  @IsIn(OFFERED_PROGRAMS, { message: `program must be one of: ${OFFERED_PROGRAMS.join(', ')}, or null` })
  program!: string | null;

  @ApiProperty({
    type: 'integer',
    nullable: true,
    example: 2024,
    description: `Cohort: the year the student entered the program. Offered: ${Object.entries(OFFERED_COHORTS)
      .map(([program, cohorts]) => `${program} ${cohorts.join(', ')}`)
      .join('; ')}. Set together with program, and null together with it.`,
  })
  @ValidateBy({
    name: 'isOfferedCohort',
    validator: {
      validate: (cohort, args) => {
        const { program } = args?.object as OnboardingDto;
        if (program === null) return cohort === null;
        // An unknown program is the program's error alone.
        return !OFFERED_PROGRAMS.includes(program as string) || isOfferedCohort(program, cohort);
      },
      defaultMessage: (args) => {
        const { program } = args?.object as OnboardingDto;
        return program === null
          ? 'cohort must be null when program is null'
          : `cohort must be one of ${OFFERED_COHORTS[program].join(', ')} for ${program}`;
      },
    },
  })
  cohort!: number | null;

  @ApiProperty({
    type: TermDto,
    nullable: true,
    description: `Target graduation term, from the current term up to ${YEARS_AHEAD} academic years ahead; null when not set.`,
  })
  @ValidateIf((dto: OnboardingDto) => dto.targetGraduationTerm !== null)
  @IsObject({ message: 'targetGraduationTerm must be a term or null' })
  @ValidateNested()
  @Type(() => TermDto)
  @IsGoalTerm()
  targetGraduationTerm!: TermDto | null;

  @ApiProperty({
    type: 'integer',
    nullable: true,
    minimum: 1,
    example: 18,
    description: 'Credits the student wants to take per term, a whole number of 1 or more; null when not set. Stored as asked: the rule engine applies the credit cap when it builds a plan.',
  })
  @ValidateIf((dto: OnboardingDto) => dto.creditsPerTerm !== null)
  @ValidateBy({
    name: 'isCreditsPerTerm',
    validator: {
      validate: (credits) => Number.isInteger(credits) && credits >= 1 && credits <= MAX_STORED_CREDITS,
      defaultMessage: (args) => (Number.isInteger(args?.value) && args?.value > MAX_STORED_CREDITS ? 'creditsPerTerm is too large to store' : CREDITS_MESSAGE),
    },
  })
  creditsPerTerm!: number | null;

  @ApiProperty({
    oneOf: [{ $ref: getSchemaPath(TermDto) }, { type: 'string', enum: [NO_INTERNSHIP] }],
    nullable: true,
    description: `Internship term, in the same range as targetGraduationTerm; "${NO_INTERNSHIP}" when none is planned; null when not set.`,
  })
  @ValidateIf((dto: OnboardingDto) => dto.internshipTerm !== null && dto.internshipTerm !== NO_INTERNSHIP)
  @IsObject({ message: `internshipTerm must be a term, "${NO_INTERNSHIP}" or null` })
  @ValidateNested()
  @Type(() => TermDto)
  @IsGoalTerm()
  internshipTerm!: TermDto | typeof NO_INTERNSHIP | null;

  @ApiProperty({
    description: 'The student pressed Finish (UC-01 step 9): onboarding then opens no more. Needs a program and cohort. False while onboarding is unfinished, so it resumes at the first unanswered step (UC-01 A8).',
  })
  @IsBoolean()
  @ValidateBy({
    name: 'finishedNeedsProgram',
    validator: {
      validate: (finished, args) => finished !== true || (args?.object as OnboardingDto).program !== null,
      defaultMessage: () => 'finished needs a program and cohort',
    },
  })
  finished!: boolean;
}
