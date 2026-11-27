import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, Max, Min, ValidateIf } from 'class-validator';
import { TRAINING_TYPES, type TrainingType } from '../curriculum/program.entity.js';
import { REQUIREMENT_GROUP_KINDS, type RequirementGroupKind } from '../curriculum/requirement-group.entity.js';
import {
  AUDIT_UNAVAILABLE_CODES,
  AUDIT_WARNING_CODES,
  CONDITION_STATUSES,
  COURSE_STATUSES,
  GRADUATION_STATUSES,
  type GraduationVerdict,
  type AuditWarning,
  type AuditWarningCode,
  type CombinedMinimumCoverage,
  type ConditionStatus,
  type CourseCoverage,
  type CourseStatus,
  type CreditSummary,
  type DegreeAudit,
  type GpaSummary,
  type GraduationCondition,
  type GraduationStatus,
  type GroupCoverage,
  type TermAttempt,
  type TermSummary,
  type UnmatchedCourse,
} from '../rules/types.js';
import { CAP_RULES, TERM_KINDS, type CapRule, type CapViolation, type CreditCaps, type TermKind } from '../rules/credit-caps.js';
import { CLASSIFICATIONS, type Classification, YEAR_LEVELS } from '../rules/grades.js';
import { TermDto } from '../common/field-validators.js';
import { MAX_ACADEMIC_YEAR, MIN_ACADEMIC_YEAR, TERM_NUMBERS, type TermNumber } from '../terms/term.js';
import { TRANSCRIPT_RESULTS, type TranscriptResult } from '../transcript/transcript-entry.js';

const asOfSent = (query: AuditQueryDto) => query.asOfYear !== undefined || query.asOfNumber !== undefined;

export class AuditQueryDto {
  @ApiProperty({
    required: false,
    type: 'integer',
    example: 2025,
    description: 'With asOfNumber: the audit as it stood at the end of this term (UC-03 A2), from the transcript rows up to that term. ADR 0009: 2025 is 2025–2026. Send both or neither.',
  })
  @ValidateIf(asOfSent)
  @Type(() => Number)
  @IsInt()
  @Min(MIN_ACADEMIC_YEAR)
  @Max(MAX_ACADEMIC_YEAR)
  asOfYear?: number;

  @ApiProperty({ required: false, type: Number, enum: TERM_NUMBERS, example: 1, description: 'With asOfYear: the term of that academic year, 1, 2 or 3' })
  @ValidateIf(asOfSent)
  @Type(() => Number)
  @IsIn(TERM_NUMBERS)
  asOfNumber?: TermNumber;
}

class CourseCoverageDto implements CourseCoverage {
  @ApiProperty({ example: 'CS160' })
  code!: string;

  @ApiProperty({ example: 'Nhập môn Tin học' })
  nameVi!: string;

  @ApiProperty({ type: String, nullable: true })
  nameEn!: string | null;

  @ApiProperty({ example: 4, description: 'Catalog credits' })
  credits!: number;

  @ApiProperty({ description: 'false: required, but outside the cohort total (GDTC, GDQP-AN)' })
  countsTowardTotal!: boolean;

  @ApiProperty({ description: 'false: left out of the GPA (QĐ 1175/QĐ-KHTN Điều 15.1.c)' })
  countsTowardGpa!: boolean;

  @ApiProperty({
    enum: COURSE_STATUSES,
    description:
      'counted_in_other_group: the course is passed and counts in another group (a course counts once, ADR 0013). A failed or in-progress course keeps its own status in every group that lists it.',
  })
  status!: CourseStatus;

  @ApiProperty({ enum: TRANSCRIPT_RESULTS, nullable: true, description: 'The official attempt: the last completed one (Điều 14)' })
  result!: TranscriptResult | null;

  @ApiProperty({ type: Number, nullable: true, example: 8.5 })
  grade!: number | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'The group a passed or in-progress course counts its credits in, when that is another group' })
  countedInGroupId!: string | null;
}

class GroupCoverageDto implements GroupCoverage {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Kiến thức Math' })
  name!: string;

  @ApiProperty({ enum: REQUIREMENT_GROUP_KINDS })
  kind!: RequirementGroupKind;

  @ApiProperty({ type: Number, nullable: true, description: 'null: the group has no minimum of its own (see combinedMinimums)' })
  requiredCredits!: number | null;

  @ApiProperty({ description: 'Passed credits counted here toward the cohort total' })
  passedCredits!: number;

  @ApiProperty()
  inProgressCredits!: number;

  @ApiProperty({ description: "Credits another group's excess brings here" })
  overflowInCredits!: number;

  @ApiProperty({ description: 'Passed credits beyond requiredCredits, counted toward overflowToGroupId' })
  overflowOutCredits!: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  overflowToGroupId!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: 'requiredCredits − passed − overflowIn − inProgress, at least 0; 0 once met' })
  remainingCredits!: number | null;

  @ApiProperty({ description: 'Compulsory: every course passed. Elective: passed + overflowIn ≥ requiredCredits; true without one.' })
  met!: boolean;

  @ApiProperty({ type: [CourseCoverageDto], description: 'Every course of the group, by code' })
  courses!: CourseCoverageDto[];
}

class CombinedMinimumCoverageDto implements CombinedMinimumCoverage {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Kiến thức tự chọn' })
  name!: string;

  @ApiProperty({ example: 43 })
  creditsMin!: number;

  @ApiProperty({ type: String, nullable: true })
  officialNotes!: string | null;

  @ApiProperty({ type: [String], description: 'Ids of the requirement groups it adds up' })
  groupIds!: string[];

  @ApiProperty({ description: 'Passed credits of the groups together, overflow from outside them included' })
  credits!: number;

  @ApiProperty()
  inProgressCredits!: number;

  @ApiProperty()
  remainingCredits!: number;

  @ApiProperty()
  met!: boolean;
}

class UnmatchedCourseDto implements UnmatchedCourse {
  @ApiProperty({ example: 'ZZ101' })
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  credits!: number;

  @ApiProperty({ enum: TRANSCRIPT_RESULTS, nullable: true })
  result!: TranscriptResult | null;

  @ApiProperty({ type: Number, nullable: true })
  grade!: number | null;

  @ApiProperty()
  passed!: boolean;

  @ApiProperty()
  inProgress!: boolean;
}

class CreditSummaryDto implements CreditSummary {
  @ApiProperty({ description: 'Credits of every passed course of the curriculum, GDTC and GDQP-AN included (Điều 11.4)' })
  accumulated!: number;

  @ApiProperty({ description: 'Passed credits toward the cohort total' })
  towardTotal!: number;

  @ApiProperty()
  inProgressTowardTotal!: number;

  @ApiProperty({ type: Number, nullable: true, example: 163 })
  totalRequired!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  remaining!: number | null;

  @ApiProperty({ enum: YEAR_LEVELS, description: 'Year of study from the accumulated credits (Điều 15.3)' })
  yearLevel!: (typeof YEAR_LEVELS)[number];
}

class GpaSummaryDto implements GpaSummary {
  @ApiProperty({ type: Number, nullable: true, description: 'Điểm trung bình (Điều 15.1.a): every course studied, by its official grade, 10-point scale' })
  average!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Điểm trung bình tích lũy (Điều 15.1.b): passed courses only, 10-point scale' })
  accumulatedAverage!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'accumulatedAverage on the 4-point scale; reference only (Điều 11.2)' })
  accumulatedAverageFourPoint!: number | null;

  @ApiProperty({ enum: CLASSIFICATIONS, nullable: true, description: 'Điều 15.2.b, from accumulatedAverage' })
  classification!: Classification | null;

  @ApiProperty()
  gradedCredits!: number;
}

export class CreditCapsDto implements CreditCaps {
  @ApiProperty({ type: Number, nullable: true })
  min!: number | null;

  @ApiProperty()
  max!: number;
}

class CapViolationDto implements CapViolation {
  @ApiProperty({ enum: CAP_RULES })
  rule!: CapRule;

  @ApiProperty()
  credits!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty({ example: 'QĐ 1175/QĐ-KHTN Điều 7.2' })
  citation!: string;

  @ApiProperty({ description: 'The petition route; a violation never blocks' })
  petition!: string;
}

class TermAttemptDto implements TermAttempt {
  @ApiProperty({ example: 'CS160' })
  code!: string;

  @ApiProperty({ description: 'As the transcript names it' })
  name!: string;

  @ApiProperty({ description: 'As the transcript gives them; they add up to the term credits' })
  credits!: number;

  @ApiProperty({ enum: TRANSCRIPT_RESULTS })
  result!: TranscriptResult;

  @ApiProperty({ type: Number, nullable: true, example: 8.5 })
  grade!: number | null;

  @ApiProperty({ description: 'This sitting passed: a grade of 5.0 or more, exempt or pass (Điều 11.4, 13)' })
  passed!: boolean;

  @ApiProperty({ description: 'The sitting has no result yet' })
  inProgress!: boolean;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'The requirement group the course counts in; null when no group lists it' })
  requirementGroupId!: string | null;
}

class TermSummaryDto implements TermSummary {
  @ApiProperty({ type: TermDto })
  term!: TermDto;

  @ApiProperty({ enum: TERM_KINDS, nullable: true, description: 'null when the training type is not recorded' })
  kind!: TermKind | null;

  @ApiProperty({ description: 'Every course of the term, retakes included (Điều 7.1.b)' })
  credits!: number;

  @ApiProperty()
  passedCredits!: number;

  @ApiProperty({ type: Number, nullable: true, description: 'Term average, every graded attempt (Điều 15.1.a)' })
  average!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Term average of passed attempts (Điều 15.1.b)' })
  accumulatedAverage!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Điểm trung bình tích lũy from the start to the end of this term' })
  cumulativeAccumulatedAverage!: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 0.12,
    description: "cumulativeAccumulatedAverage minus the previous term's, in points of the 10-point scale; null for the first term or when either is null",
  })
  cumulativeAccumulatedAverageChange!: number | null;

  @ApiProperty({ description: 'CreditSummary.accumulated as it stood at the end of this term' })
  cumulativeAccumulatedCredits!: number;

  @ApiProperty({ description: 'CreditSummary.towardTotal as it stood at the end of this term' })
  cumulativeTowardTotal!: number;

  @ApiProperty({ type: [String] })
  failedCourseCodes!: string[];

  @ApiProperty({ type: [String] })
  inProgressCourseCodes!: string[];

  @ApiProperty({ type: CreditCapsDto, nullable: true })
  caps!: CreditCapsDto | null;

  @ApiProperty({ type: [CapViolationDto] })
  capViolations!: CapViolationDto[];

  @ApiProperty({ type: [TermAttemptDto], description: 'Every transcript row of the term, failed and retaken sittings included, by course code' })
  attempts!: TermAttemptDto[];
}

class GraduationConditionDto implements GraduationCondition {
  @ApiProperty({ example: 'total_credits' })
  id!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ example: 'QĐ 1175/QĐ-KHTN Điều 17.3.b' })
  citation!: string;

  @ApiProperty({ enum: CONDITION_STATUSES })
  status!: ConditionStatus;
}

class GraduationStatusDto implements GraduationStatus {
  @ApiProperty({ enum: GRADUATION_STATUSES, description: 'done: every condition the data can check is met; the notChecked ones still need the school' })
  status!: GraduationVerdict;

  @ApiProperty({ type: [GraduationConditionDto] })
  met!: GraduationConditionDto[];

  @ApiProperty({ type: [GraduationConditionDto] })
  unmet!: GraduationConditionDto[];

  @ApiProperty({ type: [GraduationConditionDto], description: 'Never assumed met' })
  notChecked!: GraduationConditionDto[];
}

class AuditWarningDto implements AuditWarning {
  @ApiProperty({ enum: AUDIT_WARNING_CODES })
  code!: AuditWarningCode;

  @ApiProperty()
  courseCode!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty({ type: [Number], nullable: true, description: 'credits_differ: the credits the transcript gives that differ from the curriculum; null for other codes' })
  transcriptCredits!: number[] | null;

  @ApiProperty({ type: Number, nullable: true, description: "credits_differ: the curriculum's credits; null for other codes" })
  curriculumCredits!: number | null;
}

export class DegreeAuditDto implements DegreeAudit {
  @ApiProperty({ example: 'APCS' })
  programCode!: string;

  @ApiProperty({ enum: TRAINING_TYPES, nullable: true })
  trainingType!: TrainingType | null;

  @ApiProperty({ example: 2024 })
  cohortYear!: number;

  @ApiProperty({ example: 'APCS2024' })
  curriculumCode!: string;

  @ApiProperty({ type: TermDto, nullable: true, description: 'The term the audit stands at the end of (asOfYear, asOfNumber); null: today, the whole transcript' })
  asOfTerm!: TermDto | null;

  @ApiProperty({ type: CreditSummaryDto })
  credits!: CreditSummaryDto;

  @ApiProperty({ type: GpaSummaryDto })
  gpa!: GpaSummaryDto;

  @ApiProperty({ type: [TermSummaryDto], description: 'Oldest first' })
  terms!: TermSummaryDto[];

  @ApiProperty({ type: [GroupCoverageDto], description: 'By name' })
  groups!: GroupCoverageDto[];

  @ApiProperty({ type: [CombinedMinimumCoverageDto] })
  combinedMinimums!: CombinedMinimumCoverageDto[];

  @ApiProperty({ type: [UnmatchedCourseDto], description: 'Transcript courses no group lists; they count toward nothing' })
  unmatchedCourses!: UnmatchedCourseDto[];

  @ApiProperty({ type: GraduationStatusDto })
  graduation!: GraduationStatusDto;

  @ApiProperty({ type: [AuditWarningDto] })
  warnings!: AuditWarningDto[];
}

export class AuditUnavailableDto {
  @ApiProperty({ example: 409 })
  statusCode!: number;

  @ApiProperty({ enum: AUDIT_UNAVAILABLE_CODES })
  code!: (typeof AUDIT_UNAVAILABLE_CODES)[number];

  @ApiProperty()
  message!: string;
}
