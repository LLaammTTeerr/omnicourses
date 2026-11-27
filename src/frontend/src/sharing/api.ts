import { HttpError, request, segment } from '../api.js';
import { requestAsUser } from '../auth/store.js';
import type { RequirementGroupKind } from '../curriculum/api.js';
import type { CreditCaps, PlacementKind, PlanIssueCode, PlanIssueKind, TermKind } from '../plans/api.js';
import type { Term } from '../terms.js';

export interface SharePlanBody {
  showName?: boolean;
  showTranscriptChecks?: boolean;
}

export type UpdatePlanShareBody = SharePlanBody;

export interface PlanShare {
  token: string;
  showName: boolean;
  showTranscriptChecks: boolean;
  createdAt: string;
}

export interface PlanShareState {
  share: PlanShare | null;
}

export type PlanShareStatus = PlanShareState;

export interface SharedProgram {
  code: string;
  nameVi: string;
  nameEn: string | null;
}

export interface SharedCurriculum {
  code: string;
  cohortYear: number;
  nameVi: string;
  nameEn: string | null;
  program: SharedProgram;
}

export interface SharedPlacement {
  kind: PlacementKind;
  courseCode: string | null;
  nameVi: string | null;
  nameEn: string | null;
  credits: number | null;
  requirementGroupName: string | null;
}

export interface SharedPlanTerm {
  term: Term;
  kind: TermKind | null;
  credits: number;
  caps: CreditCaps | null;
  placements: SharedPlacement[];
}

export interface SharedPlanIssue {
  code: PlanIssueCode;
  kind: PlanIssueKind;
  term: Term | null;
  position: number | null;
  courseCode: string | null;
  offeredTermNumbers: number[];
  credits: number | null;
  limit: number | null;
  citation: string;
  message: string;
  missingCourseCodes?: string[];
  requirementGroupName?: string | null;
  combinedMinimumName?: string | null;
}

export interface SharedGroupCoverage {
  name: string;
  kind: RequirementGroupKind;
  requiredCredits: number | null;
  credits: number;
  remainingCredits: number | null;
  met: boolean;
}

export interface SharedCombinedMinimumCoverage {
  name: string;
  creditsMin: number;
  credits: number;
  remainingCredits: number;
  met: boolean;
}

export interface SharedPlanCoverage {
  groups: SharedGroupCoverage[];
  combinedMinimums: SharedCombinedMinimumCoverage[];
  totalRequired: number | null;
  totalCredits: number;
  totalRemaining: number | null;
  graduation: 'done' | 'not_yet';
}

export interface SharedPlan {
  name: string;
  ownerName: string | null;
  curriculum: SharedCurriculum;
  updatedAt: string;
  terms: SharedPlanTerm[];
  issues: SharedPlanIssue[];
  issueCodesNotShown: PlanIssueCode[];
  coverage?: SharedPlanCoverage;
}

export interface NotShared {
  statusCode: number;
  message: string;
  error: string;
}

const sharePath = (planId: string) => `/plans/${segment(planId)}/share`;

export const sharedPlanPath = (token: string) => `/shared/${segment(token)}`;

export const sharedPlanUrl = (token: string, origin = window.location.origin) => `${origin}${sharedPlanPath(token)}`;

export const fetchPlanShare = (planId: string) => requestAsUser<PlanShareState>('GET', sharePath(planId));

export const updatePlanShare = (planId: string, body: SharePlanBody = {}) =>
  requestAsUser<PlanShare>('PUT', sharePath(planId), { body });

export const stopPlanShare = (planId: string) => requestAsUser<void>('DELETE', sharePath(planId));

export async function fetchSharedPlan(token: string): Promise<SharedPlan | null> {
  try {
    return await request<SharedPlan>('GET', `/shared-plans/${segment(token)}`);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return null;
    throw e;
  }
}
