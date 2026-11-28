import type { Term } from '../terms/term.js';

export const TRAINING_TYPES = ['advanced', 'joint', 'high_quality', 'standard'] as const;
export type TrainingType = (typeof TRAINING_TYPES)[number];

export const REQUIREMENT_GROUP_KINDS = ['compulsory', 'elective'] as const;
export type RequirementGroupKind = (typeof REQUIREMENT_GROUP_KINDS)[number];

export interface CurriculumRuleCourse {
  code: string;
  nameVi: string;
  nameEn: string | null;
  credits: number;
  countsTowardTotal: boolean;
  countsTowardGpa: boolean;
}

export interface CurriculumRuleGroup {
  id: string;
  name: string;
  kind: RequirementGroupKind;
  creditsTotal: number | null;
  creditsTotalMin: number | null;
  overflowToGroupId: string | null;
  courses: CurriculumRuleCourse[];
}

export interface CurriculumRuleCombinedMinimum {
  id: string;
  name: string;
  creditsMin: number;
  officialNotes: string | null;
  groupIds: string[];
}

export interface CourseRules {
  prerequisites: Map<string, string[]>;
  offeringTerms: Map<string, Term['number'][]>;
}

export interface CurriculumRules extends CourseRules {
  programCode: string;
  trainingType: TrainingType | null;
  cohortYear: number;
  curriculumCode: string;
  totalCreditsMin: number | null;
  groups: CurriculumRuleGroup[];
  combinedMinimums: CurriculumRuleCombinedMinimum[];
}
