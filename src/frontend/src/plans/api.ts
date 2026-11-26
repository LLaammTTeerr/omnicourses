import { segment } from '../api.js';
import { requestAsUser } from '../auth/store.js';
import type { RequirementGroupKind, TrainingType } from '../curriculum/api.js';
import type { Term } from '../terms.js';

export const PLACEMENT_KINDS = ['course', 'slot'] as const;
export type PlacementKind = (typeof PLACEMENT_KINDS)[number];

export interface Placement {
  kind: PlacementKind;
  courseCode?: string | null;
  requirementGroupId?: string | null;
  credits?: number | null;
}

export interface PlanTerm {
  term: Term;
  placements: Placement[];
}

export interface PlanCurriculum {
  id: string;
  code: string;
  programCode: string;
  cohortYear: number;
}

export interface PlanSummary {
  id: string;
  name: string;
  curriculum: PlanCurriculum;
  createdAt: string;
  updatedAt: string;
}

export interface Plan extends PlanSummary {
  terms: PlanTerm[];
}

export interface PlanPreview {
  termCount: number;
  courseCount: number;
  slotCount: number;
  firstTerm: Term | null;
  lastTerm: Term | null;
}

export interface PlanListItem extends PlanSummary {
  preview: PlanPreview;
}

export interface PlanList {
  plans: PlanListItem[];
}

export interface CreatePlanBody {
  name: string;
  programCode: string;
  cohortYear: number;
  terms?: PlanTerm[];
}

export const PLAN_ISSUE_CODES = [
  'prerequisite_not_met',
  'prerequisites_not_recorded',
  'not_offered',
  'offering_terms_not_recorded',
  'load_below_minimum',
  'load_above_maximum',
  'caps_not_checked',
  'load_not_checked',
  'placed_twice',
  'already_passed',
  'already_in_progress',
  'not_in_curriculum',
  'credits_not_recorded',
  'requirement_not_covered',
] as const;
export type PlanIssueCode = (typeof PLAN_ISSUE_CODES)[number];

export const PLAN_ISSUE_KINDS = ['violation', 'flag', 'unknown'] as const;
export type PlanIssueKind = (typeof PLAN_ISSUE_KINDS)[number];

export interface PlanIssue {
  code: PlanIssueCode;
  kind: PlanIssueKind;
  term: Term | null;
  position: number | null;
  courseCode: string | null;
  requirementGroupId: string | null;
  combinedMinimumId: string | null;
  missingCourseCodes: string[];
  offeredTermNumbers: number[];
  credits: number | null;
  limit: number | null;
  citation: string;
  message: string;
}

export interface CreditCaps {
  min: number | null;
  max: number;
}

export const TERM_KINDS = ['main', 'summer'] as const;
export type TermKind = (typeof TERM_KINDS)[number];

export interface PlanTermLoad {
  term: Term;
  kind: TermKind | null;
  credits: number;
  caps: CreditCaps | null;
}

export interface PlanGroupCoverage {
  id: string;
  name: string;
  kind: RequirementGroupKind;
  requiredCredits: number | null;
  credits: number;
  remainingCredits: number | null;
  met: boolean;
}

export interface PlanCombinedMinimumCoverage {
  id: string;
  name: string;
  creditsMin: number;
  credits: number;
  remainingCredits: number;
  met: boolean;
}

export interface PlanCoverage {
  groups: PlanGroupCoverage[];
  combinedMinimums: PlanCombinedMinimumCoverage[];
  totalRequired: number | null;
  totalCredits: number;
  totalRemaining: number | null;
  graduation: 'done' | 'not_yet';
}

export interface PlanIssues {
  planId: string;
  trainingType: TrainingType | null;
  terms: PlanTermLoad[];
  issues: PlanIssue[];
  coverage: PlanCoverage;
}

const path = (id: string) => `/plans/${segment(id)}`;

export const fetchPlans = () => requestAsUser<PlanList>('GET', '/plans');

export const createPlan = (body: CreatePlanBody) => requestAsUser<Plan>('POST', '/plans', { body });

export const fetchPlan = (id: string) => requestAsUser<Plan>('GET', path(id));

export const renamePlan = (id: string, name: string) => requestAsUser<Plan>('PATCH', path(id), { body: { name } });

export const duplicatePlan = (id: string, name: string) => requestAsUser<Plan>('POST', `${path(id)}/duplicate`, { body: { name } });

export const deletePlan = (id: string) => requestAsUser<void>('DELETE', path(id));

export const savePlacements = (id: string, terms: PlanTerm[]) => requestAsUser<Plan>('PUT', `${path(id)}/placements`, { body: { terms } });

export const fetchPlanIssues = (id: string) => requestAsUser<PlanIssues>('GET', `${path(id)}/issues`);

export interface PlanDropPreview {
  terms: PlanTerm[];
  placement: Placement;
  targets: Term[];
}
export interface PlanDropReport {
  term: Term;
  issues: PlanIssues;
}
export interface PlanDropReports {
  reports: PlanDropReport[];
}

export const previewPlanDrops = (id: string, body: PlanDropPreview, signal?: AbortSignal) =>
  requestAsUser<PlanDropReports>('POST', `${path(id)}/issues/drops`, { body, signal });

export const previewPlanIssues = (id: string, terms: PlanTerm[], signal?: AbortSignal) =>
  requestAsUser<PlanIssues>('POST', `${path(id)}/issues`, { body: { terms }, signal });
