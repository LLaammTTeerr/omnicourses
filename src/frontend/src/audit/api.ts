import { request, statusOf, type HttpError } from '../api.js';
import type {
  AuditUnavailableDto,
  AuditWarningDto,
  CapViolationDto,
  CombinedMinimumCoverageDto,
  CourseCoverageDto,
  CreditSummaryDto,
  DegreeAuditDto,
  GpaSummaryDto,
  GraduationConditionDto,
  GraduationStatusDto,
  GroupCoverageDto,
  TermSummaryDto,
  UnmatchedCourseDto,
} from '../api-schema/types.gen.js';

// The degree audit DTOs of the API (F3, ADR 0013), generated from the contract (ADR 0018). Every number, status and
// citation in them comes from the rule engine: the screens show them and never work one out (AGENTS.md hard rule 1).

export type CourseStatus = CourseCoverageDto['status'];
export type ConditionStatus = GraduationConditionDto['status'];
export type Classification = NonNullable<GpaSummaryDto['classification']>;
export type TermKind = NonNullable<TermSummaryDto['kind']>;
export type CapRule = CapViolationDto['rule'];
export type AuditWarningCode = AuditWarningDto['code'];

/** `countsTowardTotal` false: required, but outside the cohort total (GDTC, GDQP-AN). */
export type CourseCoverage = CourseCoverageDto;
export type GroupCoverage = GroupCoverageDto;
export type CombinedMinimumCoverage = CombinedMinimumCoverageDto;
export type UnmatchedCourse = UnmatchedCourseDto;
export type CreditSummary = CreditSummaryDto;
export type GpaSummary = GpaSummaryDto;
export type CapViolation = CapViolationDto;
export type TermSummary = TermSummaryDto;
/** `id`: `group:<id>`, `combined:<id>`, `total_credits`, or the name of a condition the data cannot check. */
export type GraduationCondition = GraduationConditionDto;
/** `status` done: every condition the data can check is met; the notChecked ones still need the school. */
export type GraduationStatus = GraduationStatusDto;
export type AuditWarning = AuditWarningDto;
/** `terms` oldest first; `groups` by name. */
export type DegreeAudit = DegreeAuditDto;
export type AuditUnavailable = AuditUnavailableDto;
/** Why the API answered 409: no program and cohort yet, or no curriculum for them. */
export type AuditUnavailableCode = AuditUnavailableDto['code'];

/** fetchAudit tells these 409s apart at run time; api.spec.ts checks that it has every code of the contract. */
export const AUDIT_UNAVAILABLE_CODES = ['onboarding_required', 'curriculum_not_found'] as const satisfies readonly AuditUnavailableCode[];

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
