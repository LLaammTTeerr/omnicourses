// The result of a plan check (F5, ADR 0014): plain types `checkPlan` returns. The HTTP DTOs in
// `plans/plan-issues.dto.ts` implement them, so the contract and the engine cannot drift apart.
import type { RequirementGroupKind, TrainingType } from '../curriculum/curriculum-types.js';
import type { Term } from '../terms/term.js';
import type { CreditCaps, TermKind } from './credit-caps.js';

export const PLAN_ISSUE_CODES = [
  /** A prerequisite is neither passed nor placed in an earlier term (Điều 3.1.c). */
  'prerequisite_not_met',
  /** The course's prerequisites are not recorded for the plan's curriculum: unknown, not a pass. */
  'prerequisites_not_recorded',
  /** The course is not taught in a term of this number (Điều 6.5, 7.1.a). */
  'not_offered',
  /** The course's offering terms are not recorded for the plan's curriculum: unknown, not a pass. */
  'offering_terms_not_recorded',
  /** The term's load is below the minimum of the program's training type (Điều 7.2.a). */
  'load_below_minimum',
  /** The term's load is above the maximum (Điều 7.2.b). */
  'load_above_maximum',
  /** The program's training type is not recorded, so no cap is checked (ADR 0013). */
  'caps_not_checked',
  /**
   * A course of the term has unknown credits (credits_not_recorded), so the load is at least `credits`
   * and a cap it may still cross is not checked. A load already above the maximum is still flagged.
   */
  'load_not_checked',
  /** The course is placed in more than one term of the plan (ADR 0014). */
  'placed_twice',
  /** The transcript already has the course passed before this term: a grade improvement (Điều 14.2). */
  'already_passed',
  /**
   * The transcript has the course in progress in an earlier term, and the plan assumes it passes, so
   * placing it again is a grade improvement, or a retake if it fails (Điều 14).
   */
  'already_in_progress',
  /** No requirement group of the plan's curriculum lists the course, so it counts toward nothing (Điều 15.1). */
  'not_in_curriculum',
  /** The catalog has no such course any more, so its credits are unknown and left out of the load. */
  'credits_not_recorded',
  /** A requirement group, a combined minimum or the cohort total is still short with the plan completed (Điều 17.3.b). */
  'requirement_not_covered',
] as const;
export type PlanIssueCode = (typeof PLAN_ISSUE_CODES)[number];

/**
 * violation: the plan breaks a rule. flag: allowed, but worth a look (a load outside the caps,
 * which a petition allows, ADR 0012; a grade improvement). unknown: the data to check the rule is
 * not recorded, so the engine says neither pass nor fail. None of them blocks saving a plan.
 */
export const PLAN_ISSUE_KINDS = ['violation', 'flag', 'unknown'] as const;
export type PlanIssueKind = (typeof PLAN_ISSUE_KINDS)[number];

/** One issue of a plan (GLOSSARY "Violation"), as a code with parameters for the UI to word (ADR 0006). */
export interface PlanIssue {
  code: PlanIssueCode;
  kind: PlanIssueKind;
  /** The term it is about; null for a coverage issue, which is about the whole plan. */
  term: Term | null;
  /** The placement's index within its term (the order of `terms[].placements`); null for a term or plan issue. */
  position: number | null;
  courseCode: string | null;
  /** requirement_not_covered of a group. */
  requirementGroupId: string | null;
  /** requirement_not_covered of a combined minimum. */
  combinedMinimumId: string | null;
  /** prerequisite_not_met: the prerequisites missing. requirement_not_covered of a compulsory group: its courses neither passed nor placed. */
  missingCourseCodes: string[];
  /** not_offered: the term numbers the course is taught in. */
  offeredTermNumbers: number[];
  /** Load and coverage issues: the credits counted. */
  credits: number | null;
  /** Load and coverage issues: the limit they are compared with. */
  limit: number | null;
  /** The rule's source, such as "QĐ 1175/QĐ-KHTN Điều 7.2". */
  citation: string;
  /** An English sentence for a screen that does not word the code itself. */
  message: string;
}

/** One term of the plan and its load against the caps (ADR 0012). */
export interface PlanTermLoad {
  term: Term;
  /** Null when the program's training type is not recorded. */
  kind: TermKind | null;
  /**
   * The credits placed: courses at their catalog credits, slots at theirs (Điều 7.1.b). A course whose
   * credits are unknown is left out, so this is then a lower bound (load_not_checked).
   */
  credits: number;
  /** Null when the program's training type is not recorded: no cap is checked. */
  caps: CreditCaps | null;
}

/** A requirement group as it would stand with the whole plan completed. */
export interface PlanGroupCoverage {
  id: string;
  name: string;
  kind: RequirementGroupKind;
  requiredCredits: number | null;
  /** Credits passed, in progress or placed that count toward the cohort total, overflow in included. */
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

/** Coverage of the curriculum if every placement and every course in progress is passed. */
export interface PlanCoverage {
  groups: PlanGroupCoverage[];
  combinedMinimums: PlanCombinedMinimumCoverage[];
  /** The cohort total, or null when not recorded. */
  totalRequired: number | null;
  totalCredits: number;
  totalRemaining: number | null;
  /** done: every requirement the data can check would be met. The school still checks the rest (Điều 17.3). */
  graduation: 'done' | 'not_yet';
}

export interface PlanIssuesReport {
  planId: string;
  trainingType: TrainingType | null;
  /** The plan's terms, oldest first. */
  terms: PlanTermLoad[];
  /** By term, oldest first: each term's load issues, then its placements in order; coverage issues last. */
  issues: PlanIssue[];
  coverage: PlanCoverage;
}
