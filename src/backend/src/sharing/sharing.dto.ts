import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreditCapsDto } from '../audit/audit.dto.js';
import { PLACEMENT_KINDS, type PlacementKind } from '../plans/plan-board.js';
import { PLAN_ISSUE_CODES, PLAN_ISSUE_KINDS, type PlanIssueCode, type PlanIssueKind } from '../plans/plan-issues.js';
import { TERM_KINDS, type TermKind } from '../rules/credit-caps.js';
import { TermDto } from '../terms/term.dto.js';
import { SHARED_ISSUE_CODES, type SharedIssueCode } from './shared-plan.js';

// F9 sharing (UC-09, ADR 0010). Two contracts: what the owner sees of their link, and what a
// reader of the link sees of the plan. The second lists every field on purpose: a reader gets
// these and nothing else (UC-09 step 2).

export class SharePlanDto {
  @ApiProperty({ required: false, default: false, description: "Whether a reader sees the owner's display name. Left out: hidden." })
  @IsOptional()
  @IsBoolean()
  showName?: boolean;
}

export class PlanShareDto {
  @ApiProperty({
    example: 'q3T0c6mJm0mB1bqT8mWl2k0E1e8b6Zb1K3w1r5yX9aA',
    description: 'The token of the live link: 32 random bytes in base64url. The page builds the link from it. Anyone who holds it reads the plan, so treat it as a secret.',
  })
  token!: string;

  @ApiProperty({ description: "Whether a reader sees the owner's display name." })
  showName!: boolean;

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
  @ApiProperty({ enum: SHARED_ISSUE_CODES, description: 'As in GET /plans/{id}/issues, without the codes that depend on the transcript.' })
  code!: SharedIssueCode;

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

  @ApiProperty({ type: Number, nullable: true, description: 'Load issues: the credits counted.' })
  credits!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Load issues: the limit compared with.' })
  limit!: number | null;

  @ApiProperty({ example: 'QĐ 1175/QĐ-KHTN Điều 7.2', description: 'Where the rule comes from.' })
  citation!: string;

  @ApiProperty({ description: 'An English sentence, for a screen that does not word the code itself.' })
  message!: string;
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
    description: "The rule engine's issues of the plan that follow from the plan and its curriculum alone, in the engine's order. [] when it finds none of them.",
  })
  issues!: SharedPlanIssueDto[];

  @ApiProperty({
    enum: PLAN_ISSUE_CODES,
    isArray: true,
    description:
      "The issue codes this answer never holds, because the engine decides them from the owner's transcript, which is not shared. The same list for every plan. The page must say that these checks are not shown: an empty `issues` is not a pass of them.",
  })
  issueCodesNotShown!: PlanIssueCode[];
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
