// What the rule engine reads (ADR 0013): plain data, no entity, so the rule functions stay pure,
// a test builds an input by hand, and no feature folder decides the engine's shapes. The
// curriculum module fills the curriculum inputs; the plans module stores boards of this shape.
import { byText } from '../common/by-text.js';
import type { RequirementGroupKind, TrainingType } from '../curriculum/curriculum-types.js';
import type { Term } from '../terms/term.js';

export interface CurriculumRuleCourse {
  code: string;
  nameVi: string;
  nameEn: string | null;
  /** Catalog credits. */
  credits: number;
  /** false: required but outside the cohort total (GDTC, GDQP-AN). */
  countsTowardTotal: boolean;
  /** false: left out of the GPA (QĐ 1175/QĐ-KHTN Điều 15.1.c). */
  countsTowardGpa: boolean;
}

export interface CurriculumRuleGroup {
  id: string;
  name: string;
  kind: RequirementGroupKind;
  creditsTotal: number | null;
  creditsTotalMin: number | null;
  /** The group that this group's credits beyond its own minimum count toward, or null. */
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

/** What the rule engine reads about one curriculum. */
export interface CurriculumRules {
  programCode: string;
  trainingType: TrainingType | null;
  cohortYear: number;
  curriculumCode: string;
  totalCreditsMin: number | null;
  /** In any order: the engine orders what it returns (`inOrder`). */
  groups: CurriculumRuleGroup[];
  /** In any order. */
  combinedMinimums: CurriculumRuleCombinedMinimum[];
}

/**
 * The prerequisites and offering terms recorded for the courses of one curriculum. A course
 * absent from a map has nothing recorded: the engine reads that as unknown, not as none.
 */
export interface CourseRules {
  /** Course code → its prerequisite codes, sorted; [] when "none" was recorded. */
  prerequisites: Map<string, string[]>;
  /** Course code → the term numbers it is offered in, ascending; never empty. */
  offeringTerms: Map<string, Term['number'][]>;
}

/**
 * The curriculum in the order the engine's results promise (`rules/audit-types.ts`): groups and
 * combined minimums by name, then id, and each group's courses and each minimum's groups by code
 * or id, all in code-point order. The engine never depends on the order its reader returns.
 */
export function inOrder(rules: CurriculumRules): CurriculumRules {
  const byNameThenId = (a: { name: string; id: string }, b: { name: string; id: string }) => byText(a.name, b.name) || byText(a.id, b.id);
  return {
    ...rules,
    groups: rules.groups.map((g) => ({ ...g, courses: [...g.courses].sort((a, b) => byText(a.code, b.code)) })).sort(byNameThenId),
    combinedMinimums: rules.combinedMinimums.map((m) => ({ ...m, groupIds: [...m.groupIds].sort(byText) })).sort(byNameThenId),
  };
}

// The board of a plan (ADR 0014): one row per term, placements in order.

export const PLACEMENT_KINDS = ['course', 'slot'] as const;
export type PlacementKind = (typeof PLACEMENT_KINDS)[number];

/** A course, or a slot holding credits for a requirement group until a course is chosen. */
export interface Placement {
  kind: PlacementKind;
  courseCode: string | null;
  requirementGroupId: string | null;
  credits: number | null;
}

export interface BoardTerm {
  term: Term;
  placements: Placement[];
}

/** The course codes a board places, in board order. */
export const courseCodesOf = (terms: readonly BoardTerm[]): string[] =>
  terms.flatMap((t) => t.placements.flatMap((p) => (p.kind === 'course' && p.courseCode !== null ? [p.courseCode] : [])));
