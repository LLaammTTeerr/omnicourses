import type { CourseSummary, CurriculumLabels } from '../curriculum/curriculum.service.js';
import { PLAN_ISSUE_CODES, type PlanIssue, type PlanIssueCode, type PlanIssuesReport } from '../plans/plan-issues.js';
import type { PlanDto } from '../plans/plans.dto.js';
import type { Term } from '../terms/term.js';
import type { SharedPlacementDto, SharedPlanDto, SharedPlanIssueDto } from './sharing.dto.js';

// What a reader of a shared plan's link gets (UC-09 step 2, ADR 0010). A pure function: the rule
// engine's report of the plan goes in, and only the listed fields come out, built one by one. It
// decides no academic rule (AGENTS.md hard rule 1): it copies the engine's answers or leaves them out.

/**
 * The issue codes a reader sees: the ones the engine works out from the plan and its curriculum
 * alone. A code is listed here by a person's decision, so a code the engine gains later stays
 * hidden until someone adds it (shared-plan.spec.ts fails until it is classified).
 */
export const SHARED_ISSUE_CODES = [
  'prerequisites_not_recorded',
  'not_offered',
  'offering_terms_not_recorded',
  'load_below_minimum',
  'load_above_maximum',
  'caps_not_checked',
  'load_not_checked',
  'placed_twice',
  'not_in_curriculum',
  'credits_not_recorded',
] as const satisfies readonly PlanIssueCode[];
export type SharedIssueCode = (typeof SHARED_ISSUE_CODES)[number];

/**
 * The codes a reader never sees, because the engine reads the owner's transcript to decide them:
 * each one, by being there or by being absent, says which courses the owner has passed, failed or
 * is taking (UC-09 §7: the transcript never appears). The answer names them, so the page can say
 * that these checks are not shown instead of letting "no issue" read as a pass.
 */
export const WITHHELD_ISSUE_CODES: PlanIssueCode[] = PLAN_ISSUE_CODES.filter((code) => !(SHARED_ISSUE_CODES as readonly PlanIssueCode[]).includes(code));

const isShared = (issue: PlanIssue): issue is PlanIssue & { code: SharedIssueCode } => (SHARED_ISSUE_CODES as readonly PlanIssueCode[]).includes(issue.code);

const termKey = (t: Term): string => `${t.year}-${t.number}`;
const copyTerm = (t: Term): Term => ({ year: t.year, number: t.number });

export interface SharedPlanSource {
  plan: PlanDto;
  /** The rule engine's report of exactly this plan. */
  report: PlanIssuesReport;
  /** The catalog's name and credits of the placed courses; a code missing here is no longer in the catalog. */
  courses: ReadonlyMap<string, CourseSummary>;
  curriculum: CurriculumLabels;
  /** The owner's display name when they chose to show it, else null. */
  ownerName: string | null;
}

export function sharedPlan({ plan, report, courses, curriculum, ownerName }: SharedPlanSource): SharedPlanDto {
  const loads = new Map(report.terms.map((load) => [termKey(load.term), load]));
  return {
    name: plan.name,
    ownerName,
    curriculum: {
      code: curriculum.code,
      cohortYear: curriculum.cohortYear,
      nameVi: curriculum.nameVi,
      nameEn: curriculum.nameEn,
      program: { code: curriculum.program.code, nameVi: curriculum.program.nameVi, nameEn: curriculum.program.nameEn },
    },
    updatedAt: plan.updatedAt,
    terms: plan.terms.map(({ term, placements }) => {
      const load = loads.get(termKey(term));
      // The engine reports one load per term of the board it was given: a missing one is a broken invariant, never a zero.
      if (!load) throw new Error(`The rule engine reported no load for term ${termKey(term)}`);
      return {
        term: copyTerm(term),
        kind: load.kind,
        credits: load.credits,
        caps: load.caps ? { min: load.caps.min, max: load.caps.max } : null,
        placements: placements.map((p): SharedPlacementDto => {
          if (p.kind === 'course' && p.courseCode !== null) {
            const course = courses.get(p.courseCode);
            return { kind: 'course', courseCode: p.courseCode, nameVi: course?.nameVi ?? null, nameEn: course?.nameEn ?? null, credits: course?.credits ?? null, requirementGroupName: null };
          }
          const groupName = p.requirementGroupId === null ? null : (curriculum.groupNames.get(p.requirementGroupId) ?? null);
          return { kind: 'slot', courseCode: null, nameVi: null, nameEn: null, credits: p.credits, requirementGroupName: groupName };
        }),
      };
    }),
    issues: report.issues.filter(isShared).map(
      (i): SharedPlanIssueDto => ({
        code: i.code,
        kind: i.kind,
        term: i.term ? copyTerm(i.term) : null,
        position: i.position,
        courseCode: i.courseCode,
        offeredTermNumbers: [...i.offeredTermNumbers],
        credits: i.credits,
        limit: i.limit,
        citation: i.citation,
        message: i.message,
      }),
    ),
    issueCodesNotShown: [...WITHHELD_ISSUE_CODES],
  };
}
