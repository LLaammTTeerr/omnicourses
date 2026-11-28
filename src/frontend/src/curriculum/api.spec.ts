import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../api.js';
import { contractEnum, contractNullable, contractShape, nullableKeys, type Shape } from '../testing/contract.js';
import { signedInPinia } from '../testing/signed-in.js';
import {
  COURSE_READINESS_STATES,
  fetchCourse,
  fetchCurriculum,
  fetchCurriculumStanding,
  REQUIREMENT_GROUP_KINDS,
  TRAINING_TYPES,
  TRANSCRIPT_COURSE_STATUSES,
  type Course,
  type CourseDetail,
  type CourseMembership,
  type CourseStanding,
  type Curriculum,
  type CurriculumCourse,
  type CurriculumStanding,
  type Program,
  type ProgramList,
  type ProgramSummary,
  type RequirementGroup,
} from './api.js';
import { restoreMocksAfterCheckingCalls } from '../testing/fetch.js';

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

const NULLABLE: Record<string, string[]> = {
  ProgramSummaryDto: nullableKeys<ProgramSummary>({ faculty: true, nameEn: true, trainingType: true }),
  ProgramDto: nullableKeys<Program>({ faculty: true, nameEn: true, trainingType: true }),
  CourseDto: nullableKeys<Course>({ exercisePeriods: true, labPeriods: true, nameEn: true, projectPeriods: true, theoryPeriods: true }),
  CurriculumCourseDto: nullableKeys<CurriculumCourse>({ exercisePeriods: true, labPeriods: true, nameEn: true, offeringTerms: true, prerequisites: true, projectPeriods: true, theoryPeriods: true }),
  CourseDetailDto: nullableKeys<CourseDetail>({ exercisePeriods: true, labPeriods: true, nameEn: true, projectPeriods: true, theoryPeriods: true }),
  RequirementGroupDto: nullableKeys<RequirementGroup>({ creditsTotal: true, creditsTotalMin: true, officialNotes: true }),
  CurriculumDto: nullableKeys<Curriculum>({ language: true, nameEn: true, totalCreditsMin: true }),
  CourseStandingDto: nullableKeys<CourseStanding>({ readiness: true, transcriptStatus: true }),
};

describe('curriculum types against the contract (F4, ADR 0005)', () => {
  it.each([
    [
      'ProgramSummaryDto',
      { code: 'required', nameVi: 'required', nameEn: 'required', faculty: 'required', trainingType: 'required' } satisfies Shape<ProgramSummary>,
    ],
    [
      'ProgramDto',
      { code: 'required', nameVi: 'required', nameEn: 'required', faculty: 'required', trainingType: 'required', cohortYears: 'required' } satisfies Shape<Program>,
    ],
    ['ProgramListDto', { programs: 'required' } satisfies Shape<ProgramList>],
    ['CourseDto', course satisfies Shape<Course>],
    ['CurriculumCourseDto', { ...course, prerequisites: 'required', offeringTerms: 'required' } satisfies Shape<CurriculumCourse>],
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
    [
      'CourseStandingDto',
      {
        code: 'required',
        transcriptStatus: 'required',
        readiness: 'required',
        missingPrerequisites: 'required',
      } satisfies Shape<CourseStanding>,
    ],
    ['CurriculumStandingDto', { courses: 'required' } satisfies Shape<CurriculumStanding>],
  ])('has the fields of %s', (schema, shape) => {
    expect(contractShape(schema)).toEqual(shape);
    expect(contractNullable(schema)).toEqual(NULLABLE[schema] ?? []);
  });

  it('has the group kinds of the contract', () => {
    expect([...REQUIREMENT_GROUP_KINDS].sort()).toEqual(contractEnum('RequirementGroupDto', 'kind'));
  });

  it('has the training types and course standing enums of the contract', () => {
    expect([...TRAINING_TYPES, null].sort()).toEqual(contractEnum('ProgramSummaryDto', 'trainingType'));
    expect([...TRANSCRIPT_COURSE_STATUSES, null].sort()).toEqual(contractEnum('CourseStandingDto', 'transcriptStatus'));
    expect([...COURSE_READINESS_STATES, null].sort()).toEqual(contractEnum('CourseStandingDto', 'readiness'));
  });
});

describe('curriculum addresses', () => {
  beforeEach(() => signedInPinia());
  afterEach(() => restoreMocksAfterCheckingCalls());

  it('escapes what goes into the path and sends the token', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({}));
    await fetchCurriculum('A/B', 2024);
    await fetchCurriculumStanding('A/B', 2024);
    await fetchCourse('ZZ 101');
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      `${API_URL}/programs/A%2FB/curricula/2024`,
      `${API_URL}/programs/A%2FB/curricula/2024/standing`,
      `${API_URL}/courses/ZZ%20101`,
    ]);
    expect(fetch.mock.calls[0]![1]).toMatchObject({ method: 'GET', headers: { Authorization: 'Bearer zz-token' } });
  });
});
