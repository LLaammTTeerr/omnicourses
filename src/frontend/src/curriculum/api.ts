import { request } from '../api.js';

// The curriculum read DTOs of the API (F4, ADR 0005), written by hand; api.spec.ts checks them against
// src/backend/openapi.json. They carry only what the database stores: prerequisites and offering terms are null
// until F12 records them for a course of a curriculum (ADR 0011), and nothing here decides whether a student may
// take a course (the rule engine does).

export const TRAINING_TYPES = ['advanced', 'joint', 'high_quality', 'standard'] as const;
/** QĐ 1175 Điều 6.4, 7.2 (ADR 0012): it sets the terms and the credit caps. */
export type TrainingType = (typeof TRAINING_TYPES)[number];

export interface ProgramSummary {
  code: string;
  nameVi: string;
  nameEn: string | null;
  faculty: string | null;
  /** null: not recorded. */
  trainingType: TrainingType | null;
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

/** A course as a curriculum lists it, with the rules recorded for it in that curriculum. */
export interface CurriculumCourse extends Course {
  /** Codes that must all be passed first. null: not recorded (unknown, not "none"); []: recorded as none. */
  prerequisites: string[] | null;
  /** Term numbers (1, 2, 3) the course is offered in. null: not recorded. Never empty. */
  offeringTerms: number[] | null;
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
  courses: CurriculumCourse[];
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
