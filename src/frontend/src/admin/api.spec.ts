import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import contract from '../../../backend/openapi.json';
import { API_URL } from '../api.js';
import { contractEnum, contractShape, type Shape } from '../testing/contract.js';
import { signedInPinia } from '../testing/signed-in.js';
import * as api from './api.js';
import { COURSE_CODE_PATTERN as API_COURSE_CODE_PATTERN } from '../../../backend/src/common/course-code.js';
import { COURSE_CODE_PATTERN } from '../course-code.js';
import {
  BYTES_PER_MIB,
  GLOBAL_PERMISSIONS,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_RECORDS,
  PERMISSION_KINDS,
  IMPORT_HEADERS,
  type AccessProgram,
  type CatalogImportPreview,
  type CatalogImportRow,
  type CohortDetails,
  type CohortList,
  type CreateCohortBody,
  type CreateProgramBody,
  type GroupLinkImportPreview,
  type GroupLinkImportRow,
  type ImportConfirmBody,
  type ImportPreviewBody,
  type ImportRejectedBody,
  type ImportResult,
  type ImportRowError,
  type ImportSummary,
  type ProgramDetails,
  type UpdateCohortBody,
  type UpdateProgramBody,
  type AccessProgramList,
  type AdminCurriculum,
  type AdminErrorBody,
  type AdminGroup,
  type AdminProgram,
  type AdminProgramList,
  type AffectedCurriculum,
  type CreateCourseBody,
  type CreateGroupBody,
  type GlobalGrant,
  type ImpactConfirmationBody,
  type OfferingTerms,
  type PermissionRequiredBody,
  type PrerequisiteCycleBody,
  type Prerequisites,
  type ProgramGrant,
  type ReferencedItemBody,
  type SetOfferingTermsBody,
  type SetPrerequisitesBody,
  type UpdateCourseBody,
  type UpdateGroupBody,
  type UserGrants,
} from './api.js';

const error = { statusCode: 'required', code: 'required', message: 'required' } as const;
const periods = { theoryPeriods: 'optional', labPeriods: 'optional', exercisePeriods: 'optional', projectPeriods: 'optional' } as const;

describe('administration types against the contract (F12, ADR 0011)', () => {
  it.each([
    ['UserGrantsDto', { userId: 'required', programs: 'required', permissions: 'required' } satisfies Shape<UserGrants>],
    ['ProgramGrantDto', { programId: 'required', programCode: 'required', grantedAt: 'required', grantedBy: 'required' } satisfies Shape<ProgramGrant>],
    ['GlobalGrantDto', { permission: 'required', grantedAt: 'required', grantedBy: 'required' } satisfies Shape<GlobalGrant>],
    ['AdminProgramListDto', { programs: 'required' } satisfies Shape<AdminProgramList>],
    ['AdminProgramDto', { id: 'required', code: 'required', nameVi: 'required', curricula: 'required' } satisfies Shape<AdminProgram>],
    ['AdminCurriculumDto', { id: 'required', code: 'required', cohortYear: 'required' } satisfies Shape<AdminCurriculum>],
    ['CreateRequirementGroupDto', { name: 'required', kind: 'required', officialNotes: 'optional' } satisfies Shape<CreateGroupBody>],
    ['UpdateRequirementGroupDto', { name: 'optional', kind: 'optional', officialNotes: 'optional' } satisfies Shape<UpdateGroupBody>],
    [
      'RequirementGroupAdminDto',
      {
        id: 'required',
        curriculumId: 'required',
        name: 'required',
        kind: 'required',
        officialNotes: 'required',
        creditsTotal: 'required',
        creditsTotalMin: 'required',
        updatedAt: 'required',
      } satisfies Shape<AdminGroup>,
    ],
    ['SetPrerequisitesDto', { prerequisites: 'required' } satisfies Shape<SetPrerequisitesBody>],
    ['PrerequisitesDto', { courseCode: 'required', prerequisites: 'required' } satisfies Shape<Prerequisites>],
    ['SetOfferingTermsDto', { terms: 'required' } satisfies Shape<SetOfferingTermsBody>],
    ['OfferingTermsDto', { courseCode: 'required', terms: 'required' } satisfies Shape<OfferingTerms>],
    ['CreateCourseDto', { code: 'required', nameVi: 'required', nameEn: 'optional', credits: 'required', ...periods } satisfies Shape<CreateCourseBody>],
    ['UpdateCourseDto', { nameVi: 'optional', nameEn: 'optional', credits: 'optional', ...periods, confirmImpact: 'optional' } satisfies Shape<UpdateCourseBody>],
    ['CreateProgramDto', { code: 'required', nameVi: 'required', nameEn: 'optional', faculty: 'optional' } satisfies Shape<CreateProgramBody>],
    ['UpdateProgramDto', { nameVi: 'optional', nameEn: 'optional', faculty: 'optional' } satisfies Shape<UpdateProgramBody>],
    [
      'ProgramDetailsDto',
      { id: 'required', code: 'required', nameVi: 'required', nameEn: 'required', faculty: 'required', trainingType: 'required', updatedAt: 'required' } satisfies Shape<ProgramDetails>,
    ],
    ['CreateCohortDto', { cohortYear: 'required', code: 'required', nameVi: 'required', nameEn: 'optional', language: 'optional' } satisfies Shape<CreateCohortBody>],
    ['UpdateCohortDto', { nameVi: 'optional', nameEn: 'optional', language: 'optional' } satisfies Shape<UpdateCohortBody>],
    [
      'CohortDetailsDto',
      {
        id: 'required',
        programId: 'required',
        cohortYear: 'required',
        code: 'required',
        nameVi: 'required',
        nameEn: 'required',
        language: 'required',
        totalCreditsMin: 'required',
        updatedAt: 'required',
      } satisfies Shape<CohortDetails>,
    ],
    ['CohortListDto', { cohorts: 'required' } satisfies Shape<CohortList>],
    ['ImportPreviewRequestDto', { csv: 'required' } satisfies Shape<ImportPreviewBody>],
    ['ImportConfirmRequestDto', { csv: 'required', reviewVersion: 'required' } satisfies Shape<ImportConfirmBody>],
    ['ImportRowErrorDto', { record: 'required', field: 'required', message: 'required' } satisfies Shape<ImportRowError>],
    ['ImportSummaryDto', { inserts: 'required', updates: 'required', noOps: 'required' } satisfies Shape<ImportSummary>],
    [
      'CatalogImportRowDto',
      {
        code: 'required',
        nameVi: 'required',
        nameEn: 'required',
        credits: 'required',
        theoryPeriods: 'required',
        labPeriods: 'required',
        exercisePeriods: 'required',
        projectPeriods: 'required',
        record: 'required',
        action: 'required',
        changedFields: 'required',
        current: 'required',
        affectedCurricula: 'required',
      } satisfies Shape<CatalogImportRow>,
    ],
    [
      'CatalogImportPreviewDto',
      { errors: 'required', summary: 'required', reviewVersion: 'required', fileType: 'required', rows: 'required', affectedCurricula: 'required' } satisfies Shape<CatalogImportPreview>,
    ],
    ['GroupLinkImportRowDto', { record: 'required', action: 'required', requirementGroupName: 'required', requirementGroupId: 'required', courseCode: 'required' } satisfies Shape<GroupLinkImportRow>],
    [
      'GroupLinkImportPreviewDto',
      {
        errors: 'required',
        summary: 'required',
        reviewVersion: 'required',
        fileType: 'required',
        programId: 'required',
        curriculumId: 'required',
        rows: 'required',
      } satisfies Shape<GroupLinkImportPreview>,
    ],
    ['ImportResultDto', { fileType: 'required', summary: 'required' } satisfies Shape<ImportResult>],
    ['ImportRejectedDto', { ...error, errors: 'optional' } satisfies Shape<ImportRejectedBody>],
    ['AccessProgramListDto', { programs: 'required' } satisfies Shape<AccessProgramList>],
    ['AccessProgramDto', { id: 'required', code: 'required', nameVi: 'required' } satisfies Shape<AccessProgram>],
    ['AdminErrorDto', error satisfies Shape<AdminErrorBody>],
    ['PermissionRequiredDto', { ...error, permission: 'required' } satisfies Shape<PermissionRequiredBody>],
    ['PrerequisiteCycleDto', { ...error, cycle: 'required' } satisfies Shape<PrerequisiteCycleBody>],
    ['ReferencedItemDto', { ...error, references: 'required' } satisfies Shape<ReferencedItemBody>],
    ['AffectedCurriculumDto', { curriculumId: 'required', curriculumCode: 'required', programCode: 'required', cohortYear: 'required' } satisfies Shape<AffectedCurriculum>],
    ['ImpactConfirmationDto', { ...error, affectedCurricula: 'required', reviewVersion: 'required' } satisfies Shape<ImpactConfirmationBody>],
  ])('has the fields of %s', (schema, shape) => {
    expect(contractShape(schema)).toEqual(shape);
  });

  it('offers the exact header of each file type, as each preview route names it', () => {
    const summary = (path: string) => (contract.paths as Record<string, { post?: { summary?: string } }>)[path]!.post!.summary!;
    expect(summary('/api/admin/catalog/imports/preview').endsWith(`Header: ${IMPORT_HEADERS.catalog_courses.join(',')}`)).toBe(true);
    expect(summary('/api/admin/programs/{programId}/cohorts/{curriculumId}/imports/preview').endsWith(`Header: ${IMPORT_HEADERS.group_links.join(',')}`)).toBe(true);
    expect(contractEnum('CatalogImportRowDto', 'action')).toEqual(['insert', 'no_op', 'update']);
    expect(contractEnum('GroupLinkImportRowDto', 'action')).toEqual(['insert', 'no_op']);
  });

  it('checks a file against the limits the import routes document', () => {
    const csv = contract.components.schemas.ImportPreviewRequestDto.properties.csv.description;
    expect(csv).toContain(`At most ${IMPORT_MAX_BYTES / BYTES_PER_MIB} MiB and ${IMPORT_MAX_RECORDS.toLocaleString('en-GB')} data records.`);
  });

  it('checks a course code with the pattern the API checks', () => {
    expect(COURSE_CODE_PATTERN.source).toBe(API_COURSE_CODE_PATTERN.source);
    expect(COURSE_CODE_PATTERN.flags).toBe(API_COURSE_CODE_PATTERN.flags);
  });

  it('has the permissions of the contract', () => {
    expect([...GLOBAL_PERMISSIONS].sort()).toEqual(contractEnum('GlobalGrantDto', 'permission'));
    expect([...PERMISSION_KINDS].sort()).toEqual(contractEnum('PermissionRequiredDto', 'permission'));
  });
});

const TOKEN = 'zz-token';
const COHORT = { programId: '00000000-0000-4000-8000-0000000000a1', curriculumId: '00000000-0000-4000-8000-0000000000c1' };
const GROUP = '00000000-0000-4000-8000-000000000a01';
const USER = '00000000-0000-4000-8000-000000000002';

const CALLS: [name: string, call: () => Promise<unknown>, method: string, path: string][] = [
  ['fetchOwnGrants', () => api.fetchOwnGrants(), 'get', '/api/admin/grants'],
  ['fetchAdminPrograms', () => api.fetchAdminPrograms(), 'get', '/api/admin/programs'],
  ['createGroup', () => api.createGroup(COHORT, { name: 'Nhóm thử', kind: 'elective' }), 'post', '/api/admin/programs/{programId}/cohorts/{curriculumId}/requirement-groups'],
  ['updateGroup', () => api.updateGroup(COHORT, GROUP, { name: 'Nhóm thử' }), 'patch', '/api/admin/programs/{programId}/cohorts/{curriculumId}/requirement-groups/{groupId}'],
  ['deleteGroup', () => api.deleteGroup(COHORT, GROUP), 'delete', '/api/admin/programs/{programId}/cohorts/{curriculumId}/requirement-groups/{groupId}'],
  ['linkCourse', () => api.linkCourse(COHORT, GROUP, 'ZZ101'), 'put', '/api/admin/programs/{programId}/cohorts/{curriculumId}/requirement-groups/{groupId}/courses/{courseCode}'],
  ['unlinkCourse', () => api.unlinkCourse(COHORT, GROUP, 'ZZ101'), 'delete', '/api/admin/programs/{programId}/cohorts/{curriculumId}/requirement-groups/{groupId}/courses/{courseCode}'],
  ['setPrerequisites', () => api.setPrerequisites(COHORT, 'ZZ102', ['ZZ101']), 'put', '/api/admin/programs/{programId}/cohorts/{curriculumId}/courses/{courseCode}/prerequisites'],
  ['clearPrerequisites', () => api.clearPrerequisites(COHORT, 'ZZ102'), 'delete', '/api/admin/programs/{programId}/cohorts/{curriculumId}/courses/{courseCode}/prerequisites'],
  ['setOfferingTerms', () => api.setOfferingTerms(COHORT, 'ZZ102', [1, 3]), 'put', '/api/admin/programs/{programId}/cohorts/{curriculumId}/courses/{courseCode}/offering-terms'],
  ['clearOfferingTerms', () => api.clearOfferingTerms(COHORT, 'ZZ102'), 'delete', '/api/admin/programs/{programId}/cohorts/{curriculumId}/courses/{courseCode}/offering-terms'],
  ['createCourse', () => api.createCourse({ code: 'ZZ101', nameVi: 'Môn thử', credits: 4 }), 'post', '/api/admin/catalog/courses'],
  ['updateCourse', () => api.updateCourse('ZZ101', { credits: 3 }), 'patch', '/api/admin/catalog/courses/{courseCode}'],
  ['deleteCourse', () => api.deleteCourse('ZZ101'), 'delete', '/api/admin/catalog/courses/{courseCode}'],
  ['createProgram', () => api.createProgram({ code: 'ZZ-NEW', nameVi: 'Chương trình thử' }), 'post', '/api/admin/programs'],
  ['updateProgram', () => api.updateProgram(COHORT.programId, { faculty: null }), 'patch', '/api/admin/programs/{programId}'],
  ['fetchCohorts', () => api.fetchCohorts(COHORT.programId), 'get', '/api/admin/programs/{programId}/cohorts'],
  ['createCohort', () => api.createCohort(COHORT.programId, { cohortYear: 2026, code: 'ZZ-NEW-2026', nameVi: 'Khóa thử' }), 'post', '/api/admin/programs/{programId}/cohorts'],
  ['fetchCohort', () => api.fetchCohort(COHORT), 'get', '/api/admin/programs/{programId}/cohorts/{curriculumId}'],
  ['updateCohort', () => api.updateCohort(COHORT, { language: 'en' }), 'patch', '/api/admin/programs/{programId}/cohorts/{curriculumId}'],
  ['previewCatalogImport', () => api.previewCatalogImport('x'), 'post', '/api/admin/catalog/imports/preview'],
  ['confirmCatalogImport', () => api.confirmCatalogImport('x', 'zz-review'), 'post', '/api/admin/catalog/imports/confirm'],
  ['previewLinkImport', () => api.previewLinkImport(COHORT, 'x'), 'post', '/api/admin/programs/{programId}/cohorts/{curriculumId}/imports/preview'],
  ['confirmLinkImport', () => api.confirmLinkImport(COHORT, 'x', 'zz-review'), 'post', '/api/admin/programs/{programId}/cohorts/{curriculumId}/imports/confirm'],
  ['fetchAccessPrograms', () => api.fetchAccessPrograms(), 'get', '/api/admin/access/programs'],
  ['fetchUserGrants', () => api.fetchUserGrants(USER), 'get', '/api/admin/access/users/{userId}/grants'],
  ['grantProgram', () => api.grantProgram(USER, COHORT.programId), 'put', '/api/admin/access/users/{userId}/programs/{programId}'],
  ['revokeProgram', () => api.revokeProgram(USER, COHORT.programId), 'delete', '/api/admin/access/users/{userId}/programs/{programId}'],
  ['grantGlobal', () => api.grantGlobal(USER, 'catalog_maintainer'), 'put', '/api/admin/access/users/{userId}/global/{permission}'],
  ['revokeGlobal', () => api.revokeGlobal(USER, 'access_manager'), 'delete', '/api/admin/access/users/{userId}/global/{permission}'],
];

const paths = contract.paths as Record<string, Record<string, unknown>>;
const matches = (template: string, url: string) => new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}$`).test(url);

describe('administration addresses against the contract', () => {
  beforeEach(() => signedInPinia());
  afterEach(() => vi.restoreAllMocks());

  it.each(CALLS)('%s calls a route the API serves, with the token', async (_name, call, method, path) => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({}));
    await call();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    const sent = `/api${String(url).slice(API_URL.length)}`;
    expect(init).toMatchObject({ method: method.toUpperCase(), headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }) });
    expect(paths[path], `the contract has no ${path}`).toBeDefined();
    expect(Object.keys(paths[path]!)).toContain(method);
    expect(matches(path, sent), `${sent} is not ${path}`).toBe(true);
    expect(Object.keys(paths).filter((other) => matches(other, sent) && Object.hasOwn(paths[other]!, method))).toEqual([path]);
  });

  it('calls every function this module exports', () => {
    const functions = Object.entries(api).filter(([, value]) => typeof value === 'function').map(([name]) => name);
    expect(functions.sort()).toEqual(CALLS.map(([name]) => name).sort());
  });

  it('sends the bodies the API documents', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({}));
    await api.setPrerequisites(COHORT, 'ZZ102', []);
    await api.setOfferingTerms(COHORT, 'ZZ102', [2]);
    await api.updateCourse('ZZ101', { credits: 3, confirmImpact: 'zz-review' });
    await api.grantGlobal(USER, 'access_manager');
    await api.previewLinkImport(COHORT, 'a,b\n');
    await api.confirmCatalogImport('a,b\n', 'zz-review');
    expect(fetch.mock.calls.map(([, init]) => init?.body)).toEqual([
      '{"prerequisites":[]}',
      '{"terms":[2]}',
      '{"credits":3,"confirmImpact":"zz-review"}',
      undefined,
      JSON.stringify({ csv: 'a,b\n' }),
      JSON.stringify({ csv: 'a,b\n', reviewVersion: 'zz-review' }),
    ]);
  });

  it('keeps a typed value one path segment, whatever it holds', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({}));
    await api.linkCourse(COHORT, GROUP, ' zz 1/01 ');
    await api.linkCourse(COHORT, GROUP, '..');
    await api.fetchUserGrants('.');
    const base = `${API_URL}/admin/programs/${COHORT.programId}/cohorts/${COHORT.curriculumId}/requirement-groups/${GROUP}/courses`;
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([`${base}/%20zz%201%2F01%20`, `${base}/..%20`, `${API_URL}/admin/access/users/.%20/grants`]);
  });
});
