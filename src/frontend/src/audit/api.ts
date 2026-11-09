import { request, statusOf, type HttpError } from '../api.js';
import type { RequirementGroupKind, TrainingType } from '../curriculum/api.js';
import type { Term } from '../terms.js';
import type { TranscriptResult } from '../transcript/api.js';

// The degree audit DTOs of the API (F3, ADR 0013), written by hand; api.spec.ts checks them against
// src/backend/openapi.json. Every number, status and citation in them comes from the rule engine: the screens show
// them and never work one out (AGENTS.md hard rule 1).

export const COURSE_STATUSES = ['passed', 'in_progress', 'failed', 'not_taken', 'counted_in_other_group'] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export const CONDITION_STATUSES = ['met', 'not_met', 'not_checked'] as const;
export type ConditionStatus = (typeof CONDITION_STATUSES)[number];

export const CLASSIFICATIONS = ['excellent', 'very_good', 'good', 'fairly_good', 'average', 'weak', 'poor'] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

export const TERM_KINDS = ['main', 'summer'] as const;
export type TermKind = (typeof TERM_KINDS)[number];

export const CAP_RULES = ['below_minimum', 'above_maximum'] as const;
export type CapRule = (typeof CAP_RULES)[number];

export const AUDIT_WARNING_CODES = ['credits_differ', 'same_term_attempts', 'not_in_curriculum'] as const;
export type AuditWarningCode = (typeof AUDIT_WARNING_CODES)[number];

export interface CourseCoverage {
  code: string;
  nameVi: string;
  nameEn: string | null;
  credits: number;
  /** false: required, but outside the cohort total (GDTC, GDQP-AN). */
  countsTowardTotal: boolean;
  countsTowardGpa: boolean;
  status: CourseStatus;
  result: TranscriptResult | null;
  grade: number | null;
  /** When status is counted_in_other_group: the group the course counts in. */
  countedInGroupId: string | null;
}

export interface GroupCoverage {
  id: string;
  name: string;
  kind: RequirementGroupKind;
  /** null: the group has no minimum of its own (a combined minimum holds its rule). */
  requiredCredits: number | null;
  passedCredits: number;
  inProgressCredits: number;
  overflowInCredits: number;
  overflowOutCredits: number;
  overflowToGroupId: string | null;
  /** null without requiredCredits. */
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

export interface CreditCaps {
  min: number | null;
  max: number;
}

export interface CapViolation {
  rule: CapRule;
  credits: number;
  limit: number;
  citation: string;
  petition: string;
}

export interface TermSummary {
  term: Term;
  kind: TermKind | null;
  credits: number;
  passedCredits: number;
  average: number | null;
  accumulatedAverage: number | null;
  cumulativeAccumulatedAverage: number | null;
  failedCourseCodes: string[];
  inProgressCourseCodes: string[];
  caps: CreditCaps | null;
  capViolations: CapViolation[];
}

export interface GraduationCondition {
  /** `group:<id>`, `combined:<id>`, `total_credits`, or the name of a condition the data cannot check. */
  id: string;
  description: string;
  citation: string;
  status: ConditionStatus;
}

export interface GraduationStatus {
  /** done: every condition the data can check is met; the notChecked ones still need the school. */
  status: 'done' | 'not_yet';
  met: GraduationCondition[];
  unmet: GraduationCondition[];
  notChecked: GraduationCondition[];
}

export interface AuditWarning {
  code: AuditWarningCode;
  courseCode: string;
  message: string;
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
  unmatchedCourses: UnmatchedCourse[];
  graduation: GraduationStatus;
  warnings: AuditWarning[];
}

export const AUDIT_UNAVAILABLE_CODES = ['onboarding_required', 'curriculum_not_found'] as const;
/** Why the API answered 409: no program and cohort yet, or no curriculum for them. */
export type AuditUnavailableCode = (typeof AUDIT_UNAVAILABLE_CODES)[number];

export interface AuditUnavailable {
  statusCode: number;
  code: AuditUnavailableCode;
  message: string;
}

/** The audit, or why there is none yet. A 409 is a state of the account, not a failure. */
export type AuditOutcome = { status: 'ready'; audit: DegreeAudit } | { status: AuditUnavailableCode };

const isUnavailableCode = (code: string | null): code is AuditUnavailableCode => (AUDIT_UNAVAILABLE_CODES as readonly (string | null)[]).includes(code);

/** The signed-in student's degree audit, worked out by the API from their saved transcript on every call. */
export async function fetchAudit(token: string): Promise<AuditOutcome> {
  try {
    return { status: 'ready', audit: await request<DegreeAudit>('GET', '/users/me/audit', { token }) };
  } catch (e) {
    const code = statusOf(e) === 409 ? (e as HttpError).code : null;
    if (isUnavailableCode(code)) return { status: code };
    throw e;
  }
}
