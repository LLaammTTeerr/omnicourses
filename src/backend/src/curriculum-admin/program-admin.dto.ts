import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Matches, Max, Min } from 'class-validator';
import { ifPresent, ifSet, MaxCodePoints, NoNullCharacter, trimString } from '../common/field-validators.js';
import { TRAINING_TYPES, type TrainingType } from '../curriculum/program.entity.js';
import { ADMIN_CODE_MAX_LENGTH, ADMIN_CODE_MESSAGE, ADMIN_CODE_PATTERN, canonicalAdminCode } from './admin-code.js';

// Request and response shapes of the F12 program and cohort routes (ADR 0011, "Programs and
// cohorts as built"). Requests go through StrictBody, so a field that is not declared here is a
// 400, never ignored. That is how these are refused:
// - an identifier in a PATCH: a program's code; a cohort's programId, cohortYear and code;
// - the gated cohort total, totalCreditsMin, in a POST or a PATCH;
// - a program's trainingType, which sets the credit caps (ADR 0012): no decision says who may
//   enter it through F12, so no route accepts it and a new program stores none.

/** The bounds of ck_curriculums_cohort_year_range (migration 1792912952302). */
export const COHORT_YEAR_MIN = 2000;
export const COHORT_YEAR_MAX = 2100;

const canonicalCode = Transform(({ value }) => canonicalAdminCode(value));
const CODE_PATTERN = ADMIN_CODE_PATTERN.source;

// ---- Programs ------------------------------------------------------------------------------

export class CreateProgramDto {
  @ApiProperty({
    example: 'ZZ-PROG',
    maxLength: ADMIN_CODE_MAX_LENGTH,
    pattern: CODE_PATTERN,
    description: 'Trimmed and upper-cased, then checked. Unique among programs. Cannot change later: the read API and the onboarding answers name a program by it.',
  })
  @canonicalCode
  @IsString()
  @MaxCodePoints(ADMIN_CODE_MAX_LENGTH)
  @Matches(ADMIN_CODE_PATTERN, { message: ADMIN_CODE_MESSAGE })
  code!: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @NoNullCharacter
  @IsNotEmpty()
  @MaxCodePoints(255)
  nameVi!: string;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: 255, description: 'Blank is stored as null' })
  @Transform(trimString)
  @ifSet
  @IsString()
  @NoNullCharacter
  @MaxCodePoints(255)
  nameEn?: string | null;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: 100, description: 'The faculty that owns the program, as text. It is not a permission boundary (ADR 0011). Blank is stored as null.' })
  @Transform(trimString)
  @ifSet
  @IsString()
  @NoNullCharacter
  @MaxCodePoints(100)
  faculty?: string | null;
}

/** The editable program fields. The code and the training type are not among them (ADR 0011). */
export const PROGRAM_FIELDS = ['nameVi', 'nameEn', 'faculty'] as const;

export class UpdateProgramDto {
  @ApiProperty({ required: false, maxLength: 255 })
  @ifPresent
  @Transform(trimString)
  @IsString()
  @NoNullCharacter
  @IsNotEmpty()
  @MaxCodePoints(255)
  nameVi?: string;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: 255 })
  @Transform(trimString)
  @ifSet
  @IsString()
  @NoNullCharacter
  @MaxCodePoints(255)
  nameEn?: string | null;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: 100 })
  @Transform(trimString)
  @ifSet
  @IsString()
  @NoNullCharacter
  @MaxCodePoints(100)
  faculty?: string | null;
}

export class ProgramDetailsDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'APCS' })
  code!: string;

  @ApiProperty()
  nameVi!: string;

  @ApiProperty({ type: String, nullable: true })
  nameEn!: string | null;

  @ApiProperty({ type: String, nullable: true })
  faculty!: string | null;

  @ApiProperty({ enum: TRAINING_TYPES, nullable: true, description: 'Read-only here: no F12 route sets it. null: not recorded, so the rule engine checks no credit cap (ADR 0013).' })
  trainingType!: TrainingType | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

// ---- Cohorts (curriculums rows) ------------------------------------------------------------

export class CreateCohortDto {
  @ApiProperty({ type: 'integer', example: 2026, minimum: COHORT_YEAR_MIN, maximum: COHORT_YEAR_MAX, description: 'The year the cohort entered the program. One cohort per program and year. Cannot change later.' })
  @IsInt()
  @Min(COHORT_YEAR_MIN)
  @Max(COHORT_YEAR_MAX)
  cohortYear!: number;

  @ApiProperty({
    example: 'ZZ-PROG-2026',
    maxLength: ADMIN_CODE_MAX_LENGTH,
    pattern: CODE_PATTERN,
    description: "The curriculum's code. Trimmed and upper-cased, then checked. Unique among all curricula. Cannot change later.",
  })
  @canonicalCode
  @IsString()
  @MaxCodePoints(ADMIN_CODE_MAX_LENGTH)
  @Matches(ADMIN_CODE_PATTERN, { message: ADMIN_CODE_MESSAGE })
  code!: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @NoNullCharacter
  @IsNotEmpty()
  @MaxCodePoints(255)
  nameVi!: string;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: 255, description: 'Blank is stored as null' })
  @Transform(trimString)
  @ifSet
  @IsString()
  @NoNullCharacter
  @MaxCodePoints(255)
  nameEn?: string | null;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: 10, example: 'en', description: 'Language of instruction, as text. Blank is stored as null.' })
  @Transform(trimString)
  @ifSet
  @IsString()
  @NoNullCharacter
  @MaxCodePoints(10)
  language?: string | null;
}

/** The editable cohort fields. The program, the year, the code and the credit total are not among them (ADR 0011). */
export const COHORT_FIELDS = ['nameVi', 'nameEn', 'language'] as const;

export class UpdateCohortDto {
  @ApiProperty({ required: false, maxLength: 255 })
  @ifPresent
  @Transform(trimString)
  @IsString()
  @NoNullCharacter
  @IsNotEmpty()
  @MaxCodePoints(255)
  nameVi?: string;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: 255 })
  @Transform(trimString)
  @ifSet
  @IsString()
  @NoNullCharacter
  @MaxCodePoints(255)
  nameEn?: string | null;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: 10 })
  @Transform(trimString)
  @ifSet
  @IsString()
  @NoNullCharacter
  @MaxCodePoints(10)
  language?: string | null;
}

export class CohortDetailsDto {
  @ApiProperty({ format: 'uuid', description: 'The curriculum ID: the :curriculumId of the cohort routes' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  programId!: string;

  @ApiProperty({ type: 'integer', example: 2024 })
  cohortYear!: number;

  @ApiProperty({ example: 'APCS2024' })
  code!: string;

  @ApiProperty()
  nameVi!: string;

  @ApiProperty({ type: String, nullable: true })
  nameEn!: string | null;

  @ApiProperty({ type: String, nullable: true })
  language!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Read-only here until the rule-engine handoff (ADR 0011). null for a cohort created through F12.' })
  totalCreditsMin!: number | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class CohortListDto {
  @ApiProperty({ type: [CohortDetailsDto], description: "The program's cohorts, oldest first" })
  cohorts!: CohortDetailsDto[];
}
