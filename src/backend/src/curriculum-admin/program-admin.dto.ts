import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsString, Matches, Max, Min } from 'class-validator';
import { ifPresent, ifSet, MaxCodePoints, NullableTextField, RequiredTextField } from '../common/field-validators.js';
import { LANGUAGE_MAX_LENGTH } from '../curriculum/curriculum.entity.js';
import { TRAINING_TYPES, type TrainingType } from '../curriculum/curriculum-rules.js';
import { FACULTY_MAX_LENGTH } from '../curriculum/program.entity.js';
import { MAX_ACADEMIC_YEAR, MIN_ACADEMIC_YEAR } from '../terms/term.js';
import { CODE_MAX_LENGTH, NAME_MAX_LENGTH } from '../common/column-limits.js';
import { CreditTotalField } from './curriculum-admin.dto.js';

export const ADMIN_CODE_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const ADMIN_CODE_MESSAGE = 'code must be letters A-Z and digits, in parts joined by single hyphens (for example ZZ-PROG-2024)';

export const canonicalAdminCode = (input: unknown): unknown => (typeof input === 'string' ? input.trim().toUpperCase() : input);

const canonicalCode = Transform(({ value }) => canonicalAdminCode(value));
const CODE_PATTERN = ADMIN_CODE_PATTERN.source;

export class CreateProgramDto {
  @ApiProperty({
    example: 'ZZ-PROG',
    maxLength: CODE_MAX_LENGTH,
    pattern: CODE_PATTERN,
    description: 'Trimmed and upper-cased, then checked. Unique among programs. Cannot change later: the read API and the onboarding answers name a program by it.',
  })
  @canonicalCode
  @IsString()
  @MaxCodePoints(CODE_MAX_LENGTH)
  @Matches(ADMIN_CODE_PATTERN, { message: ADMIN_CODE_MESSAGE })
  code!: string;

  @RequiredTextField({ maxLength: NAME_MAX_LENGTH })
  nameVi!: string;

  @NullableTextField({ maxLength: NAME_MAX_LENGTH, description: 'Blank is stored as null' })
  nameEn?: string | null;

  @NullableTextField({ maxLength: FACULTY_MAX_LENGTH, description: 'The faculty that owns the program, as text. It is not a permission boundary (ADR 0011). Blank is stored as null.' })
  faculty?: string | null;

  @ApiProperty({
    enum: TRAINING_TYPES,
    nullable: true,
    required: false,
    description: 'Sets the credit caps and the kind of term 3 (ADR 0012). Set once, on creation (Lâm, 28 November 2026); no route changes it later. Left out or null: not recorded, so the rule engine checks no credit cap.',
  })
  @ifSet
  @IsIn(TRAINING_TYPES)
  trainingType?: TrainingType | null;
}

export const PROGRAM_FIELDS = ['nameVi', 'nameEn', 'faculty'] as const;

export class UpdateProgramDto {
  @ifPresent
  @RequiredTextField({ required: false, maxLength: NAME_MAX_LENGTH })
  nameVi?: string;

  @NullableTextField({ maxLength: NAME_MAX_LENGTH })
  nameEn?: string | null;

  @NullableTextField({ maxLength: FACULTY_MAX_LENGTH })
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

  @ApiProperty({ enum: TRAINING_TYPES, nullable: true, description: 'Set only when the program is created. null: not recorded, so the rule engine checks no credit cap (ADR 0013).' })
  trainingType!: TrainingType | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class CreateCohortDto {
  @ApiProperty({ type: 'integer', example: 2026, minimum: MIN_ACADEMIC_YEAR, maximum: MAX_ACADEMIC_YEAR, description: 'The year the cohort entered the program. One cohort per program and year. Cannot change later.' })
  @IsInt()
  @Min(MIN_ACADEMIC_YEAR)
  @Max(MAX_ACADEMIC_YEAR)
  cohortYear!: number;

  @ApiProperty({
    example: 'ZZ-PROG-2026',
    maxLength: CODE_MAX_LENGTH,
    pattern: CODE_PATTERN,
    description: "The curriculum's code. Trimmed and upper-cased, then checked. Unique among all curricula. Cannot change later.",
  })
  @canonicalCode
  @IsString()
  @MaxCodePoints(CODE_MAX_LENGTH)
  @Matches(ADMIN_CODE_PATTERN, { message: ADMIN_CODE_MESSAGE })
  code!: string;

  @RequiredTextField({ maxLength: NAME_MAX_LENGTH })
  nameVi!: string;

  @NullableTextField({ maxLength: NAME_MAX_LENGTH, description: 'Blank is stored as null' })
  nameEn?: string | null;

  @NullableTextField({ maxLength: LANGUAGE_MAX_LENGTH, example: 'en', description: 'Language of instruction, as text. Blank is stored as null.' })
  language?: string | null;

  @CreditTotalField('The minimum credits the cohort needs to graduate. null: not recorded, so the audit checks no cohort total (ADR 0013).')
  totalCreditsMin?: number | null;
}

export const COHORT_FIELDS = ['nameVi', 'nameEn', 'language', 'totalCreditsMin'] as const;

export class UpdateCohortDto {
  @ifPresent
  @RequiredTextField({ required: false, maxLength: NAME_MAX_LENGTH })
  nameVi?: string;

  @NullableTextField({ maxLength: NAME_MAX_LENGTH })
  nameEn?: string | null;

  @NullableTextField({ maxLength: LANGUAGE_MAX_LENGTH })
  language?: string | null;

  @CreditTotalField('The minimum credits the cohort needs to graduate. null: not recorded, so the audit checks no cohort total (ADR 0013).')
  totalCreditsMin?: number | null;
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

  @ApiProperty({ type: Number, nullable: true, description: 'null: not recorded' })
  totalCreditsMin!: number | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class CohortListDto {
  @ApiProperty({ type: [CohortDetailsDto], description: "The program's cohorts, oldest first" })
  cohorts!: CohortDetailsDto[];
}
