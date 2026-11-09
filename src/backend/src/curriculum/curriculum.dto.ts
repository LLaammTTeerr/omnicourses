import { ApiProperty } from '@nestjs/swagger';
import { TRAINING_TYPES, type TrainingType } from './program.entity.js';
import { REQUIREMENT_GROUP_KINDS, type RequirementGroupKind } from './requirement-group.entity.js';

// Read shapes of the curriculum (F4, ADR 0005). They carry only what the database stores:
// prerequisites and offering terms are null until F12 records them for a course of a
// curriculum (ADR 0011, amended 9 November 2026), so no field claims a course has none.

/** A program without its cohorts. */
export class ProgramSummaryDto {
  @ApiProperty({ example: 'APCS' })
  code!: string;

  @ApiProperty({ example: 'Cử nhân ngành Khoa học máy tính - Chương trình Tiên tiến' })
  nameVi!: string;

  @ApiProperty({ type: String, nullable: true })
  nameEn!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'The faculty that owns the program' })
  faculty!: string | null;

  @ApiProperty({
    enum: TRAINING_TYPES,
    nullable: true,
    description:
      'Training type (QĐ 1175/QĐ-KHTN Điều 6.4, 7.2; ADR 0012): advanced = Tiên tiến, joint = Liên kết, high_quality = Chất lượng cao, standard = đại trà. It sets the terms and the credit caps. null: not recorded.',
  })
  trainingType!: TrainingType | null;
}

export class ProgramDto extends ProgramSummaryDto {
  @ApiProperty({ type: [Number], example: [2024, 2025], description: 'The cohorts that have a curriculum, oldest first' })
  cohortYears!: number[];
}

export class ProgramListDto {
  @ApiProperty({ type: [ProgramDto], description: 'Every program, by code' })
  programs!: ProgramDto[];
}

/** A course of the shared catalog. */
export class CourseDto {
  @ApiProperty({ example: 'CSC10001', pattern: '^[A-Z0-9]{2,20}$' })
  code!: string;

  @ApiProperty({ example: 'Nhập môn lập trình' })
  nameVi!: string;

  @ApiProperty({ type: String, nullable: true })
  nameEn!: string | null;

  @ApiProperty({ example: 4 })
  credits!: number;

  @ApiProperty({ type: Number, nullable: true, description: 'Theory periods ("LT"); null where the official table leaves the cell blank' })
  theoryPeriods!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Lab periods ("TH")' })
  labPeriods!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Exercise periods ("BT")' })
  exercisePeriods!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Project periods ("ĐT")' })
  projectPeriods!: number | null;
}

/** A course as one curriculum uses it: the catalog fields plus that curriculum's rules. */
export class CurriculumCourseDto extends CourseDto {
  @ApiProperty({
    type: [String],
    nullable: true,
    example: ['CSC10001'],
    description:
      'Codes of the courses that must all be passed first, in this curriculum. null: not recorded (unknown, not "none"). []: recorded as having no prerequisite.',
  })
  prerequisites!: string[] | null;

  @ApiProperty({
    type: [Number],
    nullable: true,
    example: [1, 3],
    description: 'Term numbers (1, 2, 3; ADR 0009, ADR 0012) the course is offered in, in this curriculum. null: not recorded. Never empty.',
  })
  offeringTerms!: number[] | null;
}

export class RequirementGroupDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Kiến thức Math', description: 'The heading as printed in the official curriculum' })
  name!: string;

  @ApiProperty({ enum: REQUIREMENT_GROUP_KINDS, description: 'compulsory: every course must be passed. elective: the student chooses courses up to creditsTotalMin.' })
  kind!: RequirementGroupKind;

  @ApiProperty({ type: Number, nullable: true, description: 'Credits of a compulsory group' })
  creditsTotal!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Minimum credits of an elective group. null when the printed rule is not a minimum on this group alone; officialNotes then states it.',
  })
  creditsTotalMin!: number | null;

  @ApiProperty({ type: String, nullable: true, description: 'The printed rule text, for rules the columns cannot express' })
  officialNotes!: string | null;

  @ApiProperty({ type: [CurriculumCourseDto], description: 'The courses linked to the group, by code' })
  courses!: CurriculumCourseDto[];
}

/** The curriculum one cohort of one program follows. */
export class CurriculumDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'APCS2024' })
  code!: string;

  @ApiProperty({ type: ProgramSummaryDto })
  program!: ProgramSummaryDto;

  @ApiProperty({ example: 2024, description: 'The year the cohort entered the program' })
  cohortYear!: number;

  @ApiProperty()
  nameVi!: string;

  @ApiProperty({ type: String, nullable: true })
  nameEn!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'en', description: 'Language of instruction' })
  language!: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 163, description: 'Credits the cohort needs to graduate, as printed' })
  totalCreditsMin!: number | null;

  @ApiProperty({
    type: [RequirementGroupDto],
    description: 'Every requirement group, by name (the schema stores no printed order). A course may sit in several groups.',
  })
  requirementGroups!: RequirementGroupDto[];
}

/** One requirement group a course belongs to, in some curriculum. */
export class CourseMembershipDto {
  @ApiProperty({ example: 'APCS' })
  programCode!: string;

  @ApiProperty({ example: 2024 })
  cohortYear!: number;

  @ApiProperty({ example: 'APCS2024' })
  curriculumCode!: string;

  @ApiProperty({ format: 'uuid' })
  requirementGroupId!: string;

  @ApiProperty({ example: 'Kiến thức Math' })
  requirementGroupName!: string;

  @ApiProperty({ enum: REQUIREMENT_GROUP_KINDS })
  kind!: RequirementGroupKind;
}

/** A catalog course and every requirement group that links to it (the course drawer). */
export class CourseDetailDto extends CourseDto {
  @ApiProperty({ type: [CourseMembershipDto], description: 'By program code, cohort year, then group name' })
  memberships!: CourseMembershipDto[];
}
