import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_URL, HttpError } from '../api.js';
import { contractEnum, contractShape, type Shape } from '../testing/contract.js';
import { mockApi, status } from '../testing/fetch.js';
import {
  AUDIT_UNAVAILABLE_CODES,
  AUDIT_WARNING_CODES,
  CAP_RULES,
  CLASSIFICATIONS,
  CONDITION_STATUSES,
  COURSE_STATUSES,
  fetchAudit,
  TERM_KINDS,
  type AuditUnavailable,
  type AuditWarning,
  type CapViolation,
  type CombinedMinimumCoverage,
  type CourseCoverage,
  type CreditCaps,
  type CreditSummary,
  type DegreeAudit,
  type GpaSummary,
  type GraduationCondition,
  type GraduationStatus,
  type GroupCoverage,
  type TermSummary,
  type UnmatchedCourse,
} from './api.js';
import { degreeAudit } from './testing/fixtures.js';

const all = <T extends string>(keys: readonly T[]) => Object.fromEntries(keys.map((key) => [key, 'required'])) as Record<T, 'required'>;

describe('degree audit types against the contract (F3, ADR 0013)', () => {
  it.each([
    [
      'CourseCoverageDto',
      all(['code', 'nameVi', 'nameEn', 'credits', 'countsTowardTotal', 'countsTowardGpa', 'status', 'result', 'grade', 'countedInGroupId']) satisfies Shape<CourseCoverage>,
    ],
    [
      'GroupCoverageDto',
      all([
        'id',
        'name',
        'kind',
        'requiredCredits',
        'passedCredits',
        'inProgressCredits',
        'overflowInCredits',
        'overflowOutCredits',
        'overflowToGroupId',
        'remainingCredits',
        'met',
        'courses',
      ]) satisfies Shape<GroupCoverage>,
    ],
    [
      'CombinedMinimumCoverageDto',
      all(['id', 'name', 'creditsMin', 'officialNotes', 'groupIds', 'credits', 'inProgressCredits', 'remainingCredits', 'met']) satisfies Shape<CombinedMinimumCoverage>,
    ],
    ['UnmatchedCourseDto', all(['code', 'name', 'credits', 'result', 'grade', 'passed', 'inProgress']) satisfies Shape<UnmatchedCourse>],
    ['CreditSummaryDto', all(['accumulated', 'towardTotal', 'inProgressTowardTotal', 'totalRequired', 'remaining', 'yearLevel']) satisfies Shape<CreditSummary>],
    ['GpaSummaryDto', all(['average', 'accumulatedAverage', 'accumulatedAverageFourPoint', 'classification', 'gradedCredits']) satisfies Shape<GpaSummary>],
    ['CreditCapsDto', all(['min', 'max']) satisfies Shape<CreditCaps>],
    ['CapViolationDto', all(['rule', 'credits', 'limit', 'citation', 'petition']) satisfies Shape<CapViolation>],
    [
      'TermSummaryDto',
      all([
        'term',
        'kind',
        'credits',
        'passedCredits',
        'average',
        'accumulatedAverage',
        'cumulativeAccumulatedAverage',
        'failedCourseCodes',
        'inProgressCourseCodes',
        'caps',
        'capViolations',
      ]) satisfies Shape<TermSummary>,
    ],
    ['GraduationConditionDto', all(['id', 'description', 'citation', 'status']) satisfies Shape<GraduationCondition>],
    ['GraduationStatusDto', all(['status', 'met', 'unmet', 'notChecked']) satisfies Shape<GraduationStatus>],
    ['AuditWarningDto', all(['code', 'courseCode', 'message', 'transcriptCredits', 'curriculumCredits']) satisfies Shape<AuditWarning>],
    [
      'DegreeAuditDto',
      all([
        'programCode',
        'trainingType',
        'cohortYear',
        'curriculumCode',
        'credits',
        'gpa',
        'terms',
        'groups',
        'combinedMinimums',
        'unmatchedCourses',
        'graduation',
        'warnings',
      ]) satisfies Shape<DegreeAudit>,
    ],
    ['AuditUnavailableDto', all(['statusCode', 'code', 'message']) satisfies Shape<AuditUnavailable>],
  ])('has the fields of %s', (schema, shape) => {
    expect(contractShape(schema)).toEqual(shape);
  });

  it.each([
    ['CourseCoverageDto', 'status', COURSE_STATUSES],
    ['GraduationConditionDto', 'status', CONDITION_STATUSES],
    ['GpaSummaryDto', 'classification', [...CLASSIFICATIONS, null]],
    ['TermSummaryDto', 'kind', [...TERM_KINDS, null]],
    ['CapViolationDto', 'rule', CAP_RULES],
    ['AuditWarningDto', 'code', AUDIT_WARNING_CODES],
    ['AuditUnavailableDto', 'code', AUDIT_UNAVAILABLE_CODES],
    ['GraduationStatusDto', 'status', ['done', 'not_yet']],
    ['CreditSummaryDto', 'yearLevel', [1, 2, 3, 4]],
  ] as const)('has the values of %s.%s', (schema, property, values) => {
    expect([...values].sort()).toEqual(contractEnum(schema, property));
  });
});

describe('fetchAudit', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reads the signed-in student’s audit with their token', async () => {
    const audit = degreeAudit();
    const fetch = mockApi({ 'GET /users/me/audit': audit });
    await expect(fetchAudit('zz-token')).resolves.toEqual({ status: 'ready', audit });
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/users/me/audit`, expect.objectContaining({ method: 'GET', headers: { Authorization: 'Bearer zz-token' } }));
  });

  it.each(AUDIT_UNAVAILABLE_CODES)('answers a 409 %s as a state of the account, not a failure', async (code) => {
    mockApi({ 'GET /users/me/audit': status(409, { statusCode: 409, code, message: 'Synthetic reason' }) });
    await expect(fetchAudit('zz-token')).resolves.toEqual({ status: code });
  });

  it('fails on a 409 it does not know, and on any other error', async () => {
    mockApi({ 'GET /users/me/audit': status(409, { statusCode: 409, code: 'something_else', message: 'x' }) });
    await expect(fetchAudit('zz-token')).rejects.toBeInstanceOf(HttpError);
    vi.restoreAllMocks();
    mockApi({ 'GET /users/me/audit': status(401) });
    await expect(fetchAudit('zz-token')).rejects.toMatchObject({ status: 401 });
    vi.restoreAllMocks();
    mockApi({ 'GET /users/me/audit': status(500) });
    await expect(fetchAudit('zz-token')).rejects.toMatchObject({ status: 500 });
  });
});
