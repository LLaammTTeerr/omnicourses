import { request } from '../api.js';
import type {
  CreatePlanDto,
  PlanCombinedMinimumCoverageDto,
  PlanCoverageDto,
  PlanCurriculumDto,
  PlanDropPreviewDto,
  PlanDropReportDto,
  PlanDropReportsDto,
  PlanDto,
  PlanGroupCoverageDto,
  PlanIssueDto,
  PlanIssuesDto,
  PlanListDto,
  PlanListItemDto,
  PlanPlacementDto,
  PlanPreviewDto,
  PlanTermDto,
  PlanTermLoadDto,
} from '../api-schema/types.gen.js';

// The plans DTOs of the API (F5, UC-05, ADR 0014) and the rule engine's report on a plan (ADR 0013), generated from
// the contract (ADR 0018). The plans API stores placements and judges none of them; every issue, load and cap shown
// in the planner comes from GET /plans/{id}/issues (AGENTS.md hard rule 1).

/** One tile of a plan: a catalog course, or credits held for a requirement group before a course is chosen. */
export type Placement = PlanPlacementDto;
export type PlacementKind = Placement['kind'];
/** `placements` in order. A term with nothing placed is never stored, and the API refuses one sent empty. */
export type PlanTerm = PlanTermDto;
export type PlanCurriculum = PlanCurriculumDto;
/** `terms` oldest first; `curriculum` fixed when the plan is created (ADR 0014). */
export type Plan = PlanDto;
/** What a plan and a plans-list entry share: the screens that only name, copy or delete a plan take either. */
export type PlanSummary = Omit<PlanDto, 'terms'>;
/** What the plans list shows of a plan without opening it. */
export type PlanPreview = PlanPreviewDto;
export type PlanListItem = PlanListItemDto;
export type PlanList = PlanListDto;
export type CreatePlanBody = CreatePlanDto;

export type PlanIssueCode = PlanIssueDto['code'];
/** violation: breaks a rule. flag: allowed, worth a look. unknown: the data is not recorded, so neither pass nor fail. */
export type PlanIssueKind = PlanIssueDto['kind'];
/** `term` null: a coverage issue, about the whole plan. `message` is English only; the planner words the code itself. */
export type PlanIssue = PlanIssueDto;
/** `kind` null: the program's training type is not recorded. */
export type PlanTermLoad = PlanTermLoadDto;
export type PlanGroupCoverage = PlanGroupCoverageDto;
export type PlanCombinedMinimumCoverage = PlanCombinedMinimumCoverageDto;
export type PlanCoverage = PlanCoverageDto;
/** `terms` oldest first; `issues` by term, oldest first, coverage issues last. */
export type PlanIssues = PlanIssuesDto;

/** One placement tried on several terms: `terms` is the board without it (a moved tile taken out first). */
export type PlanDropPreview = PlanDropPreviewDto;
export type PlanDropReport = PlanDropReportDto;
/** `reports`: one per target, in the order sent. */
export type PlanDropReports = PlanDropReportsDto;

const path = (id: string) => `/plans/${encodeURIComponent(id)}`;

/** The longest plan name the API takes, in characters (code points): CreatePlanDto, RenamePlanDto, DuplicatePlanDto. */
export const PLAN_NAME_MAX_LENGTH = 100;

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

/** The drag preview in one request: the engine's report on the board with the placement at the end of each target. */
export const previewPlanDrops = (token: string, id: string, body: PlanDropPreview, signal?: AbortSignal) =>
  request<PlanDropReports>('POST', `${path(id)}/issues/drops`, { token, body, signal });

/** The rule engine's report on `terms` in place of the saved board; nothing is saved (the drag preview). */
export const previewPlanIssues = (token: string, id: string, terms: PlanTerm[], signal?: AbortSignal) =>
  request<PlanIssues>('POST', `${path(id)}/issues`, { token, body: { terms }, signal });
