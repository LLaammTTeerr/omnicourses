import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, ValidateIf } from 'class-validator';
import { CreditCapsDto } from '../audit/audit.dto.js';
import { REQUIREMENT_GROUP_KINDS, type RequirementGroupKind } from '../curriculum/requirement-group.entity.js';
import { PLACEMENT_KINDS, type PlacementKind } from '../plans/plan-board.js';
import { PLAN_ISSUE_CODES, PLAN_ISSUE_KINDS, type PlanIssueCode, type PlanIssueKind } from '../plans/plan-issues.js';
import { TERM_KINDS, type TermKind } from '../rules/credit-caps.js';
import { TermDto } from '../terms/term.dto.js';

// F9 sharing (UC-09, ADR 0010). Two contracts: what the owner sees of their link, and what a
// reader of the link sees of the plan. The second lists every field on purpose: a reader gets
// these and nothing else (UC-09 step 2).

/** A choice that is sent must be a boolean: null is refused, not read as "left out". */
const ifSent = ValidateIf((_: object, value: unknown) => value !== undefined);

// Both choices follow one rule: only an explicit true turns a choice on, an explicit false turns it
// off, and a field left out keeps what the link has (off on a new link). So a page that sends one
// choice never changes the other.
export class SharePlanDto {
  @ApiProperty({ required: false, description: "Whether a reader sees the owner's display name. Left out: unchanged on a live link, hidden on a new one." })
  @ifSent
  @IsBoolean()
  showName?: boolean;

  @ApiProperty({
    required: false,
    description:
      "Whether a reader sees the checks the rule engine decides from the owner's transcript (missing prerequisites, courses already passed or in progress, requirements not covered) and the coverage of each requirement. With it on, a reader can tell which courses the owner has passed, failed or is taking; grades and transcript rows are never shown. Left out: unchanged on a live link, off on a new one.",
  })
  @ifSent
  @IsBoolean()
  showTranscriptChecks?: boolean;
}

export class PlanShareDto {
  @ApiProperty({
    example: 'q3T0c6mJm0mB1bqT8mWl2k0E1e8b6Zb1K3w1r5yX9aA',
    description: 'The token of the live link: 32 random bytes in base64url. The page builds the link from it. Anyone who holds it reads the plan, so treat it as a secret.',
  })
  token!: string;

  @ApiProperty({ description: "Whether a reader sees the owner's display name." })
  showName!: boolean;

  @ApiProperty({ description: "Whether a reader sees the checks that come from the owner's transcript, and the coverage. When true, the page must tell the owner that a reader can tell which courses they passed, failed or are taking." })
  showTranscriptChecks!: boolean;

  @ApiProperty({ type: String, format: 'date-time', description: 'When this link was created.' })
  createdAt!: Date;
}

export class PlanShareStateDto {
  @ApiProperty({ type: PlanShareDto, nullable: true, description: 'The live link of the plan, or null when the plan is not shared. A plan has at most one.' })
  share!: PlanShareDto | null;
}

export class SharedProgramDto {
  @ApiProperty({ example: 'APCS' })
  code!: string;

  @ApiProperty()
  nameVi!: string;

  @ApiProperty({ type: String, nullable: true })
  nameEn!: string | null;
}

export class SharedCurriculumDto {
  @ApiProperty({ example: 'APCS2024', description: 'The curriculum version the plan was made with.' })
  code!: string;

  @ApiProperty({ example: 2024 })
  cohortYear!: number;

  @ApiProperty()
  nameVi!: string;

  @ApiProperty({ type: String, nullable: true })
  nameEn!: string | null;

  @ApiProperty({ type: SharedProgramDto })
  program!: SharedProgramDto;
}

export class SharedPlacementDto {
  @ApiProperty({ enum: PLACEMENT_KINDS, description: 'course: a course of the catalog. slot: credits held for a requirement group, no course chosen yet.' })
  kind!: PlacementKind;

  @ApiProperty({ type: String, nullable: true, example: 'CS161', description: 'Null for a slot.' })
  courseCode!: string | null;

  @ApiProperty({ type: String, nullable: true, description: "The course's Vietnamese name. Null for a slot, and for a course the catalog no longer has." })
  nameVi!: string | null;

  @ApiProperty({ type: String, nullable: true })
  nameEn!: string | null;

  @ApiProperty({ type: Number, nullable: true, description: "A course's catalog credits, or a slot's. Null for a course the catalog no longer has." })
  credits!: number | null;

  @ApiProperty({ type: String, nullable: true, description: "A slot's requirement group. Null for a course." })
  requirementGroupName!: string | null;
}

export class SharedPlanTermDto {
  @ApiProperty({ type: TermDto })
  term!: TermDto;

  @ApiProperty({ enum: TERM_KINDS, nullable: true, description: "null: the program's training type is not recorded." })
  kind!: TermKind | null;

  @ApiProperty({ example: 16, description: "The term's load as the rule engine counts it: courses at their catalog credits plus slots at theirs." })
  credits!: number;

  @ApiProperty({ type: CreditCapsDto, nullable: true, description: 'The credit caps of the term (ADR 0012); null when the training type is not recorded.' })
  caps!: CreditCapsDto | null;

  @ApiProperty({ type: [SharedPlacementDto], description: 'In order.' })
  placements!: SharedPlacementDto[];
}

export class SharedPlanIssueDto {
  @ApiProperty({ enum: PLAN_ISSUE_CODES, description: 'As in GET /plans/{id}/issues. Never a code listed in `issueCodesNotShown`.' })
  code!: PlanIssueCode;

  @ApiProperty({ enum: PLAN_ISSUE_KINDS, description: 'violation: breaks a rule. flag: allowed, worth a look. unknown: not recorded, not checked.' })
  kind!: PlanIssueKind;

  @ApiProperty({ type: TermDto, nullable: true })
  term!: TermDto | null;

  @ApiProperty({ type: Number, nullable: true, description: "The placement's index in its term's placements; null for an issue of the whole term." })
  position!: number | null;

  @ApiProperty({ type: String, nullable: true, example: 'CS161' })
  courseCode!: string | null;

  @ApiProperty({ type: [Number], description: 'not_offered: the term numbers the course is taught in.' })
  offeredTermNumbers!: number[];

  @ApiProperty({ type: Number, nullable: true, description: 'Load and coverage issues: the credits counted.' })
  credits!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Load and coverage issues: the limit compared with.' })
  limit!: number | null;

  @ApiProperty({ example: 'QĐ 1175/QĐ-KHTN Điều 7.2', description: 'Where the rule comes from.' })
  citation!: string;

  @ApiProperty({ description: 'An English sentence, for a screen that does not word the code itself.' })
  message!: string;

  @ApiProperty({
    type: [String],
    required: false,
    description:
      "Only when the owner chose to show the transcript's checks. prerequisite_not_met: the prerequisites missing. requirement_not_covered of a compulsory group: its courses neither passed nor placed.",
  })
  missingCourseCodes?: string[];

  @ApiProperty({ type: String, nullable: true, required: false, description: "Only when the owner chose to show the transcript's checks. requirement_not_covered of a requirement group: its name." })
  requirementGroupName?: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    required: false,
    description:
      "Only when the owner chose to show the transcript's checks. requirement_not_covered of a combined minimum: its name. A requirement_not_covered with neither name is about the cohort total.",
  })
  combinedMinimumName?: string | null;
}

export class SharedGroupCoverageDto {
  @ApiProperty({ example: 'Kiến thức Math' })
  name!: string;

  @ApiProperty({ enum: REQUIREMENT_GROUP_KINDS })
  kind!: RequirementGroupKind;

  @ApiProperty({ type: Number, nullable: true, description: 'null: the group has no minimum of its own.' })
  requiredCredits!: number | null;

  @ApiProperty({ description: 'Credits passed, in progress or placed, toward the cohort total.' })
  credits!: number;

  @ApiProperty({ type: Number, nullable: true })
  remainingCredits!: number | null;

  @ApiProperty()
  met!: boolean;
}

export class SharedCombinedMinimumCoverageDto {
  @ApiProperty({ example: 'Kiến thức tự chọn' })
  name!: string;

  @ApiProperty({ example: 43 })
  creditsMin!: number;

  @ApiProperty()
  credits!: number;

  @ApiProperty()
  remainingCredits!: number;

  @ApiProperty()
  met!: boolean;
}

/** The rule engine's coverage of the plan (PlanCoverage of GET /plans/{id}/issues), by name and with no id. */
export class SharedPlanCoverageDto {
  @ApiProperty({ type: [SharedGroupCoverageDto] })
  groups!: SharedGroupCoverageDto[];

  @ApiProperty({ type: [SharedCombinedMinimumCoverageDto] })
  combinedMinimums!: SharedCombinedMinimumCoverageDto[];

  @ApiProperty({ type: Number, nullable: true, description: 'The cohort total; null when not recorded.' })
  totalRequired!: number | null;

  @ApiProperty({ description: 'Credits toward the cohort total with the plan completed.' })
  totalCredits!: number;

  @ApiProperty({ type: Number, nullable: true })
  totalRemaining!: number | null;

  @ApiProperty({ enum: ['done', 'not_yet'], description: 'done: every requirement the data can check would be met with the plan completed; the school still checks the rest (Điều 17.3).' })
  graduation!: 'done' | 'not_yet';
}

/** Everything a reader of a shared plan's link gets (UC-09 step 2). No field identifies the owner except `ownerName`, when they chose it. */
export class SharedPlanDto {
  @ApiProperty({ example: 'Main plan' })
  name!: string;

  @ApiProperty({ type: String, nullable: true, description: "The owner's display name, only when they chose to show it; null otherwise." })
  ownerName!: string | null;

  @ApiProperty({ type: SharedCurriculumDto })
  curriculum!: SharedCurriculumDto;

  @ApiProperty({ type: String, format: 'date-time', description: 'When the plan was last changed. The answer always shows the plan as it is now.' })
  updatedAt!: Date;

  @ApiProperty({ type: [SharedPlanTermDto], description: 'Terms oldest first.' })
  terms!: SharedPlanTermDto[];

  @ApiProperty({
    type: [SharedPlanIssueDto],
    description:
      "The rule engine's issues of the plan, in the engine's order: the ones that follow from the plan and its curriculum alone, and, when the owner chose it, the ones the engine decides from the owner's transcript too. [] when it finds none of them.",
  })
  issues!: SharedPlanIssueDto[];

  @ApiProperty({
    enum: PLAN_ISSUE_CODES,
    isArray: true,
    description:
      "The issue codes this answer does not hold, because the engine decides them from the owner's transcript and the owner did not choose to show them. [] when the owner chose to show them. When it is not empty, the page must say that these checks are not shown: an empty `issues` is not a pass of them.",
  })
  issueCodesNotShown!: PlanIssueCode[];

  @ApiProperty({
    type: SharedPlanCoverageDto,
    required: false,
    description:
      "Only when the owner chose to show the transcript's checks: the curriculum as it would stand with every placement and every course in progress passed. It counts the owner's passed courses, so it is left out otherwise.",
  })
  coverage?: SharedPlanCoverageDto;
}

export const NOT_SHARED_MESSAGE = 'This plan is not shared';

/** The one answer to every link that does not open a plan: stopped, deleted, mistyped or never created. */
export class NotSharedDto {
  @ApiProperty({ example: 404 })
  statusCode!: number;

  @ApiProperty({ example: NOT_SHARED_MESSAGE })
  message!: string;

  @ApiProperty({ example: 'Not Found' })
  error!: string;
}
