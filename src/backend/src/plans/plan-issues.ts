import type { BoardTerm } from '../rules/inputs.js';
import type { PlanIssuesReport } from '../rules/plan-issue-types.js';
import type { PlanDto } from './plans.dto.js';

// Seam between the plans module and the rule engine (ADR 0014): this module stores placements and
// judges none of them (AGENTS.md hard rule 1). RulesService implements PlanIssuesProvider; the
// pure checks are in `rules/plan-issues.ts`. GET /api/plans/{id}/issues serves the result, and it
// is the check F5 runs live and ADR 0006's validate(plan).

export interface PlanIssuesProvider {
  /** Every issue of the student's plan, checked against the plan's own curriculum. Never blocks saving (ADR 0012). */
  issuesFor(userId: string, plan: PlanDto): Promise<PlanIssuesReport>;
  /** The same check on several boards of one plan, the inputs read once: the planner's drag preview. */
  issuesForBoards(userId: string, plan: PlanDto, boards: readonly BoardTerm[][]): Promise<PlanIssuesReport[]>;
}

/** Injection token for the provider the rules module registers. */
export const PLAN_ISSUES_PROVIDER = Symbol('PlanIssuesProvider');
