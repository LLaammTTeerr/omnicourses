import { request } from '../api.js';
import type {
  CourseDetailDto,
  CourseDto,
  CourseMembershipDto,
  CurriculumCourseDto,
  CurriculumDto,
  ProgramDto,
  ProgramListDto,
  ProgramSummaryDto,
  RequirementGroupDto,
} from '../api-schema/types.gen.js';

// The curriculum read DTOs of the API (F4, ADR 0005), generated from the contract (ADR 0018). They carry only what
// the database stores: prerequisites and offering terms are null until F12 records them for a course of a curriculum
// (ADR 0011), and nothing here decides whether a student may take a course (the rule engine does).

/** QĐ 1175 Điều 6.4, 7.2 (ADR 0012): it sets the terms and the credit caps. null in a DTO: not recorded. */
export type TrainingType = NonNullable<ProgramSummaryDto['trainingType']>;
export type RequirementGroupKind = RequirementGroupDto['kind'];

export type ProgramSummary = ProgramSummaryDto;
/** `cohortYears`: the cohorts that have a curriculum, oldest first. */
export type Program = ProgramDto;
export type ProgramList = ProgramListDto;
export type Course = CourseDto;
/** A course as a curriculum lists it, with the rules recorded for it in that curriculum. */
export type CurriculumCourse = CurriculumCourseDto;
export type RequirementGroup = RequirementGroupDto;
/** `requirementGroups` by name: the API stores no printed order. A course may sit in several groups. */
export type Curriculum = CurriculumDto;
export type CourseMembership = CourseMembershipDto;
export type CourseDetail = CourseDetailDto;

export const fetchPrograms = (token: string) => request<ProgramList>('GET', '/programs', { token });

/** 404: the program has no curriculum for this cohort. */
export const fetchCurriculum = (token: string, program: string, cohort: number) =>
  request<Curriculum>('GET', `/programs/${encodeURIComponent(program)}/curricula/${cohort}`, { token });

/** 404: no course has this code. */
export const fetchCourse = (token: string, code: string) => request<CourseDetail>('GET', `/courses/${encodeURIComponent(code)}`, { token });
