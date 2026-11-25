import { afterEach, describe, expect, it, vi } from 'vitest';
import contract from '../../../backend/openapi.json';
import { API_URL } from '../api.js';
import { contractEnum, contractShape, type Shape } from '../testing/contract.js';
import * as api from './api.js';
import {
  GLOBAL_PERMISSIONS,
  PERMISSION_KINDS,
  type AccessProgram,
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

  it('has the permissions of the contract', () => {
    expect([...GLOBAL_PERMISSIONS].sort()).toEqual(contractEnum('GlobalGrantDto', 'permission'));
    expect([...PERMISSION_KINDS].sort()).toEqual(contractEnum('PermissionRequiredDto', 'permission'));
  });
});

// Synthetic IDs and codes (AGENTS.md hard rule 3).
const TOKEN = 'zz-token';
const COHORT = { programId: '00000000-0000-4000-8000-0000000000a1', curriculumId: '00000000-0000-4000-8000-0000000000c1' };
const GROUP = '00000000-0000-4000-8000-000000000a01';
const USER = '00000000-0000-4000-8000-000000000002';

/** Every call of api.ts, with the method and the contract path it must reach. */
const CALLS: [name: string, call: () => Promise<unknown>, method: string, path: string][] = [
  ['fetchOwnGrants', () => api.fetchOwnGrants(TOKEN), 'get', '/api/admin/grants'],
  ['fetchAdminPrograms', () => api.fetchAdminPrograms(TOKEN), 'get', '/api/admin/programs'],
  ['createGroup', () => api.createGroup(TOKEN, COHORT, { name: 'Nhóm thử', kind: 'elective' }), 'post', '/api/admin/programs/{programId}/cohorts/{curriculumId}/requirement-groups'],
  ['updateGroup', () => api.updateGroup(TOKEN, COHORT, GROUP, { name: 'Nhóm thử' }), 'patch', '/api/admin/programs/{programId}/cohorts/{curriculumId}/requirement-groups/{groupId}'],
  ['deleteGroup', () => api.deleteGroup(TOKEN, COHORT, GROUP), 'delete', '/api/admin/programs/{programId}/cohorts/{curriculumId}/requirement-groups/{groupId}'],
  ['linkCourse', () => api.linkCourse(TOKEN, COHORT, GROUP, 'ZZ101'), 'put', '/api/admin/programs/{programId}/cohorts/{curriculumId}/requirement-groups/{groupId}/courses/{courseCode}'],
  ['unlinkCourse', () => api.unlinkCourse(TOKEN, COHORT, GROUP, 'ZZ101'), 'delete', '/api/admin/programs/{programId}/cohorts/{curriculumId}/requirement-groups/{groupId}/courses/{courseCode}'],
  ['setPrerequisites', () => api.setPrerequisites(TOKEN, COHORT, 'ZZ102', ['ZZ101']), 'put', '/api/admin/programs/{programId}/cohorts/{curriculumId}/courses/{courseCode}/prerequisites'],
  ['clearPrerequisites', () => api.clearPrerequisites(TOKEN, COHORT, 'ZZ102'), 'delete', '/api/admin/programs/{programId}/cohorts/{curriculumId}/courses/{courseCode}/prerequisites'],
  ['setOfferingTerms', () => api.setOfferingTerms(TOKEN, COHORT, 'ZZ102', [1, 3]), 'put', '/api/admin/programs/{programId}/cohorts/{curriculumId}/courses/{courseCode}/offering-terms'],
  ['clearOfferingTerms', () => api.clearOfferingTerms(TOKEN, COHORT, 'ZZ102'), 'delete', '/api/admin/programs/{programId}/cohorts/{curriculumId}/courses/{courseCode}/offering-terms'],
  ['createCourse', () => api.createCourse(TOKEN, { code: 'ZZ101', nameVi: 'Môn thử', credits: 4 }), 'post', '/api/admin/catalog/courses'],
  ['updateCourse', () => api.updateCourse(TOKEN, 'ZZ101', { credits: 3 }), 'patch', '/api/admin/catalog/courses/{courseCode}'],
  ['deleteCourse', () => api.deleteCourse(TOKEN, 'ZZ101'), 'delete', '/api/admin/catalog/courses/{courseCode}'],
  ['fetchAccessPrograms', () => api.fetchAccessPrograms(TOKEN), 'get', '/api/admin/access/programs'],
  ['fetchUserGrants', () => api.fetchUserGrants(TOKEN, USER), 'get', '/api/admin/access/users/{userId}/grants'],
  ['grantProgram', () => api.grantProgram(TOKEN, USER, COHORT.programId), 'put', '/api/admin/access/users/{userId}/programs/{programId}'],
  ['revokeProgram', () => api.revokeProgram(TOKEN, USER, COHORT.programId), 'delete', '/api/admin/access/users/{userId}/programs/{programId}'],
  ['grantGlobal', () => api.grantGlobal(TOKEN, USER, 'catalog_maintainer'), 'put', '/api/admin/access/users/{userId}/global/{permission}'],
  ['revokeGlobal', () => api.revokeGlobal(TOKEN, USER, 'access_manager'), 'delete', '/api/admin/access/users/{userId}/global/{permission}'],
];

const paths = contract.paths as Record<string, Record<string, unknown>>;
const matches = (template: string, url: string) => new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}$`).test(url);

describe('administration addresses against the contract', () => {
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
    // No other route of the contract takes this address: the call cannot land on a neighbour.
    expect(Object.keys(paths).filter((other) => matches(other, sent) && Object.hasOwn(paths[other]!, method))).toEqual([path]);
  });

  it('calls every function this module exports', () => {
    const functions = Object.entries(api).filter(([, value]) => typeof value === 'function').map(([name]) => name);
    expect(functions.sort()).toEqual(CALLS.map(([name]) => name).sort());
  });

  it('sends the bodies the API documents', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({}));
    await api.setPrerequisites(TOKEN, COHORT, 'ZZ102', []);
    await api.setOfferingTerms(TOKEN, COHORT, 'ZZ102', [2]);
    await api.updateCourse(TOKEN, 'ZZ101', { credits: 3, confirmImpact: 'zz-review' });
    await api.grantGlobal(TOKEN, USER, 'access_manager');
    expect(fetch.mock.calls.map(([, init]) => init?.body)).toEqual(['{"prerequisites":[]}', '{"terms":[2]}', '{"credits":3,"confirmImpact":"zz-review"}', undefined]);
  });

  it('keeps a typed value one path segment, whatever it holds', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({}));
    await api.linkCourse(TOKEN, COHORT, GROUP, ' zz 1/01 ');
    // Only dots would be read by the browser as "the folder above": the API gets it as a value, and refuses it.
    await api.linkCourse(TOKEN, COHORT, GROUP, '..');
    await api.fetchUserGrants(TOKEN, '.');
    const base = `${API_URL}/admin/programs/${COHORT.programId}/cohorts/${COHORT.curriculumId}/requirement-groups/${GROUP}/courses`;
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([`${base}/%20zz%201%2F01%20`, `${base}/..%20`, `${API_URL}/admin/access/users/.%20/grants`]);
  });
});
