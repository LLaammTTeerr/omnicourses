// The result of the degree audit (F3, ADR 0013): plain types the pure functions return. The HTTP
// DTOs in `audit/audit.dto.ts` implement them, so the contract and the engine cannot drift apart.
import type { RequirementGroupKind } from '../curriculum/requirement-group.entity.js';
import type { TrainingType } from '../curriculum/program.entity.js';
import type { Term } from '../terms/term.js';
import type { TranscriptResult } from '../transcript/transcript-entry.js';
import type { CapViolation, CreditCaps, TermKind } from './credit-caps.js';
import type { Classification } from './grades.js';

export const COURSE_STATUSES = ['passed', 'in_progress', 'failed', 'not_taken', 'counted_in_other_group'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

/** One course of a requirement group, as the student's transcript stands. */
export interface CourseCoverage {
  code: string;
  nameVi: string;
  nameEn: string | null;
  /** Catalog credits. */
  credits: number;
  countsTowardTotal: boolean;
  countsTowardGpa: boolean;
  status: CourseStatus;
  /** The official attempt's result (Điều 14: the last completed attempt), or null. */
  result: TranscriptResult | null;
  /** The official attempt's grade, or null. */
  grade: number | null;
  /** A passed or in-progress course whose credits count in another group: that group. */
  countedInGroupId: string | null;
}

export interface GroupCoverage {
  id: string;
  name: string;
  kind: RequirementGroupKind;
  /** credits_total of a compulsory group, credits_total_min of an elective one; null when the group has no minimum of its own. */
  requiredCredits: number | null;
  /** Passed credits of the courses counted here that count toward the cohort total. */
  passedCredits: number;
  /** Credits of courses counted here that are in progress and not yet passed. */
  inProgressCredits: number;
  /** Credits another group's excess brings here. */
  overflowInCredits: number;
  /** This group's passed credits beyond its own minimum, counted toward overflowToGroupId. */
  overflowOutCredits: number;
  overflowToGroupId: string | null;
  /** requiredCredits − passed − overflowIn − inProgress, never below 0, and 0 once met; null without requiredCredits. */
  remainingCredits: number | null;
  /** Compulsory: every course passed. Elective: passed + overflowIn ≥ requiredCredits (always true without one). */
  met: boolean;
  courses: CourseCoverage[];
}

export interface CombinedMinimumCoverage {
  id: string;
  name: string;
  creditsMin: number;
  officialNotes: string | null;
  groupIds: string[];
  /** Passed credits of the groups together, overflow from outside them included. */
  credits: number;
  inProgressCredits: number;
  remainingCredits: number;
  met: boolean;
}

/** A transcript course no requirement group of the curriculum links. It counts toward nothing. */
export interface UnmatchedCourse {
  code: string;
  name: string;
  credits: number;
  result: TranscriptResult | null;
  grade: number | null;
  passed: boolean;
  inProgress: boolean;
}

export interface CreditSummary {
  /** Điều 11.4: credits of every passed course of the curriculum, GDTC and GDQP-AN included. */
  accumulated: number;
  /** Passed credits that count toward the cohort total. */
  towardTotal: number;
  /** In-progress credits that would count toward the cohort total. */
  inProgressTowardTotal: number;
  /** The cohort total (curriculums.total_credits_min), or null when not recorded. */
  totalRequired: number | null;
  /** totalRequired − towardTotal, never below 0. */
  remaining: number | null;
  /** Điều 15.3, from the accumulated credits. */
  yearLevel: 1 | 2 | 3 | 4;
}

export interface GpaSummary {
  /** Điều 15.1.a, điểm trung bình: every course studied, by its official grade. */
  average: number | null;
  /** Điều 15.1.b, điểm trung bình tích lũy: the passed courses only. */
  accumulatedAverage: number | null;
  /** accumulatedAverage over each grade's 4-point value; reference only (Điều 11.2). */
  accumulatedAverageFourPoint: number | null;
  /** Điều 15.2.b, from accumulatedAverage and the cohort. */
  classification: Classification | null;
  /** Credits behind accumulatedAverage. */
  gradedCredits: number;
}

export interface TermSummary {
  term: Term;
  kind: TermKind | null;
  /** Every course of the term, retakes included (Điều 7.1.b). */
  credits: number;
  passedCredits: number;
  /** Điều 15.1.a for the term: every graded attempt of the term ("tính mọi lần học"). */
  average: number | null;
  /** Điều 15.1.b for the term: its passed attempts only. */
  accumulatedAverage: number | null;
  /** Điều 15.1.b from the start of the course to the end of this term. */
  cumulativeAccumulatedAverage: number | null;
  failedCourseCodes: string[];
  inProgressCourseCodes: string[];
  caps: CreditCaps | null;
  /** Điều 7.2. Never blocking: a petition allows it. */
  capViolations: CapViolation[];
}

export const GRADUATION_STATUSES = ['done', 'not_yet'] as const;
export type GraduationVerdict = (typeof GRADUATION_STATUSES)[number];

export const CONDITION_STATUSES = ['met', 'not_met', 'not_checked'] as const;
export type ConditionStatus = (typeof CONDITION_STATUSES)[number];

export interface GraduationCondition {
  /** Stable: `group:<id>`, `combined:<id>`, `total_credits`, or the name of a condition the data cannot check. */
  id: string;
  description: string;
  citation: string;
  status: ConditionStatus;
}

export interface GraduationStatus {
  /** done: every condition the data can check is met. The notChecked ones still need the school. */
  status: GraduationVerdict;
  met: GraduationCondition[];
  unmet: GraduationCondition[];
  notChecked: GraduationCondition[];
}

export const AUDIT_WARNING_CODES = ['credits_differ', 'same_term_attempts', 'not_in_curriculum'] as const;
export type AuditWarningCode = (typeof AUDIT_WARNING_CODES)[number];

export interface AuditWarning {
  code: AuditWarningCode;
  courseCode: string;
  message: string;
  /** credits_differ: the credits the transcript gives that differ from the curriculum's; null for other codes. */
  transcriptCredits: number[] | null;
  /** credits_differ: the curriculum's credits; null for other codes. */
  curriculumCredits: number | null;
}

export interface DegreeAudit {
  programCode: string;
  trainingType: TrainingType | null;
  cohortYear: number;
  curriculumCode: string;
  credits: CreditSummary;
  gpa: GpaSummary;
  /** Oldest first. */
  terms: TermSummary[];
  /** By name. */
  groups: GroupCoverage[];
  combinedMinimums: CombinedMinimumCoverage[];
  /** By code. */
  unmatchedCourses: UnmatchedCourse[];
  graduation: GraduationStatus;
  warnings: AuditWarning[];
}

export type AuditOutcome =
  | { status: 'ok'; audit: DegreeAudit }
  /** Onboarding is not finished, or names no program and cohort. */
  | { status: 'onboarding_required' }
  /** Onboarding names a program and cohort that have no curriculum. */
  | { status: 'curriculum_not_found'; programCode: string; cohortYear: number };

export const AUDIT_UNAVAILABLE_CODES = ['onboarding_required', 'curriculum_not_found'] as const satisfies readonly AuditOutcome['status'][];

const REGULATION = 'QĐ 1175/QĐ-KHTN';

export const CITATIONS = {
  prerequisite: `${REGULATION} Điều 3.1.c`,
  /** Điều 6.5: the term plan says which courses open; Điều 7.1.a: students register for those. */
  offering: `${REGULATION} Điều 6.5, 7.1.a`,
  termLoad: `${REGULATION} Điều 7.1.b`,
  creditCaps: `${REGULATION} Điều 7.2`,
  capPetition: `${REGULATION} Điều 7.2.b`,
  gradeImprovement: `${REGULATION} Điều 14.2`,
  curriculum: `${REGULATION} Điều 15.1`,
  noProsecution: `${REGULATION} Điều 17.3.a`,
  graduation: `${REGULATION} Điều 17.3.b`,
  defenceEducation: `${REGULATION} Điều 17.3.c`,
  foreignLanguage: `${REGULATION} Điều 17.3.d`,
  itStandard: `${REGULATION} Điều 17.3.e`,
  studyTimeLimit: `${REGULATION} Điều 2.7`,
  /** A course placed twice breaks the plan model, not a clause of the regulation. */
  planModel: 'ADR 0014',
} as const;

export const PLACEMENT_KINDS = ['course', 'slot'] as const;
export type PlacementKind = (typeof PLACEMENT_KINDS)[number];

/** A course, or a slot holding credits for a requirement group until a course is chosen. */
export interface Placement {
  kind: PlacementKind;
  courseCode: string | null;
  requirementGroupId: string | null;
  credits: number | null;
}

export interface BoardTerm {
  term: Term;
  placements: Placement[];
}

// Seam between the plans module and the rule engine (ADR 0014): this module stores placements and
// judges none of them (AGENTS.md hard rule 1). RulesService serves these; the
// pure checks are in `rules/plan-issues.ts`. GET /api/plans/{id}/issues serves the result, and it
// is the check F5 runs live and ADR 0006's validate(plan).

export const PLAN_ISSUE_CODES = [
  /** A prerequisite is neither passed nor placed in an earlier term (Điều 3.1.c). */
  'prerequisite_not_met',
  /** The course's prerequisites are not recorded for the plan's curriculum: unknown, not a pass. */
  'prerequisites_not_recorded',
  /** The course is not taught in a term of this number (Điều 6.5, 7.1.a). */
  'not_offered',
  /** The course's offering terms are not recorded for the plan's curriculum: unknown, not a pass. */
  'offering_terms_not_recorded',
  /** The term's load is below the minimum of the program's training type (Điều 7.2.a). */
  'load_below_minimum',
  /** The term's load is above the maximum (Điều 7.2.b). */
  'load_above_maximum',
  /** The program's training type is not recorded, so no cap is checked (ADR 0013). */
  'caps_not_checked',
  /**
   * A course of the term has unknown credits (credits_not_recorded), so the load is at least `credits`
   * and a cap it may still cross is not checked. A load already above the maximum is still flagged.
   */
  'load_not_checked',
  /** The course is placed in more than one term of the plan (ADR 0014). */
  'placed_twice',
  /** The transcript already has the course passed before this term: a grade improvement (Điều 14.2). */
  'already_passed',
  /**
   * The transcript has the course in progress in an earlier term, and the plan assumes it passes, so
   * placing it again is a grade improvement, or a retake if it fails (Điều 14).
   */
  'already_in_progress',
  /** No requirement group of the plan's curriculum lists the course, so it counts toward nothing (Điều 15.1). */
  'not_in_curriculum',
  /** The catalog has no such course any more, so its credits are unknown and left out of the load. */
  'credits_not_recorded',
  /** A requirement group, a combined minimum or the cohort total is still short with the plan completed (Điều 17.3.b). */
  'requirement_not_covered',
] as const;
export type PlanIssueCode = (typeof PLAN_ISSUE_CODES)[number];

/**
 * violation: the plan breaks a rule. flag: allowed, but worth a look (a load outside the caps,
 * which a petition allows, ADR 0012; a grade improvement). unknown: the data to check the rule is
 * not recorded, so the engine says neither pass nor fail. None of them blocks saving a plan.
 */
export const PLAN_ISSUE_KINDS = ['violation', 'flag', 'unknown'] as const;
export type PlanIssueKind = (typeof PLAN_ISSUE_KINDS)[number];

/** One issue of a plan (GLOSSARY "Violation"), as a code with parameters for the UI to word (ADR 0006). */
export interface PlanIssue {
  code: PlanIssueCode;
  kind: PlanIssueKind;
  /** The term it is about; null for a coverage issue, which is about the whole plan. */
  term: Term | null;
  /** The placement's index within its term (the order of `terms[].placements`); null for a term or plan issue. */
  position: number | null;
  courseCode: string | null;
  /** requirement_not_covered of a group. */
  requirementGroupId: string | null;
  /** requirement_not_covered of a combined minimum. */
  combinedMinimumId: string | null;
  /** prerequisite_not_met: the prerequisites missing. requirement_not_covered of a compulsory group: its courses neither passed nor placed. */
  missingCourseCodes: string[];
  /** not_offered: the term numbers the course is taught in. */
  offeredTermNumbers: number[];
  /** Load and coverage issues: the credits counted. */
  credits: number | null;
  /** Load and coverage issues: the limit they are compared with. */
  limit: number | null;
  /** The rule's source, such as "QĐ 1175/QĐ-KHTN Điều 7.2". */
  citation: string;
  /** An English sentence for a screen that does not word the code itself. */
  message: string;
}

/** One term of the plan and its load against the caps (ADR 0012). */
export interface PlanTermLoad {
  term: Term;
  /** Null when the program's training type is not recorded. */
  kind: TermKind | null;
  /**
   * The credits placed: courses at their catalog credits, slots at theirs (Điều 7.1.b). A course whose
   * credits are unknown is left out, so this is then a lower bound (load_not_checked).
   */
  credits: number;
  /** Null when the program's training type is not recorded: no cap is checked. */
  caps: CreditCaps | null;
}

/** A requirement group as it would stand with the whole plan completed. */
export interface PlanGroupCoverage {
  id: string;
  name: string;
  kind: RequirementGroupKind;
  requiredCredits: number | null;
  /** Credits passed, in progress or placed that count toward the cohort total, overflow in included. */
  credits: number;
  remainingCredits: number | null;
  met: boolean;
}

export interface PlanCombinedMinimumCoverage {
  id: string;
  name: string;
  creditsMin: number;
  credits: number;
  remainingCredits: number;
  met: boolean;
}

/** Coverage of the curriculum if every placement and every course in progress is passed. */
export interface PlanCoverage {
  groups: PlanGroupCoverage[];
  combinedMinimums: PlanCombinedMinimumCoverage[];
  /** The cohort total, or null when not recorded. */
  totalRequired: number | null;
  totalCredits: number;
  totalRemaining: number | null;
  /** done: every requirement the data can check would be met. The school still checks the rest (Điều 17.3). */
  graduation: GraduationVerdict;
}

export interface PlanIssuesReport {
  planId: string;
  trainingType: TrainingType | null;
  /** The plan's terms, oldest first. */
  terms: PlanTermLoad[];
  /** By term, oldest first: each term's load issues, then its placements in order; coverage issues last. */
  issues: PlanIssue[];
  coverage: PlanCoverage;
}

export interface PlanUnderCheck {
  id: string;
  curriculum: { id: string };
  terms: readonly BoardTerm[];
}
