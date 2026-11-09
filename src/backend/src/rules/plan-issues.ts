// Live validation of a plan (F5, UC-05 step 6, ADR 0014): the plan's placements against its own
// curriculum, the student's transcript and the regulation. One pure function; RulesService loads
// the inputs. It composes the engine's existing rules and decides nothing new about them.
import type { CourseRules } from '../curriculum/course-rules.service.js';
import type { CurriculumRuleGroup, CurriculumRules } from '../curriculum/curriculum-rules.reader.js';
import type { BoardTerm } from '../plans/plan-board.js';
import type { PlanCoverage, PlanIssue, PlanIssuesReport, PlanTermLoad } from '../plans/plan-issues.js';
import { compareTerms, termLabel } from '../terms/current-term.js';
import type { Term } from '../terms/term.js';
import type { TranscriptEntry } from '../transcript/transcript-entry.js';
import { resolve } from './attempts.js';
import { degreeAudit } from './audit.js';
import { CAP_CITATION, PETITION_NOTE, checkTermLoad, type LoadCourse } from './credit-caps.js';
import { placements } from './coverage.js';
import { checkOfferingTerm, checkPrerequisites } from './prerequisites.js';

export const PREREQUISITE_CITATION = 'QĐ 1175/QĐ-KHTN Điều 3.1.c';
/** Điều 6.5: the term plan says which courses open; Điều 7.1.a: students register for those. */
export const OFFERING_CITATION = 'QĐ 1175/QĐ-KHTN Điều 6.5, 7.1.a';
export const IMPROVEMENT_CITATION = 'QĐ 1175/QĐ-KHTN Điều 14.2';
export const CURRICULUM_CITATION = 'QĐ 1175/QĐ-KHTN Điều 15.1';
export const GRADUATION_CITATION = 'QĐ 1175/QĐ-KHTN Điều 17.3.b';
/** A course placed twice breaks the plan model, not a clause of the regulation. */
export const PLAN_MODEL_CITATION = 'ADR 0014';

export interface PlanCheckInput {
  planId: string;
  rules: CurriculumRules;
  /** The prerequisites and offering terms recorded for the plan's curriculum; a course absent from a map is not recorded. */
  courseRules: CourseRules;
  transcript: readonly TranscriptEntry[];
  terms: readonly BoardTerm[];
  /** Catalog credits of the placed courses. A code missing here is no longer in the catalog. */
  catalogCredits: ReadonlyMap<string, number>;
}

const issue = (fields: Pick<PlanIssue, 'code' | 'kind' | 'citation' | 'message'> & Partial<PlanIssue>): PlanIssue => ({
  term: null,
  position: null,
  courseCode: null,
  requirementGroupId: null,
  combinedMinimumId: null,
  missingCourseCodes: [],
  offeredTermNumbers: [],
  credits: null,
  limit: null,
  ...fields,
});

const copyTerm = (t: Term): Term => ({ year: t.year, number: t.number });

/** Every issue of a plan, its terms' loads, and the coverage the plan would reach. */
export function checkPlan(input: PlanCheckInput): PlanIssuesReport {
  const { rules, courseRules, transcript, catalogCredits } = input;
  const terms = [...input.terms].sort((a, b) => compareTerms(a.term, b.term));
  const placed = placements(rules);
  const attemptsByCode = new Map<string, TranscriptEntry[]>();
  for (const e of [...transcript].sort((a, b) => compareTerms(a.term, b.term))) {
    attemptsByCode.set(e.courseCode, [...(attemptsByCode.get(e.courseCode) ?? []), e]);
  }

  /** The course as the transcript stands before `term` (Điều 14: the last completed attempt counts). */
  const standingBefore = (code: string, term: Term) => {
    const earlier = (attemptsByCode.get(code) ?? []).filter((a) => compareTerms(a.term, term) < 0);
    return earlier.length ? resolve(code, earlier) : null;
  };
  const creditsOf = (code: string): number | undefined => placed.get(code)?.course.credits ?? catalogCredits.get(code);

  const issues: PlanIssue[] = [];
  const loads: PlanTermLoad[] = [];
  const firstPlacedIn = new Map<string, Term>();
  /** Courses the plan places in the terms checked so far: the plan assumes each is passed. */
  const plannedEarlier = new Set<string>();

  for (const { term, placements: tiles } of terms) {
    const at = copyTerm(term);
    const label = termLabel(term);
    const placementIssues: PlanIssue[] = [];
    const load: LoadCourse[] = [];

    // Passed before this term: in the transcript (or in progress there, assumed passed as the plan is), or placed earlier in the plan.
    const passedBefore = new Set(plannedEarlier);
    for (const code of attemptsByCode.keys()) {
      const standing = standingBefore(code, term);
      if (standing && (standing.passed || standing.inProgress)) passedBefore.add(code);
    }

    tiles.forEach((p, position) => {
      if (p.kind === 'slot' || p.courseCode === null) {
        load.push({ credits: p.credits ?? 0 });
        return;
      }
      const code = p.courseCode;
      const where = { term: at, position, courseCode: code };
      const credits = creditsOf(code);
      if (credits === undefined) {
        placementIssues.push(
          issue({ ...where, code: 'credits_not_recorded', kind: 'unknown', citation: 'QĐ 1175/QĐ-KHTN Điều 7.1.b', message: `${code} is not in the catalog, so its credits are unknown and left out of the load of ${label}.` }),
        );
      } else {
        load.push({ credits, excludedFromMinimum: placed.get(code)?.course.countsTowardTotal === false });
      }

      const first = firstPlacedIn.get(code);
      if (first) {
        placementIssues.push(
          issue({ ...where, code: 'placed_twice', kind: 'violation', citation: PLAN_MODEL_CITATION, message: `${code} is already placed in ${termLabel(first)}; a plan places a course once.` }),
        );
      } else {
        firstPlacedIn.set(code, at);
      }

      if (!placed.has(code)) {
        placementIssues.push(
          issue({ ...where, code: 'not_in_curriculum', kind: 'flag', citation: CURRICULUM_CITATION, message: `No requirement group of ${rules.curriculumCode} lists ${code}, so it counts toward nothing.` }),
        );
      }

      if (standingBefore(code, term)?.passed) {
        placementIssues.push(
          issue({
            ...where,
            code: 'already_passed',
            kind: 'flag',
            citation: IMPROVEMENT_CITATION,
            message: `${code} is already passed. Taking it again is a grade improvement, and the last grade becomes official even if it is lower.`,
          }),
        );
      }

      const prerequisites = checkPrerequisites(courseRules.prerequisites.get(code) ?? null, passedBefore);
      if (prerequisites.status === 'not_recorded') {
        placementIssues.push(
          issue({ ...where, code: 'prerequisites_not_recorded', kind: 'unknown', citation: PREREQUISITE_CITATION, message: `The prerequisites of ${code} are not recorded for ${rules.curriculumCode}: unknown, not checked.` }),
        );
      } else if (prerequisites.status === 'not_met') {
        placementIssues.push(
          issue({
            ...where,
            code: 'prerequisite_not_met',
            kind: 'violation',
            missingCourseCodes: prerequisites.missing,
            citation: PREREQUISITE_CITATION,
            message: `${code} needs ${prerequisites.missing.join(', ')} passed before ${label}.`,
          }),
        );
      }

      const offered = checkOfferingTerm((courseRules.offeringTerms.get(code) ?? null) as Term['number'][] | null, term);
      if (offered.status === 'not_recorded') {
        placementIssues.push(
          issue({ ...where, code: 'offering_terms_not_recorded', kind: 'unknown', citation: OFFERING_CITATION, message: `The offering terms of ${code} are not recorded for ${rules.curriculumCode}: unknown, not checked.` }),
        );
      } else if (offered.status === 'not_offered') {
        placementIssues.push(
          issue({
            ...where,
            code: 'not_offered',
            kind: 'violation',
            offeredTermNumbers: offered.offeredTermNumbers,
            citation: OFFERING_CITATION,
            message: `${code} is taught in term ${offered.offeredTermNumbers.join(', ')}, not term ${term.number}.`,
          }),
        );
      }
    });

    const checked = checkTermLoad(rules.trainingType, term.number, load);
    loads.push({ term: at, kind: checked.kind, credits: checked.credits, caps: checked.caps });
    if (checked.caps === null) {
      issues.push(
        issue({ term: at, code: 'caps_not_checked', kind: 'unknown', credits: checked.credits, citation: CAP_CITATION, message: `The training type of ${rules.programCode} is not recorded, so the load of ${label} is not checked.` }),
      );
    }
    for (const v of checked.violations) {
      const below = v.rule === 'below_minimum';
      issues.push(
        issue({
          term: at,
          code: below ? 'load_below_minimum' : 'load_above_maximum',
          kind: 'flag',
          credits: v.credits,
          limit: v.limit,
          citation: v.citation,
          message: `${label} holds ${v.credits} credits, ${below ? 'below the minimum' : 'above the maximum'} of ${v.limit}. ${PETITION_NOTE}`,
        }),
      );
    }
    issues.push(...placementIssues);
    for (const p of tiles) if (p.kind === 'course' && p.courseCode !== null) plannedEarlier.add(p.courseCode);
  }

  const coverage = projectedCoverage(input, terms);
  issues.push(...coverage.issues);
  return { planId: input.planId, trainingType: rules.trainingType, terms: loads, issues, coverage: coverage.coverage };
}

/**
 * The degree audit as it would stand with the plan completed: every placed course and every course
 * in progress passed in its term. A slot is an unnamed course of its group with the slot's credits,
 * so it counts, and overflows, as the course chosen for it would.
 */
function projectedCoverage(input: PlanCheckInput, terms: readonly BoardTerm[]): { coverage: PlanCoverage; issues: PlanIssue[] } {
  const { rules, catalogCredits } = input;
  const placed = placements(rules);
  const slotsByGroup = new Map<string, CurriculumRuleGroup['courses']>();
  const projected: TranscriptEntry[] = input.transcript.map((e) => (e.result === 'in_progress' ? { ...e, result: 'pass' as const } : e));
  const pass = (courseCode: string, credits: number, term: Term): TranscriptEntry => ({ courseCode, courseName: courseCode, credits, result: 'pass', grade: null, term });

  for (const { term, placements: tiles } of terms) {
    tiles.forEach((p, position) => {
      if (p.kind === 'course' && p.courseCode !== null) {
        const credits = placed.get(p.courseCode)?.course.credits ?? catalogCredits.get(p.courseCode);
        if (credits !== undefined) projected.push(pass(p.courseCode, credits, term));
      } else if (p.requirementGroupId !== null && p.credits !== null) {
        // Lower case: never a catalog code (COURSE_CODE_PATTERN is capitals and digits).
        const code = `slot:${term.year}-${term.number}-${position}`;
        const slot = { code, nameVi: code, nameEn: null, credits: p.credits, countsTowardTotal: true, countsTowardGpa: false };
        slotsByGroup.set(p.requirementGroupId, [...(slotsByGroup.get(p.requirementGroupId) ?? []), slot]);
        projected.push(pass(code, p.credits, term));
      }
    });
  }

  const withSlots: CurriculumRules = { ...rules, groups: rules.groups.map((g) => ({ ...g, courses: [...g.courses, ...(slotsByGroup.get(g.id) ?? [])] })) };
  const audit = degreeAudit(withSlots, projected);
  const issues: PlanIssue[] = [];

  const groups = audit.groups.map((g) => {
    const credits = g.passedCredits + g.overflowInCredits;
    if (!g.met) {
      const missing = g.kind === 'compulsory' ? g.courses.filter((c) => c.status !== 'passed' && c.status !== 'counted_in_other_group').map((c) => c.code) : [];
      issues.push(
        issue({
          code: 'requirement_not_covered',
          kind: 'violation',
          requirementGroupId: g.id,
          missingCourseCodes: missing,
          credits,
          limit: g.requiredCredits,
          citation: GRADUATION_CITATION,
          message: missing.length
            ? `With the plan completed, "${g.name}" still needs ${missing.join(', ')}.`
            : `With the plan completed, "${g.name}" has ${credits} of ${g.requiredCredits} credits.`,
        }),
      );
    }
    return { id: g.id, name: g.name, kind: g.kind, requiredCredits: g.requiredCredits, credits, remainingCredits: g.remainingCredits, met: g.met };
  });

  const combinedMinimums = audit.combinedMinimums.map((m) => {
    if (!m.met) {
      issues.push(
        issue({
          code: 'requirement_not_covered',
          kind: 'violation',
          combinedMinimumId: m.id,
          credits: m.credits,
          limit: m.creditsMin,
          citation: GRADUATION_CITATION,
          message: `With the plan completed, "${m.name}" has ${m.credits} of at least ${m.creditsMin} credits.`,
        }),
      );
    }
    return { id: m.id, name: m.name, creditsMin: m.creditsMin, credits: m.credits, remainingCredits: m.remainingCredits, met: m.met };
  });

  const { towardTotal, totalRequired, remaining } = audit.credits;
  if (totalRequired !== null && towardTotal < totalRequired) {
    issues.push(
      issue({
        code: 'requirement_not_covered',
        kind: 'violation',
        credits: towardTotal,
        limit: totalRequired,
        citation: GRADUATION_CITATION,
        message: `With the plan completed, ${towardTotal} of the ${totalRequired} credits of the cohort total are covered.`,
      }),
    );
  }

  return {
    coverage: { groups, combinedMinimums, totalRequired, totalCredits: towardTotal, totalRemaining: remaining, graduation: audit.graduation.status },
    issues,
  };
}
