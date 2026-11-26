import { segment } from '../api.js';
import { requestAsUser } from '../auth/store.js';

export const TRAINING_TYPES = ['advanced', 'joint', 'high_quality', 'standard'] as const;
export type TrainingType = (typeof TRAINING_TYPES)[number];

export interface ProgramSummary {
  code: string;
  nameVi: string;
  nameEn: string | null;
  faculty: string | null;
  trainingType: TrainingType | null;
}

export interface Program extends ProgramSummary {
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

export interface CurriculumCourse extends Course {
  prerequisites: string[] | null;
  offeringTerms: number[] | null;
}

export const REQUIREMENT_GROUP_KINDS = ['compulsory', 'elective'] as const;
export type RequirementGroupKind = (typeof REQUIREMENT_GROUP_KINDS)[number];

export interface RequirementGroup {
  id: string;
  name: string;
  kind: RequirementGroupKind;
  creditsTotal: number | null;
  creditsTotalMin: number | null;
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

export const fetchPrograms = () => requestAsUser<ProgramList>('GET', '/programs');

export const fetchCurriculum = (program: string, cohort: number) =>
  requestAsUser<Curriculum>('GET', `/programs/${segment(program)}/curricula/${cohort}`);

export const fetchCourse = (code: string) => requestAsUser<CourseDetail>('GET', `/courses/${segment(code)}`);
