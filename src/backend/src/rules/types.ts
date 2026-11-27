import type { RequirementGroupKind } from '../curriculum/requirement-group.entity.js';
import type { TrainingType } from '../curriculum/program.entity.js';
import type { Term } from '../terms/term.js';
import type { TranscriptResult } from '../transcript/transcript-entry.js';
import type { CapViolation, CreditCaps, TermKind } from './credit-caps.js';
import type { Classification } from './grades.js';

export const COURSE_STATUSES = ['passed', 'in_progress', 'failed', 'not_taken', 'counted_in_other_group'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export interface CourseCoverage {
  code: string;
  nameVi: string;
  nameEn: string | null;
  credits: number;
  countsTowardTotal: boolean;
  countsTowardGpa: boolean;
  status: CourseStatus;
  result: TranscriptResult | null;
  grade: number | null;
  countedInGroupId: string | null;
}

export interface GroupCoverage {
  id: string;
  name: string;
  kind: RequirementGroupKind;
  requiredCredits: number | null;
  passedCredits: number;
  inProgressCredits: number;
  overflowInCredits: number;
  overflowOutCredits: number;
  overflowToGroupId: string | null;
  remainingCredits: number | null;
  met: boolean;
  courses: CourseCoverage[];
}

export interface CombinedMinimumCoverage {
  id: string;
  name: string;
  creditsMin: number;
  officialNotes: string | null;
  groupIds: string[];
  credits: number;
  inProgressCredits: number;
  remainingCredits: number;
  met: boolean;
}

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
  accumulated: number;
  towardTotal: number;
  inProgressTowardTotal: number;
  totalRequired: number | null;
  remaining: number | null;
  yearLevel: 1 | 2 | 3 | 4;
}

export interface GpaSummary {
  average: number | null;
  accumulatedAverage: number | null;
  accumulatedAverageFourPoint: number | null;
  classification: Classification | null;
  gradedCredits: number;
}

export interface TermAttempt {
  code: string;
  name: string;
  credits: number;
  result: TranscriptResult;
  grade: number | null;
  passed: boolean;
  inProgress: boolean;
  requirementGroupId: string | null;
}

export interface TermSummary {
  term: Term;
  kind: TermKind | null;
  credits: number;
  passedCredits: number;
  average: number | null;
  accumulatedAverage: number | null;
  cumulativeAccumulatedAverage: number | null;
  cumulativeAccumulatedAverageChange: number | null;
  cumulativeAccumulatedCredits: number;
  cumulativeTowardTotal: number;
  failedCourseCodes: string[];
  inProgressCourseCodes: string[];
  caps: CreditCaps | null;
  capViolations: CapViolation[];
  attempts: TermAttempt[];
}

export const GRADUATION_STATUSES = ['done', 'not_yet'] as const;
export type GraduationVerdict = (typeof GRADUATION_STATUSES)[number];

export const CONDITION_STATUSES = ['met', 'not_met', 'not_checked'] as const;
export type ConditionStatus = (typeof CONDITION_STATUSES)[number];

export interface GraduationCondition {
  id: string;
  description: string;
  citation: string;
  status: ConditionStatus;
}

export interface GraduationStatus {
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
  transcriptCredits: number[] | null;
  curriculumCredits: number | null;
}

export interface DegreeAudit {
  programCode: string;
  trainingType: TrainingType | null;
  cohortYear: number;
  curriculumCode: string;
  asOfTerm: Term | null;
  credits: CreditSummary;
  gpa: GpaSummary;
  terms: TermSummary[];
  groups: GroupCoverage[];
  combinedMinimums: CombinedMinimumCoverage[];
  unmatchedCourses: UnmatchedCourse[];
  graduation: GraduationStatus;
  warnings: AuditWarning[];
}

export type AuditOutcome =
  | { status: 'ok'; audit: DegreeAudit }
  | { status: 'onboarding_required' }
  | { status: 'curriculum_not_found'; programCode: string; cohortYear: number };

export const AUDIT_UNAVAILABLE_CODES = ['onboarding_required', 'curriculum_not_found'] as const satisfies readonly AuditOutcome['status'][];

const REGULATION = 'QĐ 1175/QĐ-KHTN';

export const CITATIONS = {
  prerequisite: `${REGULATION} Điều 3.1.c`,
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
  planModel: 'ADR 0014',
} as const;

export const PLACEMENT_KINDS = ['course', 'slot'] as const;
export type PlacementKind = (typeof PLACEMENT_KINDS)[number];

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

export const PLAN_ISSUE_CODES = [
  'prerequisite_not_met',
  'prerequisites_not_recorded',
  'not_offered',
  'offering_terms_not_recorded',
  'load_below_minimum',
  'load_above_maximum',
  'caps_not_checked',
  'load_not_checked',
  'placed_twice',
  'already_passed',
  'already_in_progress',
  'not_in_curriculum',
  'credits_not_recorded',
  'requirement_not_covered',
] as const;
export type PlanIssueCode = (typeof PLAN_ISSUE_CODES)[number];

export const PLAN_ISSUE_KINDS = ['violation', 'flag', 'unknown'] as const;
export type PlanIssueKind = (typeof PLAN_ISSUE_KINDS)[number];

export interface PlanIssue {
  code: PlanIssueCode;
  kind: PlanIssueKind;
  term: Term | null;
  position: number | null;
  courseCode: string | null;
  requirementGroupId: string | null;
  combinedMinimumId: string | null;
  missingCourseCodes: string[];
  offeredTermNumbers: number[];
  credits: number | null;
  limit: number | null;
  citation: string;
  message: string;
}

export interface PlanTermLoad {
  term: Term;
  kind: TermKind | null;
  credits: number;
  caps: CreditCaps | null;
}

export interface PlanGroupCoverage {
  id: string;
  name: string;
  kind: RequirementGroupKind;
  requiredCredits: number | null;
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

export interface PlanCoverage {
  groups: PlanGroupCoverage[];
  combinedMinimums: PlanCombinedMinimumCoverage[];
  totalRequired: number | null;
  totalCredits: number;
  totalRemaining: number | null;
  graduation: GraduationVerdict;
}

export interface PlanIssuesReport {
  planId: string;
  trainingType: TrainingType | null;
  terms: PlanTermLoad[];
  issues: PlanIssue[];
  coverage: PlanCoverage;
}

export interface PlanUnderCheck {
  id: string;
  curriculum: { id: string };
  terms: readonly BoardTerm[];
}
