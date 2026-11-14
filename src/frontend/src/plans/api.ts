import { request } from '../api.js';
import type { RequirementGroupKind, TrainingType } from '../curriculum/api.js';
import type { Term } from '../terms.js';

// The plans DTOs of the API (F5, UC-05, ADR 0014) and the rule engine's report on a plan (ADR 0013), written by hand;
// api.spec.ts checks them against src/backend/openapi.json. The plans API stores placements and judges none of them;
// every issue, load and cap shown in the planner comes from GET /plans/{id}/issues (AGENTS.md hard rule 1).

export const PLACEMENT_KINDS = ['course', 'slot'] as const;
export type PlacementKind = (typeof PLACEMENT_KINDS)[number];

/** One tile of a plan: a catalog course, or credits held for a requirement group before a course is chosen. */
export interface Placement {
  kind: PlacementKind;
  /** Set for a course, null for a slot. */
  courseCode?: string | null;
  /** Set for a slot, null for a course. */
  requirementGroupId?: string | null;
  /** A slot's credits; null for a course, whose credits are the catalog's. */
  credits?: number | null;
}

export interface PlanTerm {
  term: Term;
  /** In order. A term with nothing placed is never stored, and the API refuses one sent empty. */
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
  /** Fixed when the plan is created (ADR 0014). */
  curriculum: PlanCurriculum;
  createdAt: string;
  updatedAt: string;
}

export interface Plan extends PlanSummary {
  /** Oldest first. */
  terms: PlanTerm[];
}

/** What the plans list shows of a plan without opening it. */
export interface PlanPreview {
  termCount: number;
  courseCount: number;
  /** Elective slots: credits held for a group before a course is chosen. */
  slotCount: number;
  firstTerm: Term | null;
  lastTerm: Term | null;
}

export interface PlanListItem extends PlanSummary {
  preview: PlanPreview;
}

export interface PlanList {
  /** Oldest first. */
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

/** violation: breaks a rule. flag: allowed, worth a look. unknown: the data is not recorded, so neither pass nor fail. */
export const PLAN_ISSUE_KINDS = ['violation', 'flag', 'unknown'] as const;
export type PlanIssueKind = (typeof PLAN_ISSUE_KINDS)[number];

export interface PlanIssue {
  code: PlanIssueCode;
  kind: PlanIssueKind;
  /** null: a coverage issue, about the whole plan. */
  term: Term | null;
  /** The placement's index in its term's placements; null for a term or coverage issue. */
  position: number | null;
  courseCode: string | null;
  requirementGroupId: string | null;
  combinedMinimumId: string | null;
  missingCourseCodes: string[];
  offeredTermNumbers: number[];
  credits: number | null;
  limit: number | null;
  /** Where the rule comes from, such as "QĐ 1175/QĐ-KHTN Điều 7.2". */
  citation: string;
  /** English only; the planner words the code itself. */
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
  /** null: the program's training type is not recorded. */
  kind: TermKind | null;
  credits: number;
  /** null: not recorded. */
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
  /** The plan's terms, oldest first. */
  terms: PlanTermLoad[];
  /** By term, oldest first; coverage issues last. */
  issues: PlanIssue[];
  coverage: PlanCoverage;
}

const path = (id: string) => `/plans/${encodeURIComponent(id)}`;

export const fetchPlans = (token: string) => request<PlanList>('GET', '/plans', { token });

/** 400: no curriculum for this program and cohort. */
export const createPlan = (token: string, body: CreatePlanBody) => request<Plan>('POST', '/plans', { token, body });

/** 404: no such plan among the student's own. */
export const fetchPlan = (token: string, id: string) => request<Plan>('GET', path(id), { token });

export const renamePlan = (token: string, id: string, name: string) => request<Plan>('PATCH', path(id), { token, body: { name } });

/** The new copy, named `name`; the original is unchanged. */
export const duplicatePlan = (token: string, id: string, name: string) => request<Plan>('POST', `${path(id)}/duplicate`, { token, body: { name } });

export const deletePlan = (token: string, id: string) => request<void>('DELETE', path(id), { token });

/** Replaces every placement; terms with nothing placed must be left out. */
export const savePlacements = (token: string, id: string, terms: PlanTerm[]) => request<Plan>('PUT', `${path(id)}/placements`, { token, body: { terms } });

export const fetchPlanIssues = (token: string, id: string) => request<PlanIssues>('GET', `${path(id)}/issues`, { token });

/** One placement tried on several terms: `terms` is the board without it (a moved tile taken out first). */
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
  /** One per target, in the order sent. */
  reports: PlanDropReport[];
}

/** The drag preview in one request: the engine's report on the board with the placement at the end of each target. */
export const previewPlanDrops = (token: string, id: string, body: PlanDropPreview, signal?: AbortSignal) =>
  request<PlanDropReports>('POST', `${path(id)}/issues/drops`, { token, body, signal });

/** The rule engine's report on `terms` in place of the saved board; nothing is saved (the drag preview). */
export const previewPlanIssues = (token: string, id: string, terms: PlanTerm[], signal?: AbortSignal) =>
  request<PlanIssues>('POST', `${path(id)}/issues`, { token, body: { terms }, signal });
