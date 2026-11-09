import type { Term } from '../terms/term.js';
import type { PlanDto } from './plans.dto.js';

// Seam for the rule engine, not implemented here: this module stores placements and judges none
// of them (AGENTS.md hard rule 1, ADR 0014). A later PR adds GET /api/plans/{id}/issues, backed by
// RulesService through this interface, as the check F5 runs live and ADR 0006's validate(plan).

/** One violation of a plan (GLOSSARY), as a code with parameters for the UI to word (ADR 0006). */
export interface PlanIssue {
  code: string;
  courseCode?: string;
  requirementGroupId?: string;
  term?: Term;
  /** The regulation clause the rule comes from, such as "QĐ 1175 Điều 7.2". */
  regulation?: string;
}

export interface PlanIssuesProvider {
  /** Every violation of the plan, [] when it breaks no rule. Never blocks saving (ADR 0012). */
  issuesFor(userId: string, plan: PlanDto): Promise<PlanIssue[]>;
}

/** Injection token for the provider the rules module will register. */
export const PLAN_ISSUES_PROVIDER = Symbol('PlanIssuesProvider');
