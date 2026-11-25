import type { CourseSummary, CurriculumLabels } from '../curriculum/curriculum.service.js';
import { PLAN_ISSUE_CODES, type PlanIssue, type PlanIssueCode, type PlanIssuesReport } from '../plans/plan-issues.js';
import type { PlanDto } from '../plans/plans.dto.js';
import type { Term } from '../terms/term.js';
import type { SharedPlacementDto, SharedPlanCoverageDto, SharedPlanDto, SharedPlanIssueDto } from './sharing.dto.js';

// What a reader of a shared plan's link gets (UC-09 step 2, ADR 0010). A pure function: the rule
// engine's report of the plan goes in, and only the listed fields come out, built one by one. It
// decides no academic rule (AGENTS.md hard rule 1): it copies the engine's answers or leaves them out.

/**
 * The issue codes every reader sees: the ones the engine works out from the plan and its curriculum
 * alone. A code is listed here or in TRANSCRIPT_ISSUE_CODES by a person's decision, so a code the
 * engine gains later stays hidden from every reader until someone adds it (shared-plan.spec.ts
 * fails until it is classified).
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
 * The codes the engine decides from the owner's transcript: each one, by being there or by being
 * absent, says which courses the owner has passed, failed or is taking. A reader sees them, and the
 * coverage they add up to, only when the owner chose it for the link (ADR 0010). They carry no
 * grade and no term of a transcript row: their terms are the plan's.
 */
export const TRANSCRIPT_ISSUE_CODES = ['prerequisite_not_met', 'already_passed', 'already_in_progress', 'requirement_not_covered'] as const satisfies readonly PlanIssueCode[];

const notAmong = (shown: readonly PlanIssueCode[]): PlanIssueCode[] => PLAN_ISSUE_CODES.filter((code) => !shown.includes(code));

/**
 * The codes a reader does not see unless the owner chose to show the transcript's checks. The
 * answer names them, so the page can say that these checks are not shown instead of letting "no
 * issue" read as a pass.
 */
export const WITHHELD_ISSUE_CODES: PlanIssueCode[] = notAmong(SHARED_ISSUE_CODES);

const WITH_TRANSCRIPT_CHECKS: readonly PlanIssueCode[] = [...SHARED_ISSUE_CODES, ...TRANSCRIPT_ISSUE_CODES];

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
  /** Whether the owner chose to show the checks that come from their transcript. Left out: no. */
  showTranscriptChecks?: boolean;
}

/** A plan-and-curriculum issue, as every reader gets it. */
const sharedIssue = (i: PlanIssue): SharedPlanIssueDto => ({
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
});

/** The name the engine's own coverage gives an id. A missing one is a broken report, never a silent null. */
function nameOf(names: ReadonlyMap<string, string>, id: string | null, what: string): string | null {
  if (id === null) return null;
  const name = names.get(id);
  if (name === undefined) throw new Error(`The rule engine reported an issue of a ${what} that its coverage does not list`);
  return name;
}

/** The engine's coverage without its ids: a reader gets names only. */
function sharedCoverage({ coverage }: PlanIssuesReport): SharedPlanCoverageDto {
  return {
    groups: coverage.groups.map((g) => ({ name: g.name, kind: g.kind, requiredCredits: g.requiredCredits, credits: g.credits, remainingCredits: g.remainingCredits, met: g.met })),
    combinedMinimums: coverage.combinedMinimums.map((m) => ({ name: m.name, creditsMin: m.creditsMin, credits: m.credits, remainingCredits: m.remainingCredits, met: m.met })),
    totalRequired: coverage.totalRequired,
    totalCredits: coverage.totalCredits,
    totalRemaining: coverage.totalRemaining,
    graduation: coverage.graduation,
  };
}

/**
 * What the owner's choice adds: the four transcript codes among the issues, three more fields on
 * every issue (a requirement group or combined minimum by name instead of by id), and the coverage.
 */
function withTranscriptChecks(report: PlanIssuesReport): Pick<SharedPlanDto, 'issues' | 'issueCodesNotShown' | 'coverage'> {
  const groupNames = new Map(report.coverage.groups.map((g) => [g.id, g.name]));
  const minimumNames = new Map(report.coverage.combinedMinimums.map((m) => [m.id, m.name]));
  return {
    issues: report.issues
      .filter((i) => WITH_TRANSCRIPT_CHECKS.includes(i.code))
      .map((i) => ({
        ...sharedIssue(i),
        missingCourseCodes: [...i.missingCourseCodes],
        requirementGroupName: nameOf(groupNames, i.requirementGroupId, 'requirement group'),
        combinedMinimumName: nameOf(minimumNames, i.combinedMinimumId, 'combined minimum'),
      })),
    issueCodesNotShown: notAmong(WITH_TRANSCRIPT_CHECKS),
    coverage: sharedCoverage(report),
  };
}

export function sharedPlan({ plan, report, courses, curriculum, ownerName, showTranscriptChecks = false }: SharedPlanSource): SharedPlanDto {
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
    ...(showTranscriptChecks
      ? withTranscriptChecks(report)
      : { issues: report.issues.filter((i) => (SHARED_ISSUE_CODES as readonly PlanIssueCode[]).includes(i.code)).map(sharedIssue), issueCodesNotShown: [...WITHHELD_ISSUE_CODES] }),
  };
}
