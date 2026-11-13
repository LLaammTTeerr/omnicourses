import { ApiProperty } from '@nestjs/swagger';
import { CreditCapsDto } from '../audit/audit.dto.js';
import { REQUIREMENT_GROUP_KINDS, type RequirementGroupKind, TRAINING_TYPES, type TrainingType } from '../curriculum/curriculum-types.js';
import { GRADUATION_VERDICTS, type GraduationVerdict } from '../rules/audit-types.js';
import { TERM_KINDS, type TermKind } from '../rules/credit-caps.js';
import {
  PLAN_ISSUE_CODES,
  PLAN_ISSUE_KINDS,
  type PlanCombinedMinimumCoverage,
  type PlanCoverage,
  type PlanGroupCoverage,
  type PlanIssue,
  type PlanIssueCode,
  type PlanIssueKind,
  type PlanIssuesReport,
  type PlanTermLoad,
} from '../rules/plan-issue-types.js';
import { TermDto } from '../terms/term.dto.js';

// GET /api/plans/{id}/issues (ADR 0014). Each class implements the rule engine's result type, so
// this contract cannot drift from what the engine returns.

export class PlanIssueDto implements PlanIssue {
  @ApiProperty({
    enum: PLAN_ISSUE_CODES,
    description:
      'prerequisite_not_met, not_offered, placed_twice, requirement_not_covered: violations. load_below_minimum, load_above_maximum (a petition allows them, Điều 7.2.b), already_passed (a grade improvement, Điều 14.2), already_in_progress (in progress in an earlier term; the plan assumes it passes), not_in_curriculum: flags. prerequisites_not_recorded, offering_terms_not_recorded, caps_not_checked, credits_not_recorded, load_not_checked (a course of the term has unknown credits, so the load is at least `credits`): the data is not recorded, so the rule is neither passed nor failed.',
  })
  code!: PlanIssueCode;

  @ApiProperty({ enum: PLAN_ISSUE_KINDS, description: 'violation: breaks a rule. flag: allowed, worth a look. unknown: not recorded, not checked. None blocks saving the plan.' })
  kind!: PlanIssueKind;

  @ApiProperty({ type: TermDto, nullable: true, description: 'The term it is about; null for a coverage issue.' })
  term!: TermDto | null;

  @ApiProperty({ type: Number, nullable: true, description: "The placement's index in its term's placements; null for a term or coverage issue." })
  position!: number | null;

  @ApiProperty({ type: String, nullable: true, example: 'CS161' })
  courseCode!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'requirement_not_covered of a requirement group.' })
  requirementGroupId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'requirement_not_covered of a combined minimum.' })
  combinedMinimumId!: string | null;

  @ApiProperty({ type: [String], description: 'prerequisite_not_met: the missing prerequisites. requirement_not_covered of a compulsory group: its courses neither passed nor placed.' })
  missingCourseCodes!: string[];

  @ApiProperty({ type: [Number], description: 'not_offered: the term numbers the course is taught in.' })
  offeredTermNumbers!: number[];

  @ApiProperty({ type: Number, nullable: true, description: 'Load and coverage issues: the credits counted.' })
  credits!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Load and coverage issues: the limit compared with.' })
  limit!: number | null;

  @ApiProperty({ example: 'QĐ 1175/QĐ-KHTN Điều 3.1.c', description: 'Where the rule comes from.' })
  citation!: string;

  @ApiProperty({ description: 'An English sentence, for a screen that does not word the code itself.' })
  message!: string;
}

export class PlanTermLoadDto implements PlanTermLoad {
  @ApiProperty({ type: TermDto })
  term!: TermDto;

  @ApiProperty({ enum: TERM_KINDS, nullable: true, description: "null: the program's training type is not recorded." })
  kind!: TermKind | null;

  @ApiProperty({ example: 16, description: 'Courses at their catalog credits plus slots at theirs (Điều 7.1.b).' })
  credits!: number;

  @ApiProperty({ type: CreditCapsDto, nullable: true, description: 'Điều 7.2 for the training type (ADR 0012); null when it is not recorded.' })
  caps!: CreditCapsDto | null;
}

export class PlanGroupCoverageDto implements PlanGroupCoverage {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Kiến thức Math' })
  name!: string;

  @ApiProperty({ enum: REQUIREMENT_GROUP_KINDS })
  kind!: RequirementGroupKind;

  @ApiProperty({ type: Number, nullable: true, description: 'null: the group has no minimum of its own.' })
  requiredCredits!: number | null;

  @ApiProperty({ description: 'Credits passed, in progress or placed, toward the cohort total, overflow in included.' })
  credits!: number;

  @ApiProperty({ type: Number, nullable: true })
  remainingCredits!: number | null;

  @ApiProperty()
  met!: boolean;
}

export class PlanCombinedMinimumCoverageDto implements PlanCombinedMinimumCoverage {
  @ApiProperty({ format: 'uuid' })
  id!: string;

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

export class PlanCoverageDto implements PlanCoverage {
  @ApiProperty({ type: [PlanGroupCoverageDto], description: 'By name.' })
  groups!: PlanGroupCoverageDto[];

  @ApiProperty({ type: [PlanCombinedMinimumCoverageDto] })
  combinedMinimums!: PlanCombinedMinimumCoverageDto[];

  @ApiProperty({ type: Number, nullable: true, description: 'The cohort total; null when not recorded.' })
  totalRequired!: number | null;

  @ApiProperty({ description: 'Credits toward the cohort total with the plan completed.' })
  totalCredits!: number;

  @ApiProperty({ type: Number, nullable: true })
  totalRemaining!: number | null;

  @ApiProperty({ enum: GRADUATION_VERDICTS, description: 'done: every requirement the data can check would be met; the school still checks the rest (Điều 17.3).' })
  graduation!: GraduationVerdict;
}

export class PlanIssuesDto implements PlanIssuesReport {
  @ApiProperty({ format: 'uuid' })
  planId!: string;

  @ApiProperty({ enum: TRAINING_TYPES, nullable: true, description: "The program's training type, which sets the caps (ADR 0012); null: not recorded." })
  trainingType!: TrainingType | null;

  @ApiProperty({ type: [PlanTermLoadDto], description: "The plan's terms, oldest first." })
  terms!: PlanTermLoadDto[];

  @ApiProperty({ type: [PlanIssueDto], description: 'By term, oldest first: load issues, then placements in order; coverage issues last. [] when nothing is found.' })
  issues!: PlanIssueDto[];

  @ApiProperty({ type: PlanCoverageDto, description: 'The curriculum as it would stand with every placement and every course in progress passed.' })
  coverage!: PlanCoverageDto;
}

/** The engine's report on the board with the placement dropped on one target term. */
export class PlanDropReportDto {
  @ApiProperty({ type: TermDto })
  term!: TermDto;

  @ApiProperty({ type: PlanIssuesDto })
  issues!: PlanIssuesDto;
}

export class PlanDropReportsDto {
  @ApiProperty({ type: [PlanDropReportDto], description: 'One per target, in the order sent.' })
  reports!: PlanDropReportDto[];
}
