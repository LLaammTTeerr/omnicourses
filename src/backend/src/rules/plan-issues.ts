// Live validation of a plan (F5, UC-05 step 6, ADR 0014): the plan's placements against its own
// curriculum, the student's transcript and the regulation. One pure function; RulesService loads
// the inputs. It composes the engine's existing rules and decides nothing new about them.
import { compareTerms, termLabel, type Term } from '../terms/term.js';
import type { TranscriptEntry } from '../transcript/transcript-entry.js';
import { courseRecords, isCompleted, recordBefore } from './attempts.js';
import { degreeAudit } from './audit.js';
import {
  CAP_CITATION,
  CURRICULUM_CITATION,
  GRADUATION_CITATION,
  IMPROVEMENT_CITATION,
  LOAD_CITATION,
  OFFERING_CITATION,
  PLAN_MODEL_CITATION,
  PREREQUISITE_CITATION,
} from './citations.js';
import { PETITION_NOTE, checkTermLoad, isExcludedFromMinimum, type LoadCourse } from './credit-caps.js';
import { placements } from './coverage.js';
import type { BoardTerm, CourseRules, CurriculumRuleCourse, CurriculumRuleGroup, CurriculumRules } from './inputs.js';
import type { PlanCoverage, PlanIssue, PlanIssuesReport, PlanTermLoad } from './plan-issue-types.js';
import { checkOfferingTerm, checkPrerequisites } from './prerequisites.js';

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

/**
 * Whether a slot of the group counts toward the cohort total (and so toward the đại trà minimum):
 * only when every course of the group does. A slot in a group that mixes both, such as APCS's
 * with the Thể dục rows, may hold either, so it is not claimed toward graduation (ADR 0013).
 */
const slotCountsTowardTotal = (rules: CurriculumRules, groupId: string | null): boolean =>
  rules.groups.find((g) => g.id === groupId)?.courses.every((c) => c.countsTowardTotal) ?? true;

/** The credits a placed course adds to a plan: its curriculum's, else the catalog's; undefined when the catalog no longer has it. */
const plannedCredits = (placed: ReadonlyMap<string, { course: CurriculumRuleCourse }>, catalogCredits: ReadonlyMap<string, number>, code: string): number | undefined =>
  placed.get(code)?.course.credits ?? catalogCredits.get(code);

/** Every issue of a plan, its terms' loads, and the coverage the plan would reach. */
export function checkPlan(input: PlanCheckInput): PlanIssuesReport {
  const { rules, courseRules, transcript, catalogCredits } = input;
  const terms = [...input.terms].sort((a, b) => compareTerms(a.term, b.term));
  const placed = placements(rules);
  const records = courseRecords(transcript);

  /** The course as the transcript stands before `term` (Điều 14: the last completed attempt counts). */
  const standingBefore = (code: string, term: Term) => {
    const record = records.get(code);
    return record ? recordBefore(record, term) : null;
  };

  const issues: PlanIssue[] = [];
  const loads: PlanTermLoad[] = [];
  const firstPlacedIn = new Map<string, Term>();
  /** Courses the plan places in the terms checked so far, with their term: the plan assumes each is passed. */
  const plannedEarlier = new Map<string, Term>();

  for (const { term, placements: tiles } of terms) {
    const at = copyTerm(term);
    const label = termLabel(term);
    const placementIssues: PlanIssue[] = [];
    const load: LoadCourse[] = [];
    const unknownCredits: string[] = [];

    // Passed before this term: in the transcript (or in progress there, assumed passed as the plan is), or placed earlier in the
    // plan. Once the transcript has a completed attempt in or after the placement's term, it decides, as it does in coverage.
    const passedBefore = new Set<string>();
    for (const [code, placedIn] of plannedEarlier) {
      const recorded = (records.get(code)?.attempts ?? []).some((a) => isCompleted(a) && compareTerms(a.term, placedIn) >= 0 && compareTerms(a.term, term) < 0);
      if (!recorded) passedBefore.add(code);
    }
    for (const record of records.values()) {
      const standing = recordBefore(record, term);
      if (standing && (standing.passed || standing.inProgress)) passedBefore.add(record.code);
    }

    tiles.forEach((p, position) => {
      if (p.kind === 'slot' || p.courseCode === null) {
        load.push({ credits: p.credits ?? 0, excludedFromMinimum: isExcludedFromMinimum({ countsTowardTotal: slotCountsTowardTotal(rules, p.requirementGroupId) }) });
        return;
      }
      const code = p.courseCode;
      const where = { term: at, position, courseCode: code };
      const credits = plannedCredits(placed, catalogCredits, code);
      if (credits === undefined) {
        unknownCredits.push(code);
        placementIssues.push(
          issue({ ...where, code: 'credits_not_recorded', kind: 'unknown', citation: LOAD_CITATION, message: `${code} is not in the catalog, so its credits are unknown and left out of the load of ${label}.` }),
        );
      } else {
        load.push({ credits, excludedFromMinimum: isExcludedFromMinimum(placed.get(code)?.course) });
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

      const standing = standingBefore(code, term);
      if (standing?.passed) {
        placementIssues.push(
          issue({
            ...where,
            code: 'already_passed',
            kind: 'flag',
            citation: IMPROVEMENT_CITATION,
            message: `${code} is already passed. Taking it again is a grade improvement, and the last grade becomes official even if it is lower.`,
          }),
        );
      } else if (standing?.inProgress) {
        placementIssues.push(
          issue({
            ...where,
            code: 'already_in_progress',
            kind: 'flag',
            citation: IMPROVEMENT_CITATION,
            message: `${code} is in progress before ${label}, and the plan assumes it passes. Taking it again is a grade improvement, or a retake if it fails.`,
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

      const offered = checkOfferingTerm(courseRules.offeringTerms.get(code) ?? null, term);
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
    // A course of unknown credits may add any number: only a load already above the maximum is certain (ADR 0011: unknown, never a pass or a fail).
    // A known load below the minimum may yet reach it; one not above the maximum may yet cross it.
    const violations = unknownCredits.length ? checked.violations.filter((v) => v.rule === 'above_maximum') : checked.violations;
    if (unknownCredits.length && checked.caps !== null) {
      const { min, max } = checked.caps;
      const minOpen = checked.violations.some((v) => v.rule === 'below_minimum');
      const maxOpen = !violations.length;
      if (minOpen || maxOpen) {
        const against = minOpen && maxOpen ? `the caps of ${min}–${max}` : minOpen ? `the minimum of ${min}` : `the maximum of ${max}`;
        issues.push(
          issue({
            term: at,
            code: 'load_not_checked',
            kind: 'unknown',
            credits: checked.credits,
            citation: CAP_CITATION,
            message: `The credits of ${unknownCredits.join(', ')} are unknown, so ${label} holds at least ${checked.credits} credits and is not checked against ${against}.`,
          }),
        );
      }
    }
    for (const v of violations) {
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
    for (const p of tiles) if (p.kind === 'course' && p.courseCode !== null && !plannedEarlier.has(p.courseCode)) plannedEarlier.set(p.courseCode, at);
  }

  const coverage = projectedCoverage(input, terms);
  issues.push(...coverage.issues);
  return { planId: input.planId, trainingType: rules.trainingType, terms: loads, issues, coverage: coverage.coverage };
}

const sitting = (courseCode: string, term: Term): string => `${courseCode}@${term.year}-${term.number}`;

export interface ProjectedTranscript {
  entries: TranscriptEntry[];
  /** The slots of each requirement group, as unnamed courses of it. */
  slotsByGroup: Map<string, CurriculumRuleGroup['courses']>;
}

/**
 * The transcript as it would stand with the plan completed: every course in progress passed, every
 * placed course a pass in its term, and every slot a pass of an unnamed course of its group. A course
 * the plan places in a term the transcript already has it in adds nothing: the tile shows that
 * sitting (ADR 0013), so the transcript's attempt stands alone, as it is, and no tie between two
 * attempts of one term is left for the audit to break.
 */
export function projectedTranscript(input: PlanCheckInput, terms: readonly BoardTerm[]): ProjectedTranscript {
  const { rules, catalogCredits } = input;
  const placed = placements(rules);
  const slotsByGroup = new Map<string, CurriculumRuleGroup['courses']>();
  const entries: TranscriptEntry[] = input.transcript.map((e) => (e.result === 'in_progress' ? { ...e, result: 'pass' as const } : e));
  const pass = (courseCode: string, credits: number, term: Term): TranscriptEntry => ({ courseCode, courseName: courseCode, credits, result: 'pass', grade: null, term });

  const sat = new Set(input.transcript.map((e) => sitting(e.courseCode, e.term)));

  for (const { term, placements: tiles } of terms) {
    tiles.forEach((p, position) => {
      if (p.kind === 'course' && p.courseCode !== null) {
        if (sat.has(sitting(p.courseCode, term))) return;
        const credits = plannedCredits(placed, catalogCredits, p.courseCode);
        if (credits !== undefined) entries.push(pass(p.courseCode, credits, term));
      } else if (p.requirementGroupId !== null && p.credits !== null) {
        // Lower case: never a catalog code (COURSE_CODE_PATTERN is capitals and digits).
        const code = `slot:${term.year}-${term.number}-${position}`;
        const slot = { code, nameVi: code, nameEn: null, credits: p.credits, countsTowardTotal: slotCountsTowardTotal(rules, p.requirementGroupId), countsTowardGpa: false };
        slotsByGroup.set(p.requirementGroupId, [...(slotsByGroup.get(p.requirementGroupId) ?? []), slot]);
        entries.push(pass(code, p.credits, term));
      }
    });
  }
  return { entries, slotsByGroup };
}

/**
 * The degree audit as it would stand with the plan completed: every placed course and every course
 * in progress passed in its term. A slot is an unnamed course of its group with the slot's credits,
 * so it counts, and overflows, as the course chosen for it would; it counts toward the total only
 * when every course of its group does.
 */
function projectedCoverage(input: PlanCheckInput, terms: readonly BoardTerm[]): { coverage: PlanCoverage; issues: PlanIssue[] } {
  const { rules } = input;
  const { entries: projected, slotsByGroup } = projectedTranscript(input, terms);

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
