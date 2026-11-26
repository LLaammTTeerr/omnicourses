import { statusOf, type HttpError } from '../api.js';
import { requestAsUser } from '../auth/store.js';
import type { RequirementGroupKind, TrainingType } from '../curriculum/api.js';
import type { Term } from '../terms.js';
import type { TranscriptResult } from '../transcript/api.js';

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
  id: string;
  description: string;
  citation: string;
  status: ConditionStatus;
}

export interface GraduationStatus {
  status: 'done' | 'not_yet';
  met: GraduationCondition[];
  unmet: GraduationCondition[];
  notChecked: GraduationCondition[];
}

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
  credits: CreditSummary;
  gpa: GpaSummary;
  terms: TermSummary[];
  groups: GroupCoverage[];
  combinedMinimums: CombinedMinimumCoverage[];
  unmatchedCourses: UnmatchedCourse[];
  graduation: GraduationStatus;
  warnings: AuditWarning[];
}

export const AUDIT_UNAVAILABLE_CODES = ['onboarding_required', 'curriculum_not_found'] as const;
export type AuditUnavailableCode = (typeof AUDIT_UNAVAILABLE_CODES)[number];

export interface AuditUnavailable {
  statusCode: number;
  code: AuditUnavailableCode;
  message: string;
}

export type AuditOutcome = { status: 'ready'; audit: DegreeAudit } | { status: AuditUnavailableCode };

const isUnavailableCode = (code: string | null): code is AuditUnavailableCode => (AUDIT_UNAVAILABLE_CODES as readonly (string | null)[]).includes(code);

export async function fetchAudit(): Promise<AuditOutcome> {
  try {
    return { status: 'ready', audit: await requestAsUser<DegreeAudit>('GET', '/users/me/audit') };
  } catch (e) {
    const code = statusOf(e) === 409 ? (e as HttpError).code : null;
    if (isUnavailableCode(code)) return { status: code };
    throw e;
  }
}
