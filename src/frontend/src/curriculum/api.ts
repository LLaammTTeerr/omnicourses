import { request } from '../api.js';

// The curriculum read DTOs of the API (F4, ADR 0005), written by hand; api.spec.ts checks them against
// src/backend/openapi.json. They carry only what the database stores: no prerequisites and no offering terms yet
// (ADR 0011), so nothing here can say whether a student may take a course.

export interface ProgramSummary {
  code: string;
  nameVi: string;
  nameEn: string | null;
  faculty: string | null;
}

export interface Program extends ProgramSummary {
  /** The cohorts that have a curriculum, oldest first. */
  cohortYears: number[];
}

export interface ProgramList {
  programs: Program[];
}

export interface Course {
  code: string;
  nameVi: string;
  nameEn: string | null;
  credits: number;
  theoryPeriods: number | null;
  labPeriods: number | null;
  exercisePeriods: number | null;
  projectPeriods: number | null;
}

export const REQUIREMENT_GROUP_KINDS = ['compulsory', 'elective'] as const;
export type RequirementGroupKind = (typeof REQUIREMENT_GROUP_KINDS)[number];

export interface RequirementGroup {
  id: string;
  /** The heading as printed in the official curriculum. */
  name: string;
  kind: RequirementGroupKind;
  creditsTotal: number | null;
  creditsTotalMin: number | null;
  /** The printed rule, for rules the columns cannot express. */
  officialNotes: string | null;
  courses: Course[];
}

export interface Curriculum {
  id: string;
  code: string;
  program: ProgramSummary;
  cohortYear: number;
  nameVi: string;
  nameEn: string | null;
  language: string | null;
  totalCreditsMin: number | null;
  /** By name: the API stores no printed order. A course may sit in several groups. */
  requirementGroups: RequirementGroup[];
}

export interface CourseMembership {
  programCode: string;
  cohortYear: number;
  curriculumCode: string;
  requirementGroupId: string;
  requirementGroupName: string;
  kind: RequirementGroupKind;
}

export interface CourseDetail extends Course {
  memberships: CourseMembership[];
}

export const fetchPrograms = (token: string) => request<ProgramList>('GET', '/programs', { token });

/** 404: the program has no curriculum for this cohort. */
export const fetchCurriculum = (token: string, program: string, cohort: number) =>
  request<Curriculum>('GET', `/programs/${encodeURIComponent(program)}/curricula/${cohort}`, { token });

/** 404: no course has this code. */
export const fetchCourse = (token: string, code: string) => request<CourseDetail>('GET', `/courses/${encodeURIComponent(code)}`, { token });
