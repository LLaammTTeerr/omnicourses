import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, buildMessage, IsArray, IsIn, IsInt, IsNotEmpty, IsString, Min, ValidateBy } from 'class-validator';
import { ifPresent, ifSet, MaxCodePoints, NoNullCharacter, NullableTextField, RequiredTextField } from '../common/field-validators.js';
import { REQUIREMENT_GROUP_KINDS, type RequirementGroupKind } from '../curriculum/curriculum-rules.js';
import { TERM_NUMBERS } from '../terms/term.js';
import { GLOBAL_PERMISSIONS, type GlobalPermission } from '../admin-access/admin-grant.entities.js';
import { NAME_MAX_LENGTH } from '../common/column-limits.js';

const MAX_PREREQUISITES = 50;
export const OFFICIAL_NOTES_MAX_LENGTH = 2000;
export const CONFIRM_IMPACT_MAX_LENGTH = 128;

class AdminCurriculumDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'APCS2024' })
  code!: string;

  @ApiProperty({ example: 2024 })
  cohortYear!: number;
}

export class AdminProgramDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'APCS' })
  code!: string;

  @ApiProperty()
  nameVi!: string;

  @ApiProperty({ type: [AdminCurriculumDto], description: 'Its cohorts, oldest first' })
  curricula!: AdminCurriculumDto[];
}

export class AdminProgramListDto {
  @ApiProperty({ type: [AdminProgramDto], description: 'The programs the caller holds a program-administrator grant for, by code' })
  programs!: AdminProgramDto[];
}

export class CreateRequirementGroupDto {
  @RequiredTextField({ example: 'Kiến thức Math', maxLength: NAME_MAX_LENGTH, description: 'The heading as printed; unique within the curriculum' })
  name!: string;

  @ApiProperty({ enum: REQUIREMENT_GROUP_KINDS })
  @IsIn(REQUIREMENT_GROUP_KINDS)
  kind!: RequirementGroupKind;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: OFFICIAL_NOTES_MAX_LENGTH, description: 'The printed rule text' })
  @ifSet
  @IsString()
  @NoNullCharacter
  @MaxCodePoints(OFFICIAL_NOTES_MAX_LENGTH)
  officialNotes?: string | null;
}

export class UpdateRequirementGroupDto {
  @ifPresent
  @RequiredTextField({ required: false, maxLength: NAME_MAX_LENGTH })
  name?: string;

  @ApiProperty({ enum: REQUIREMENT_GROUP_KINDS, required: false, description: 'Refused while the group stores a credit total' })
  @ifPresent
  @IsIn(REQUIREMENT_GROUP_KINDS)
  kind?: RequirementGroupKind;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: OFFICIAL_NOTES_MAX_LENGTH })
  @ifSet
  @IsString()
  @NoNullCharacter
  @MaxCodePoints(OFFICIAL_NOTES_MAX_LENGTH)
  officialNotes?: string | null;
}

export class RequirementGroupAdminDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  curriculumId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: REQUIREMENT_GROUP_KINDS })
  kind!: RequirementGroupKind;

  @ApiProperty({ type: String, nullable: true })
  officialNotes!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Read-only here until the rule-engine handoff (ADR 0011)' })
  creditsTotal!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Read-only here until the rule-engine handoff (ADR 0011)' })
  creditsTotalMin!: number | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class SetPrerequisitesDto {
  @ApiProperty({
    type: [String],
    example: ['CSC10001'],
    description: 'Every course that must be passed first; [] records "none". Codes are trimmed and upper-cased, then must be courses of this curriculum.',
  })
  @IsArray()
  @ArrayMaxSize(MAX_PREREQUISITES)
  @IsString({ each: true })
  prerequisites!: string[];
}

export class PrerequisitesDto {
  @ApiProperty({ example: 'CSC10002' })
  courseCode!: string;

  @ApiProperty({ type: [String], nullable: true, description: 'Sorted; null once cleared (not recorded)' })
  prerequisites!: string[] | null;
}

export class SetOfferingTermsDto {
  @ApiProperty({ type: [Number], example: [1, 3], description: 'Term numbers 1, 2 or 3 (ADR 0009, ADR 0012); at least one, no repeats' })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @IsIn(TERM_NUMBERS, { each: true })
  terms!: number[];
}

export class OfferingTermsDto {
  @ApiProperty({ example: 'CSC10002' })
  courseCode!: string;

  @ApiProperty({ type: [Number], nullable: true, description: 'Ascending; null once cleared (not recorded)' })
  terms!: number[] | null;
}

export const MAX_INTEGER = 2_147_483_647;

const StorableInteger = () =>
  ValidateBy({
    name: 'storableInteger',
    validator: {
      validate: (value: unknown) => !Number.isInteger(value) || (value as number) <= MAX_INTEGER,
      defaultMessage: buildMessage((eachPrefix) => `${eachPrefix}$property must not be greater than ${MAX_INTEGER}`),
    },
  });

export const wholeNumberOrText = (text: string): number | string => (/^[0-9]+$/.test(text) ? Number(text) : text);

export class CreateCourseDto {
  @ApiProperty({ example: 'CSC10001', description: 'Trimmed and upper-cased, then ^[A-Z0-9]{2,20}$. Cannot change later.' })
  @IsString()
  code!: string;

  @RequiredTextField({ maxLength: NAME_MAX_LENGTH })
  nameVi!: string;

  @NullableTextField({ maxLength: NAME_MAX_LENGTH })
  nameEn?: string | null;

  @ApiProperty({ minimum: 1, maximum: MAX_INTEGER })
  @IsInt()
  @Min(1)
  @StorableInteger()
  credits!: number;

  @ApiProperty({ type: Number, nullable: true, required: false, minimum: 0, maximum: MAX_INTEGER, description: 'Theory periods ("LT")' })
  @ifSet
  @IsInt()
  @Min(0)
  @StorableInteger()
  theoryPeriods?: number | null;

  @ApiProperty({ type: Number, nullable: true, required: false, minimum: 0, maximum: MAX_INTEGER, description: 'Lab periods ("TH")' })
  @ifSet
  @IsInt()
  @Min(0)
  @StorableInteger()
  labPeriods?: number | null;

  @ApiProperty({ type: Number, nullable: true, required: false, minimum: 0, maximum: MAX_INTEGER, description: 'Exercise periods ("BT")' })
  @ifSet
  @IsInt()
  @Min(0)
  @StorableInteger()
  exercisePeriods?: number | null;

  @ApiProperty({ type: Number, nullable: true, required: false, minimum: 0, maximum: MAX_INTEGER, description: 'Project periods ("ĐT")' })
  @ifSet
  @IsInt()
  @Min(0)
  @StorableInteger()
  projectPeriods?: number | null;
}

export const COURSE_FIELDS = ['nameVi', 'nameEn', 'credits', 'theoryPeriods', 'labPeriods', 'exercisePeriods', 'projectPeriods'] as const;
export type CourseField = (typeof COURSE_FIELDS)[number];

export class UpdateCourseDto {
  @ifPresent
  @RequiredTextField({ required: false, maxLength: NAME_MAX_LENGTH })
  nameVi?: string;

  @NullableTextField({ maxLength: NAME_MAX_LENGTH })
  nameEn?: string | null;

  @ApiProperty({ required: false, minimum: 1, maximum: MAX_INTEGER })
  @ifPresent
  @IsInt()
  @Min(1)
  @StorableInteger()
  credits?: number;

  @ApiProperty({ type: Number, nullable: true, required: false, minimum: 0, maximum: MAX_INTEGER })
  @ifSet
  @IsInt()
  @Min(0)
  @StorableInteger()
  theoryPeriods?: number | null;

  @ApiProperty({ type: Number, nullable: true, required: false, minimum: 0, maximum: MAX_INTEGER })
  @ifSet
  @IsInt()
  @Min(0)
  @StorableInteger()
  labPeriods?: number | null;

  @ApiProperty({ type: Number, nullable: true, required: false, minimum: 0, maximum: MAX_INTEGER })
  @ifSet
  @IsInt()
  @Min(0)
  @StorableInteger()
  exercisePeriods?: number | null;

  @ApiProperty({ type: Number, nullable: true, required: false, minimum: 0, maximum: MAX_INTEGER })
  @ifSet
  @IsInt()
  @Min(0)
  @StorableInteger()
  projectPeriods?: number | null;

  @ApiProperty({
    required: false,
    maxLength: CONFIRM_IMPACT_MAX_LENGTH,
    description:
      'The reviewVersion of a 409 impact_confirmation_required answer: confirms the change for exactly the curricula it listed. Needed whenever the course is linked to a curriculum.',
  })
  @ifPresent
  @IsString()
  @IsNotEmpty()
  @MaxCodePoints(CONFIRM_IMPACT_MAX_LENGTH)
  confirmImpact?: string;
}

export class AccessProgramDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'APCS' })
  code!: string;

  @ApiProperty()
  nameVi!: string;
}

export class AccessProgramListDto {
  @ApiProperty({ type: [AccessProgramDto], description: 'Every program, by code, to choose a program grant from' })
  programs!: AccessProgramDto[];
}

class ProgramGrantDto {
  @ApiProperty({ format: 'uuid' })
  programId!: string;

  @ApiProperty({ example: 'APCS' })
  programCode!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  grantedAt!: Date;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Who granted it; null for the bootstrap or a purged account' })
  grantedBy!: string | null;
}

class GlobalGrantDto {
  @ApiProperty({ enum: GLOBAL_PERMISSIONS })
  permission!: GlobalPermission;

  @ApiProperty({ type: String, format: 'date-time' })
  grantedAt!: Date;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  grantedBy!: string | null;
}

export class UserGrantsDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ type: [ProgramGrantDto], description: 'By program code' })
  programs!: ProgramGrantDto[];

  @ApiProperty({ type: [GlobalGrantDto], description: 'By permission' })
  permissions!: GlobalGrantDto[];
}
