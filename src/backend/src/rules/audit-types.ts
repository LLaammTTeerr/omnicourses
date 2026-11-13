// The result of the degree audit (F3, ADR 0013): plain types the pure functions return. The HTTP
// DTOs in `audit/audit.dto.ts` implement them, so the contract and the engine cannot drift apart.
import type { RequirementGroupKind, TrainingType } from '../curriculum/curriculum-types.js';
import type { Term } from '../terms/term.js';
import type { TranscriptResult } from '../transcript/transcript-entry.js';
import type { CapViolation, CreditCaps, TermKind } from './credit-caps.js';
import type { Classification, YearLevel } from './grades.js';

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
  yearLevel: YearLevel;
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

export const CONDITION_STATUSES = ['met', 'not_met', 'not_checked'] as const;
export type ConditionStatus = (typeof CONDITION_STATUSES)[number];

export interface GraduationCondition {
  /** Stable: `group:<id>`, `combined:<id>`, `total_credits`, or the name of a condition the data cannot check. */
  id: string;
  description: string;
  citation: string;
  status: ConditionStatus;
}

/** done: every condition the data can check is met. The notChecked ones still need the school. */
export const GRADUATION_VERDICTS = ['done', 'not_yet'] as const;
export type GraduationVerdict = (typeof GRADUATION_VERDICTS)[number];

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

/** Why there is no audit (409): onboarding names no program and cohort, or they have no curriculum. */
export const AUDIT_UNAVAILABLE_CODES = ['onboarding_required', 'curriculum_not_found'] as const;
export type AuditUnavailableCode = (typeof AUDIT_UNAVAILABLE_CODES)[number];
