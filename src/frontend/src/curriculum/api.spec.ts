import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../api.js';
import { contractEnum, contractShape, type Shape } from '../testing/contract.js';
import {
  fetchCourse,
  fetchCurriculum,
  REQUIREMENT_GROUP_KINDS,
  type Course,
  type CourseDetail,
  type CourseMembership,
  type Curriculum,
  type Program,
  type ProgramList,
  type ProgramSummary,
  type RequirementGroup,
} from './api.js';

const course = {
  code: 'required',
  nameVi: 'required',
  nameEn: 'required',
  credits: 'required',
  theoryPeriods: 'required',
  labPeriods: 'required',
  exercisePeriods: 'required',
  projectPeriods: 'required',
} as const;

describe('curriculum types against the contract (F4, ADR 0005)', () => {
  it.each([
    ['ProgramSummaryDto', { code: 'required', nameVi: 'required', nameEn: 'required', faculty: 'required' } satisfies Shape<ProgramSummary>],
    ['ProgramDto', { code: 'required', nameVi: 'required', nameEn: 'required', faculty: 'required', cohortYears: 'required' } satisfies Shape<Program>],
    ['ProgramListDto', { programs: 'required' } satisfies Shape<ProgramList>],
    ['CourseDto', course satisfies Shape<Course>],
    ['CourseDetailDto', { ...course, memberships: 'required' } satisfies Shape<CourseDetail>],
    [
      'CourseMembershipDto',
      {
        programCode: 'required',
        cohortYear: 'required',
        curriculumCode: 'required',
        requirementGroupId: 'required',
        requirementGroupName: 'required',
        kind: 'required',
      } satisfies Shape<CourseMembership>,
    ],
    [
      'RequirementGroupDto',
      {
        id: 'required',
        name: 'required',
        kind: 'required',
        creditsTotal: 'required',
        creditsTotalMin: 'required',
        officialNotes: 'required',
        courses: 'required',
      } satisfies Shape<RequirementGroup>,
    ],
    [
      'CurriculumDto',
      {
        id: 'required',
        code: 'required',
        program: 'required',
        cohortYear: 'required',
        nameVi: 'required',
        nameEn: 'required',
        language: 'required',
        totalCreditsMin: 'required',
        requirementGroups: 'required',
      } satisfies Shape<Curriculum>,
    ],
  ])('has the fields of %s', (schema, shape) => {
    expect(contractShape(schema)).toEqual(shape);
  });

  it('has the group kinds of the contract', () => {
    expect([...REQUIREMENT_GROUP_KINDS].sort()).toEqual(contractEnum('RequirementGroupDto', 'kind'));
  });
});

describe('curriculum addresses', () => {
  afterEach(() => vi.restoreAllMocks());

  it('escapes what goes into the path and sends the token', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({}));
    await fetchCurriculum('zz-token', 'A/B', 2024);
    await fetchCourse('zz-token', 'ZZ 101');
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([`${API_URL}/programs/A%2FB/curricula/2024`, `${API_URL}/courses/ZZ%20101`]);
    expect(fetch.mock.calls[0]![1]).toMatchObject({ method: 'GET', headers: { Authorization: 'Bearer zz-token' } });
  });
});
