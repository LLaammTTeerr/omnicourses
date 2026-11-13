import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsIn, IsInt, IsNotEmpty, IsString, MaxLength, Min, ValidateIf } from 'class-validator';
import { trimString } from '../common/transforms.js';
import { REQUIREMENT_GROUP_KINDS, type RequirementGroupKind } from '../curriculum/requirement-group.entity.js';
import { TERM_NUMBERS } from '../terms/term.js';
import { GLOBAL_PERMISSIONS, type GlobalPermission } from './admin-grant.entities.js';

// Request and response shapes of F12 (ADR 0011). Requests go through StrictBody: a field not
// declared here (an identifier, a parent, a gated credit total) is a 400, never ignored.

/** Present: validated. Absent: left as it is. */
const ifPresent = ValidateIf((_: object, value: unknown) => value !== undefined);
/** Present and not null: validated. null clears the column. */
const ifSet = ValidateIf((_: object, value: unknown) => value !== undefined && value !== null);

// ---- Programs the caller administers -------------------------------------------------------

export class AdminCurriculumDto {
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

// ---- Requirement groups --------------------------------------------------------------------

export class CreateRequirementGroupDto {
  @ApiProperty({ example: 'Kiến thức Math', maxLength: 255, description: 'The heading as printed; unique within the curriculum' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ enum: REQUIREMENT_GROUP_KINDS })
  @IsIn(REQUIREMENT_GROUP_KINDS)
  kind!: RequirementGroupKind;

  @ApiProperty({ type: String, nullable: true, required: false, description: 'The printed rule text' })
  @ifSet
  @IsString()
  officialNotes?: string | null;
}

export class UpdateRequirementGroupDto {
  @ApiProperty({ required: false, maxLength: 255 })
  @ifPresent
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiProperty({ enum: REQUIREMENT_GROUP_KINDS, required: false, description: 'Refused while the group stores a credit total' })
  @ifPresent
  @IsIn(REQUIREMENT_GROUP_KINDS)
  kind?: RequirementGroupKind;

  @ApiProperty({ type: String, nullable: true, required: false })
  @ifSet
  @IsString()
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

// ---- Prerequisites and offering terms ------------------------------------------------------

export class SetPrerequisitesDto {
  @ApiProperty({
    type: [String],
    example: ['CSC10001'],
    description: 'Every course that must be passed first; [] records "none". Codes are trimmed and upper-cased, then must be courses of this curriculum.',
  })
  @IsArray()
  @ArrayMaxSize(50)
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

// ---- Catalog courses -----------------------------------------------------------------------

export class CreateCourseDto {
  @ApiProperty({ example: 'CSC10001', description: 'Trimmed and upper-cased, then ^[A-Z0-9]{2,20}$. Cannot change later.' })
  @IsString()
  code!: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nameVi!: string;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: 255 })
  @Transform(trimString)
  @ifSet
  @IsString()
  @MaxLength(255)
  nameEn?: string | null;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  credits!: number;

  @ApiProperty({ type: Number, nullable: true, required: false, minimum: 0, description: 'Theory periods ("LT")' })
  @ifSet
  @IsInt()
  @Min(0)
  theoryPeriods?: number | null;

  @ApiProperty({ type: Number, nullable: true, required: false, minimum: 0, description: 'Lab periods ("TH")' })
  @ifSet
  @IsInt()
  @Min(0)
  labPeriods?: number | null;

  @ApiProperty({ type: Number, nullable: true, required: false, minimum: 0, description: 'Exercise periods ("BT")' })
  @ifSet
  @IsInt()
  @Min(0)
  exercisePeriods?: number | null;

  @ApiProperty({ type: Number, nullable: true, required: false, minimum: 0, description: 'Project periods ("ĐT")' })
  @ifSet
  @IsInt()
  @Min(0)
  projectPeriods?: number | null;
}

/** The editable course fields. The code is not one of them (ADR 0011). */
export const COURSE_FIELDS = ['nameVi', 'nameEn', 'credits', 'theoryPeriods', 'labPeriods', 'exercisePeriods', 'projectPeriods'] as const;
export type CourseField = (typeof COURSE_FIELDS)[number];

export class UpdateCourseDto {
  @ApiProperty({ required: false, maxLength: 255 })
  @ifPresent
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nameVi?: string;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: 255 })
  @Transform(trimString)
  @ifSet
  @IsString()
  @MaxLength(255)
  nameEn?: string | null;

  @ApiProperty({ required: false, minimum: 1 })
  @ifPresent
  @IsInt()
  @Min(1)
  credits?: number;

  @ApiProperty({ type: Number, nullable: true, required: false, minimum: 0 })
  @ifSet
  @IsInt()
  @Min(0)
  theoryPeriods?: number | null;

  @ApiProperty({ type: Number, nullable: true, required: false, minimum: 0 })
  @ifSet
  @IsInt()
  @Min(0)
  labPeriods?: number | null;

  @ApiProperty({ type: Number, nullable: true, required: false, minimum: 0 })
  @ifSet
  @IsInt()
  @Min(0)
  exercisePeriods?: number | null;

  @ApiProperty({ type: Number, nullable: true, required: false, minimum: 0 })
  @ifSet
  @IsInt()
  @Min(0)
  projectPeriods?: number | null;

  @ApiProperty({
    required: false,
    description:
      'The reviewVersion of a 409 impact_confirmation_required answer: confirms the change for exactly the curricula it listed. Needed whenever the course is linked to a curriculum.',
  })
  @ifPresent
  @IsString()
  @IsNotEmpty()
  confirmImpact?: string;
}

// ---- Access management ---------------------------------------------------------------------

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

export class ProgramGrantDto {
  @ApiProperty({ format: 'uuid' })
  programId!: string;

  @ApiProperty({ example: 'APCS' })
  programCode!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  grantedAt!: Date;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Who granted it; null for the bootstrap or a purged account' })
  grantedBy!: string | null;
}

export class GlobalGrantDto {
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
