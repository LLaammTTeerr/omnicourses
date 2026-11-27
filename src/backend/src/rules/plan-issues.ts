import type { CurriculumRuleGroup, CurriculumRules } from '../curriculum/curriculum-rules.js';
import { groupBy } from '../common/collections.js';
import { compareTerms, copyTerm, type Term, termKey, termLabel } from '../terms/term.js';
import type { TranscriptEntry } from '../transcript/transcript-entry.js';
import { courseRecords, type CourseRecord, recordBefore } from './attempts.js';
import { degreeAudit } from './audit.js';
import { type CapViolation, checkTermLoad, type LoadCourse, PETITION_NOTE, type TermLoadCheck } from './credit-caps.js';
import { type CountedLink, placements } from './coverage.js';
import { checkOfferingTerm, checkPrerequisites, passedOrAssumedBefore } from './prerequisites.js';
import {
  type BoardTerm,
  CITATIONS,
  type CombinedMinimumCoverage,
  type CreditSummary,
  type DegreeAudit,
  type GroupCoverage,
  type Placement,
  type PlanCoverage,
  type PlanIssue,
  type PlanIssuesReport,
  type PlanTermLoad,
} from './types.js';

interface PlanCheckInput {
  planId: string;
  rules: CurriculumRules;
  transcript: readonly TranscriptEntry[];
  terms: readonly BoardTerm[];
  catalogCredits: ReadonlyMap<string, number>;
}

interface PlanContext {
  rules: CurriculumRules;
  placed: ReadonlyMap<string, CountedLink>;
  records: ReadonlyMap<string, CourseRecord>;
  catalogCredits: ReadonlyMap<string, number>;
}

interface CourseTile {
  term: Term;
  position: number;
  courseCode: string;
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

export const courseCodesOf = (terms: readonly BoardTerm[]): string[] =>
  terms.flatMap((t) => t.placements.flatMap((p) => (p.kind === 'course' && p.courseCode !== null ? [p.courseCode] : [])));

const slotCountsTowardTotal = (rules: CurriculumRules, groupId: string | null): boolean =>
  rules.groups.find((g) => g.id === groupId)?.courses.every((c) => c.countsTowardTotal) ?? true;

const placedCredits = (plan: Pick<PlanContext, 'placed' | 'catalogCredits'>, code: string): number | undefined =>
  plan.placed.get(code)?.course.credits ?? plan.catalogCredits.get(code);

export function checkPlan(input: PlanCheckInput): PlanIssuesReport {
  const terms = [...input.terms].sort((a, b) => compareTerms(a.term, b.term));
  const plan: PlanContext = { rules: input.rules, placed: placements(input.rules), records: courseRecords(input.transcript), catalogCredits: input.catalogCredits };
  const issues: PlanIssue[] = [];
  const loads: PlanTermLoad[] = [];
  const firstPlacedIn = new Map<string, Term>();
  const plannedEarlier = new Map<string, Term>();

  for (const board of terms) {
    const checked = checkTerm(plan, board, firstPlacedIn, plannedEarlier);
    loads.push(checked.load);
    issues.push(...checked.issues);
    for (const p of board.placements) if (p.kind === 'course' && p.courseCode !== null && !plannedEarlier.has(p.courseCode)) plannedEarlier.set(p.courseCode, copyTerm(board.term));
  }

  const coverage = projectedCoverage(input, plan.placed, terms);
  issues.push(...coverage.issues);
  return { planId: input.planId, trainingType: input.rules.trainingType, terms: loads, issues, coverage: coverage.coverage };
}

function checkTerm(plan: PlanContext, { term, placements: tiles }: BoardTerm, firstPlacedIn: Map<string, Term>, plannedEarlier: ReadonlyMap<string, Term>) {
  const at = copyTerm(term);
  const passed = passedOrAssumedBefore(plan.records, plannedEarlier, term);
  const placementIssues: PlanIssue[] = [];
  const load: LoadCourse[] = [];
  const unknownCredits: string[] = [];

  tiles.forEach((placement, position) => {
    if (placement.kind === 'slot' || placement.courseCode === null) {
      load.push(slotLoad(plan.rules, placement));
      return;
    }
    const tile: CourseTile = { term: at, position, courseCode: placement.courseCode };
    const credits = placedCredits(plan, tile.courseCode);
    if (credits === undefined) unknownCredits.push(tile.courseCode);
    else load.push({ credits, excludedFromMinimum: plan.placed.get(tile.courseCode)?.course.countsTowardTotal === false });
    const first = firstPlacedIn.get(tile.courseCode);
    if (!first) firstPlacedIn.set(tile.courseCode, at);
    placementIssues.push(...courseIssues(plan, tile, { credits, first, passed }));
  });

  const checked = checkTermLoad(plan.rules.trainingType, term.number, load);
  return {
    load: { term: at, kind: checked.kind, credits: checked.credits, caps: checked.caps },
    issues: [...loadIssues(plan.rules, at, checked, unknownCredits), ...placementIssues],
  };
}

const slotLoad = (rules: CurriculumRules, slot: Placement): LoadCourse => ({
  credits: slot.credits ?? 0,
  excludedFromMinimum: !slotCountsTowardTotal(rules, slot.requirementGroupId),
});

function recordBeforeTile(plan: PlanContext, tile: CourseTile): CourseRecord | null {
  const record = plan.records.get(tile.courseCode);
  return record ? recordBefore(record, tile.term) : null;
}

interface CourseFacts {
  credits: number | undefined;
  first: Term | undefined;
  passed: ReadonlySet<string>;
}

function courseIssues(plan: PlanContext, tile: CourseTile, facts: CourseFacts): PlanIssue[] {
  return [
    facts.credits === undefined ? creditsNotRecorded(tile) : null,
    facts.first ? placedTwice(tile, facts.first) : null,
    plan.placed.has(tile.courseCode) ? null : notInCurriculum(plan.rules, tile),
    repeatIssue(recordBeforeTile(plan, tile), tile),
    prerequisiteIssue(plan.rules, tile, facts.passed),
    offeringIssue(plan.rules, tile),
  ].filter((i): i is PlanIssue => i !== null);
}

const creditsNotRecorded = (tile: CourseTile): PlanIssue =>
  issue({
    ...tile,
    code: 'credits_not_recorded',
    kind: 'unknown',
    citation: CITATIONS.termLoad,
    message: `${tile.courseCode} is not in the catalog, so its credits are unknown and left out of the load of ${termLabel(tile.term)}.`,
  });

const placedTwice = (tile: CourseTile, first: Term): PlanIssue =>
  issue({ ...tile, code: 'placed_twice', kind: 'violation', citation: CITATIONS.planModel, message: `${tile.courseCode} is already placed in ${termLabel(first)}; a plan places a course once.` });

const notInCurriculum = (rules: CurriculumRules, tile: CourseTile): PlanIssue =>
  issue({
    ...tile,
    code: 'not_in_curriculum',
    kind: 'flag',
    citation: CITATIONS.curriculum,
    message: `No requirement group of ${rules.curriculumCode} lists ${tile.courseCode}, so it counts toward nothing.`,
  });

function repeatIssue(standing: CourseRecord | null, tile: CourseTile): PlanIssue | null {
  if (standing?.passed) {
    return issue({
      ...tile,
      code: 'already_passed',
      kind: 'flag',
      citation: CITATIONS.gradeImprovement,
      message: `${tile.courseCode} is already passed. Taking it again is a grade improvement, and the last grade becomes official even if it is lower.`,
    });
  }
  if (standing?.inProgress) {
    return issue({
      ...tile,
      code: 'already_in_progress',
      kind: 'flag',
      citation: CITATIONS.gradeImprovement,
      message: `${tile.courseCode} is in progress before ${termLabel(tile.term)}, and the plan assumes it passes. Taking it again is a grade improvement, or a retake if it fails.`,
    });
  }
  return null;
}

function prerequisiteIssue(rules: CurriculumRules, tile: CourseTile, passed: ReadonlySet<string>): PlanIssue | null {
  const check = checkPrerequisites(rules.prerequisites.get(tile.courseCode) ?? null, passed);
  if (check.status === 'not_recorded') {
    return issue({
      ...tile,
      code: 'prerequisites_not_recorded',
      kind: 'unknown',
      citation: CITATIONS.prerequisite,
      message: `The prerequisites of ${tile.courseCode} are not recorded for ${rules.curriculumCode}: unknown, not checked.`,
    });
  }
  if (check.status === 'not_met') {
    return issue({
      ...tile,
      code: 'prerequisite_not_met',
      kind: 'violation',
      missingCourseCodes: check.missing,
      citation: CITATIONS.prerequisite,
      message: `${tile.courseCode} needs ${check.missing.join(', ')} passed before ${termLabel(tile.term)}.`,
    });
  }
  return null;
}

function offeringIssue(rules: CurriculumRules, tile: CourseTile): PlanIssue | null {
  const check = checkOfferingTerm(rules.offeringTerms.get(tile.courseCode) ?? null, tile.term);
  if (check.status === 'not_recorded') {
    return issue({
      ...tile,
      code: 'offering_terms_not_recorded',
      kind: 'unknown',
      citation: CITATIONS.offering,
      message: `The offering terms of ${tile.courseCode} are not recorded for ${rules.curriculumCode}: unknown, not checked.`,
    });
  }
  if (check.status === 'not_offered') {
    return issue({
      ...tile,
      code: 'not_offered',
      kind: 'violation',
      offeredTermNumbers: check.offeredTermNumbers,
      citation: CITATIONS.offering,
      message: `${tile.courseCode} is taught in term ${check.offeredTermNumbers.join(', ')}, not term ${tile.term.number}.`,
    });
  }
  return null;
}

function loadIssues(rules: CurriculumRules, term: Term, checked: TermLoadCheck, unknownCredits: readonly string[]): PlanIssue[] {
  const violations = unknownCredits.length ? checked.violations.filter((v) => v.rule === 'above_maximum') : checked.violations;
  return [
    checked.caps === null ? capsNotChecked(rules, term, checked) : null,
    unknownCredits.length ? loadNotChecked(term, checked, unknownCredits, violations.length > 0) : null,
    ...violations.map((v) => capViolationIssue(term, v)),
  ].filter((i): i is PlanIssue => i !== null);
}

const capsNotChecked = (rules: CurriculumRules, term: Term, checked: TermLoadCheck): PlanIssue =>
  issue({
    term,
    code: 'caps_not_checked',
    kind: 'unknown',
    credits: checked.credits,
    citation: CITATIONS.creditCaps,
    message: `The training type of ${rules.programCode} is not recorded, so the load of ${termLabel(term)} is not checked.`,
  });

function loadNotChecked(term: Term, checked: TermLoadCheck, unknownCredits: readonly string[], aboveMaximum: boolean): PlanIssue | null {
  if (checked.caps === null) return null;
  const { min, max } = checked.caps;
  const minOpen = checked.violations.some((v) => v.rule === 'below_minimum');
  const maxOpen = !aboveMaximum;
  if (!minOpen && !maxOpen) return null;
  const against = minOpen && maxOpen ? `the caps of ${min}–${max}` : minOpen ? `the minimum of ${min}` : `the maximum of ${max}`;
  return issue({
    term,
    code: 'load_not_checked',
    kind: 'unknown',
    credits: checked.credits,
    citation: CITATIONS.creditCaps,
    message: `The credits of ${unknownCredits.join(', ')} are unknown, so ${termLabel(term)} holds at least ${checked.credits} credits and is not checked against ${against}.`,
  });
}

function capViolationIssue(term: Term, violation: CapViolation): PlanIssue {
  const below = violation.rule === 'below_minimum';
  return issue({
    term,
    code: below ? 'load_below_minimum' : 'load_above_maximum',
    kind: 'flag',
    credits: violation.credits,
    limit: violation.limit,
    citation: violation.citation,
    message: `${termLabel(term)} holds ${violation.credits} credits, ${below ? 'below the minimum' : 'above the maximum'} of ${violation.limit}. ${PETITION_NOTE}`,
  });
}

const sitting = (courseCode: string, term: Term): string => `${courseCode}@${termKey(term)}`;

interface ProjectedTranscript {
  entries: TranscriptEntry[];
  slotsByGroup: Map<string, CurriculumRuleGroup['courses']>;
}

const passOf = (courseCode: string, credits: number, term: Term): TranscriptEntry => ({ courseCode, courseName: courseCode, credits, result: 'pass', grade: null, term });

export function projectedTranscript(input: PlanCheckInput, placed: ReadonlyMap<string, CountedLink>, terms: readonly BoardTerm[]): ProjectedTranscript {
  const { rules } = input;
  const entries: TranscriptEntry[] = input.transcript.map((e) => (e.result === 'in_progress' ? { ...e, result: 'pass' as const } : e));
  const sat = new Set(input.transcript.map((e) => sitting(e.courseCode, e.term)));
  const slots: { groupId: string; slot: CurriculumRuleGroup['courses'][number] }[] = [];

  for (const { term, placements: tiles } of terms) {
    tiles.forEach((tile, position) => {
      if (tile.kind === 'course' && tile.courseCode !== null) {
        if (sat.has(sitting(tile.courseCode, term))) return;
        const credits = placedCredits({ placed, catalogCredits: input.catalogCredits }, tile.courseCode);
        if (credits !== undefined) entries.push(passOf(tile.courseCode, credits, term));
      } else if (tile.requirementGroupId !== null && tile.credits !== null) {
        const code = `slot:${termKey(term)}-${position}`;
        slots.push({ groupId: tile.requirementGroupId, slot: { code, nameVi: code, nameEn: null, credits: tile.credits, countsTowardTotal: slotCountsTowardTotal(rules, tile.requirementGroupId), countsTowardGpa: false } });
        entries.push(passOf(code, tile.credits, term));
      }
    });
  }
  const slotsByGroup = new Map([...groupBy(slots, (s) => s.groupId)].map(([id, list]) => [id, list.map((s) => s.slot)]));
  return { entries, slotsByGroup };
}

function projectedAudit(input: PlanCheckInput, placed: ReadonlyMap<string, CountedLink>, terms: readonly BoardTerm[]): DegreeAudit {
  const { rules } = input;
  const { entries, slotsByGroup } = projectedTranscript(input, placed, terms);
  const withSlots: CurriculumRules = { ...rules, groups: rules.groups.map((g) => ({ ...g, courses: [...g.courses, ...(slotsByGroup.get(g.id) ?? [])] })) };
  return degreeAudit(withSlots, entries);
}

const projectedCredits = (g: GroupCoverage): number => g.passedCredits + g.overflowInCredits;

const notCovered = (fields: Partial<PlanIssue> & Pick<PlanIssue, 'message'>): PlanIssue =>
  issue({ code: 'requirement_not_covered', kind: 'violation', citation: CITATIONS.graduation, ...fields });

function groupNotCovered(group: GroupCoverage): PlanIssue {
  const credits = projectedCredits(group);
  const missing = group.kind === 'compulsory' ? group.courses.filter((c) => c.status !== 'passed' && c.status !== 'counted_in_other_group').map((c) => c.code) : [];
  return notCovered({
    requirementGroupId: group.id,
    missingCourseCodes: missing,
    credits,
    limit: group.requiredCredits,
    message: missing.length
      ? `With the plan completed, "${group.name}" still needs ${missing.join(', ')}.`
      : `With the plan completed, "${group.name}" has ${credits} of ${group.requiredCredits} credits.`,
  });
}

const minimumNotCovered = (minimum: CombinedMinimumCoverage): PlanIssue =>
  notCovered({
    combinedMinimumId: minimum.id,
    credits: minimum.credits,
    limit: minimum.creditsMin,
    message: `With the plan completed, "${minimum.name}" has ${minimum.credits} of at least ${minimum.creditsMin} credits.`,
  });

function totalNotCovered({ towardTotal, totalRequired }: CreditSummary): PlanIssue[] {
  if (totalRequired === null || towardTotal >= totalRequired) return [];
  return [
    notCovered({
      credits: towardTotal,
      limit: totalRequired,
      message: `With the plan completed, ${towardTotal} of the ${totalRequired} credits of the cohort total are covered.`,
    }),
  ];
}

function projectedCoverage(input: PlanCheckInput, placed: ReadonlyMap<string, CountedLink>, terms: readonly BoardTerm[]): { coverage: PlanCoverage; issues: PlanIssue[] } {
  const audit = projectedAudit(input, placed, terms);
  const issues = [...audit.groups.filter((g) => !g.met).map(groupNotCovered), ...audit.combinedMinimums.filter((m) => !m.met).map(minimumNotCovered), ...totalNotCovered(audit.credits)];
  const groups = audit.groups.map((g) => ({ id: g.id, name: g.name, kind: g.kind, requiredCredits: g.requiredCredits, credits: projectedCredits(g), remainingCredits: g.remainingCredits, met: g.met }));
  const combinedMinimums = audit.combinedMinimums.map((m) => ({ id: m.id, name: m.name, creditsMin: m.creditsMin, credits: m.credits, remainingCredits: m.remainingCredits, met: m.met }));
  const { towardTotal, totalRequired, remaining } = audit.credits;
  return {
    coverage: { groups, combinedMinimums, totalRequired, totalCredits: towardTotal, totalRemaining: remaining, graduation: audit.graduation.status },
    issues,
  };
}
