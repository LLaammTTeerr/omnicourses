import { describe, expect, it } from 'vitest';
import type { CurriculumRules } from '../curriculum/curriculum-rules.reader.js';
import type { BoardTerm, Placement } from '../plans/plan-board.js';
import type { PlanIssue } from '../plans/plan-issues.js';
import type { Term } from '../terms/term.js';
import type { TranscriptEntry } from '../transcript/transcript-entry.js';
import { CAP_CITATION, PETITION_NOTE } from './credit-caps.js';
import { checkPlan, CURRICULUM_CITATION, GRADUATION_CITATION, IMPROVEMENT_CITATION, OFFERING_CITATION, PLAN_MODEL_CITATION, PREREQUISITE_CITATION } from './plan-issues.js';
import { course as fixtureCourse, graded, group, term, ungraded, zzCurriculum } from './testing/fixtures.js';

// Synthetic curriculum and transcripts only (AGENTS.md hard rule 3): zzCurriculum is Tiên tiến,
// 10–22 credits in every term, and needs 38 credits.

const course = (courseCode: string): Placement => ({ kind: 'course', courseCode, requirementGroupId: null, credits: null });
const slot = (requirementGroupId: string, credits: number): Placement => ({ kind: 'slot', courseCode: null, requirementGroupId, credits });
const at = (t: Term, ...placements: Placement[]): BoardTerm => ({ term: t, placements });

const ALL_CODES = zzCurriculum().groups.flatMap((g) => g.courses.map((c) => c.code));
const NONE: Record<string, string[]> = Object.fromEntries(ALL_CODES.map((c) => [c, []]));
const EVERY_TERM: Record<string, number[]> = Object.fromEntries(ALL_CODES.map((c) => [c, [1, 2, 3]]));
/** A group wholly outside the cohort total, like CLC 2025's Giáo dục thể chất. */
const PE_GROUP = group('pe', 'compulsory', 2, [fixtureCourse('ZZPE2', 2, { countsTowardTotal: false, countsTowardGpa: false })]);

interface Options {
  transcript?: TranscriptEntry[];
  rules?: CurriculumRules;
  /** Recorded prerequisites; by default every curriculum course is recorded with none. */
  prerequisites?: Record<string, string[]>;
  /** Recorded offering terms; by default every curriculum course is taught in every term. */
  offering?: Record<string, number[]>;
  /** Catalog credits of courses outside the curriculum. */
  catalog?: Record<string, number>;
}

function check(terms: BoardTerm[], options: Options = {}) {
  const prerequisites = options.prerequisites ?? Object.fromEntries(ALL_CODES.map((c) => [c, []]));
  const offering = options.offering ?? Object.fromEntries(ALL_CODES.map((c) => [c, [1, 2, 3]]));
  return checkPlan({
    planId: 'plan-1',
    rules: options.rules ?? zzCurriculum(),
    courseRules: { prerequisites: new Map(Object.entries(prerequisites)), offeringTerms: new Map(Object.entries(offering)) },
    transcript: options.transcript ?? [],
    terms,
    catalogCredits: new Map(Object.entries(options.catalog ?? {})),
  });
}

const codes = (issues: PlanIssue[]) => issues.map((i) => i.code);
const termIssues = (issues: PlanIssue[]) => issues.filter((i) => i.code !== 'requirement_not_covered');

/** Every requirement of zzCurriculum, 10–22 credits a term: 12, 10 and 18. */
const COMPLETE_PLAN = [
  at(term(2024, 1), course('ZZA1'), course('ZZA2'), course('ZZN1')),
  at(term(2024, 2), course('ZZPE1'), course('ZZAT1'), course('ZZB1')),
  at(term(2024, 3), course('ZZC1'), course('ZZC2'), course('ZZT1')),
];

describe('checkPlan', () => {
  it('finds nothing in a complete plan within the caps whose rules are all recorded and met', () => {
    const report = check(COMPLETE_PLAN);
    expect(report.issues).toEqual([]);
    expect(report.planId).toBe('plan-1');
    expect(report.trainingType).toBe('advanced');
    expect(report.terms).toEqual([
      { term: term(2024, 1), kind: 'main', credits: 12, caps: { min: 10, max: 22 } },
      { term: term(2024, 2), kind: 'main', credits: 10, caps: { min: 10, max: 22 } },
      { term: term(2024, 3), kind: 'main', credits: 18, caps: { min: 10, max: 22 } },
    ]);
    expect(report.coverage).toMatchObject({ totalRequired: 38, totalCredits: 38, totalRemaining: 0, graduation: 'done' });
    expect(report.coverage.groups.every((g) => g.met)).toBe(true);
    expect(report.coverage.combinedMinimums).toEqual([{ id: 'bc', name: 'B + C', creditsMin: 12, credits: 12, remainingCredits: 0, met: true }]);
  });

  describe('prerequisites (Điều 3.1.c)', () => {
    const prerequisites = { ...Object.fromEntries(ALL_CODES.map((c) => [c, []])), ZZB1: ['ZZA2', 'ZZA1'] };

    it('reports a prerequisite neither passed nor placed in an earlier term; the same term is not before', () => {
      const report = check([at(term(2025, 1), course('ZZA1'), course('ZZB1'), course('ZZA2'))], { prerequisites });
      expect(termIssues(report.issues)).toEqual([
        {
          code: 'prerequisite_not_met',
          kind: 'violation',
          term: term(2025, 1),
          position: 1,
          courseCode: 'ZZB1',
          requirementGroupId: null,
          combinedMinimumId: null,
          missingCourseCodes: ['ZZA1', 'ZZA2'],
          offeredTermNumbers: [],
          credits: null,
          limit: null,
          citation: PREREQUISITE_CITATION,
          message: 'ZZB1 needs ZZA1, ZZA2 passed before 2025–2026 term 1.',
        },
      ]);
    });

    it('counts a prerequisite placed in an earlier term, or passed in the transcript before the term', () => {
      const report = check([at(term(2025, 1), course('ZZA1'), course('ZZN1'), course('ZZC1')), at(term(2025, 2), course('ZZB1'), course('ZZC2'), course('ZZC3'))], {
        prerequisites,
        transcript: [graded('ZZA2', 4, 6, term(2024, 3))],
      });
      expect(codes(termIssues(report.issues))).toEqual([]);
    });

    it('counts a course in progress before the term, as the plan assumes it is passed', () => {
      const report = check([at(term(2025, 1), course('ZZB1'), course('ZZC1'), course('ZZC2'))], {
        prerequisites,
        transcript: [ungraded('ZZA1', 4, 'in_progress', term(2024, 3)), graded('ZZA2', 4, 7, term(2024, 1))],
      });
      expect(codes(termIssues(report.issues))).toEqual([]);
    });

    it('does not count a prerequisite whose last completed attempt failed (Điều 14.1.a)', () => {
      const report = check([at(term(2025, 1), course('ZZB1'), course('ZZC1'), course('ZZC2'))], {
        prerequisites,
        transcript: [graded('ZZA1', 4, 8, term(2024, 1)), graded('ZZA1', 4, 3, term(2024, 2)), graded('ZZA2', 4, 7, term(2024, 1))],
      });
      expect(termIssues(report.issues)).toMatchObject([{ code: 'prerequisite_not_met', courseCode: 'ZZB1', missingCourseCodes: ['ZZA1'] }]);
    });

    it('follows the transcript over a placement in a term it records a fail in, as coverage does', () => {
      const withA2 = { ...Object.fromEntries(ALL_CODES.map((c) => [c, []])), ZZA2: ['ZZA1'] };
      const report = check([at(term(2025, 1), course('ZZA1')), at(term(2025, 2), course('ZZA2'))], { prerequisites: withA2, transcript: [graded('ZZA1', 4, 3, term(2025, 1))] });
      expect(termIssues(report.issues)).toContainEqual(expect.objectContaining({ code: 'prerequisite_not_met', term: term(2025, 2), courseCode: 'ZZA2', missingCourseCodes: ['ZZA1'] }));
      expect(report.issues).toContainEqual(expect.objectContaining({ code: 'requirement_not_covered', requirementGroupId: 'a-bb', missingCourseCodes: ['ZZA1'] }));

      // A fail recorded in a later term than the placement wins too; the transcript's last completed attempt counts (Điều 14.1.a).
      const later = check([at(term(2025, 1), course('ZZA1')), at(term(2025, 3), course('ZZA2'))], { prerequisites: withA2, transcript: [graded('ZZA1', 4, 3, term(2025, 2))] });
      expect(termIssues(later.issues)).toContainEqual(expect.objectContaining({ code: 'prerequisite_not_met', courseCode: 'ZZA2', missingCourseCodes: ['ZZA1'] }));

      // A pass, or an attempt still in progress, in the placement's term keeps the placement's assumption.
      for (const transcript of [[graded('ZZA1', 4, 6, term(2025, 1))], [ungraded('ZZA1', 4, 'in_progress', term(2025, 1))], [graded('ZZA1', 4, 3, term(2025, 1)), graded('ZZA1', 4, 7, term(2025, 2))]]) {
        const fine = check([at(term(2025, 1), course('ZZA1')), at(term(2025, 3), course('ZZA2'))], { prerequisites: withA2, transcript });
        expect(fine.issues.filter((i) => i.code === 'prerequisite_not_met')).toEqual([]);
      }
    });

    it('reports unrecorded prerequisites as unknown, never as met or not met', () => {
      const { ZZB1: _dropped, ...withoutB1 } = prerequisites;
      const report = check([at(term(2025, 1), course('ZZB1'), course('ZZC1'), course('ZZC2'))], { prerequisites: withoutB1 });
      expect(termIssues(report.issues)).toMatchObject([
        { code: 'prerequisites_not_recorded', kind: 'unknown', term: term(2025, 1), position: 0, courseCode: 'ZZB1', missingCourseCodes: [], citation: PREREQUISITE_CITATION },
      ]);
    });
  });

  describe('offering terms (Điều 6.5, 7.1.a)', () => {
    const offering = { ...Object.fromEntries(ALL_CODES.map((c) => [c, [1, 2, 3]])), ZZB1: [1, 3] };

    it('reports a course placed in a term number it is not taught in', () => {
      const report = check([at(term(2025, 2), course('ZZB1'), course('ZZC1'), course('ZZC2'))], { offering });
      expect(termIssues(report.issues)).toMatchObject([
        { code: 'not_offered', kind: 'violation', term: term(2025, 2), position: 0, courseCode: 'ZZB1', offeredTermNumbers: [1, 3], citation: OFFERING_CITATION },
      ]);
      expect(codes(termIssues(check([at(term(2025, 3), course('ZZB1'), course('ZZC1'), course('ZZC2'))], { offering }).issues))).toEqual([]);
    });

    it('reports unrecorded offering terms as unknown, never as offered or not', () => {
      const { ZZB1: _dropped, ...withoutB1 } = offering;
      const report = check([at(term(2025, 2), course('ZZB1'), course('ZZC1'), course('ZZC2'))], { offering: withoutB1 });
      expect(termIssues(report.issues)).toMatchObject([{ code: 'offering_terms_not_recorded', kind: 'unknown', courseCode: 'ZZB1', offeredTermNumbers: [], citation: OFFERING_CITATION }]);
    });
  });

  describe('credit caps (Điều 7.2, ADR 0012)', () => {
    it('flags a term below the minimum and one above the maximum, with the petition route, slots included', () => {
      const report = check([
        at(term(2025, 1), course('ZZA1'), slot('b', 3)),
        at(term(2025, 2), course('ZZA2'), course('ZZB1'), course('ZZB2'), course('ZZC1'), course('ZZC2'), course('ZZC3')),
      ]);
      expect(report.terms.map((t) => t.credits)).toEqual([7, 24]);
      expect(termIssues(report.issues)).toEqual([
        expect.objectContaining({ code: 'load_below_minimum', kind: 'flag', term: term(2025, 1), position: null, credits: 7, limit: 10, citation: CAP_CITATION }),
        expect.objectContaining({ code: 'load_above_maximum', kind: 'flag', term: term(2025, 2), position: null, credits: 24, limit: 22, citation: CAP_CITATION }),
      ]);
      expect(report.issues[0].message).toBe(`2025–2026 term 1 holds 7 credits, below the minimum of 10. ${PETITION_NOTE}`);
    });

    it('applies the đại trà caps: term 3 is a summer term of at most 12, and GDTC is left out of the minimum', () => {
      const rules = zzCurriculum({ trainingType: 'standard' });
      const report = check(
        [
          at(term(2025, 1), course('ZZA1'), course('ZZA2'), course('ZZN1'), course('ZZPE1')),
          at(term(2025, 3), course('ZZB1'), course('ZZB2'), course('ZZC1'), course('ZZC2')),
        ],
        { rules },
      );
      expect(report.terms).toMatchObject([
        { kind: 'main', credits: 14, caps: { min: 14, max: 25 } },
        { kind: 'summer', credits: 16, caps: { min: null, max: 12 } },
      ]);
      expect(termIssues(report.issues)).toMatchObject([
        { code: 'load_below_minimum', term: term(2025, 1), credits: 12, limit: 14 },
        { code: 'load_above_maximum', term: term(2025, 3), credits: 16, limit: 12 },
      ]);
    });

    it('leaves a slot of a group outside the total out of the đại trà minimum, as its course would be', () => {
      const rules = zzCurriculum({ trainingType: 'standard', groups: [...zzCurriculum().groups, PE_GROUP] });
      const options = { rules, prerequisites: { ...NONE, ZZPE2: [] }, offering: { ...EVERY_TERM, ZZPE2: [1, 2, 3] } };
      const real = check([at(term(2025, 1), course('ZZA1'), course('ZZA2'), course('ZZB1'), course('ZZPE2'))], options);
      const held = check([at(term(2025, 1), course('ZZA1'), course('ZZA2'), course('ZZB1'), slot('pe', 2))], options);
      for (const report of [real, held]) {
        expect(report.terms[0].credits).toBe(14);
        expect(termIssues(report.issues)).toMatchObject([{ code: 'load_below_minimum', credits: 12, limit: 14 }]);
      }
      // A slot whose group the curriculum no longer has counts toward the minimum, as any course does.
      expect(termIssues(check([at(term(2025, 1), course('ZZA1'), course('ZZA2'), course('ZZB1'), slot('gone', 2))], options).issues)).toEqual([]);
    });

    it('reports the caps as not checked when the training type is not recorded', () => {
      const report = check([at(term(2025, 1), course('ZZA1'))], { rules: zzCurriculum({ trainingType: null }) });
      expect(report.trainingType).toBeNull();
      expect(report.terms).toEqual([{ term: term(2025, 1), kind: null, credits: 4, caps: null }]);
      expect(termIssues(report.issues)).toMatchObject([{ code: 'caps_not_checked', kind: 'unknown', term: term(2025, 1), credits: 4, citation: CAP_CITATION }]);
    });
  });

  describe('repeats', () => {
    it('reports a course placed twice, at its second placement (an unsaved draft: the database refuses it)', () => {
      const report = check([at(term(2025, 1), course('ZZA1'), course('ZZB1'), course('ZZC1')), at(term(2025, 2), course('ZZC2'), course('ZZB1'), course('ZZC3'))]);
      expect(termIssues(report.issues)).toEqual([
        expect.objectContaining({ code: 'placed_twice', kind: 'violation', term: term(2025, 2), position: 1, courseCode: 'ZZB1', citation: PLAN_MODEL_CITATION }),
      ]);
    });

    it('flags a course the transcript has passed before the term, as a grade improvement (Điều 14.2)', () => {
      const transcript = [graded('ZZA1', 4, 6, term(2024, 1)), graded('ZZA2', 4, 4, term(2024, 1)), graded('ZZN1', 4, 7, term(2025, 1))];
      const report = check([at(term(2025, 1), course('ZZA1'), course('ZZA2'), course('ZZN1'))], { transcript });
      // ZZA2 failed: a retake, nothing to flag. ZZN1 passed in the same term: the plan shows that term as it was.
      expect(termIssues(report.issues)).toEqual([
        expect.objectContaining({ code: 'already_passed', kind: 'flag', term: term(2025, 1), position: 0, courseCode: 'ZZA1', citation: IMPROVEMENT_CITATION }),
      ]);
    });

  });

  describe('courses outside the curriculum', () => {
    it('flags a catalog course no group lists, counts its credits in the load, and finds no recorded rules for it', () => {
      const report = check([at(term(2025, 1), course('ZZA1'), course('ZZX9'), course('ZZC1'))], { catalog: { ZZX9: 3 } });
      expect(report.terms[0].credits).toBe(11);
      expect(codes(termIssues(report.issues))).toEqual(['not_in_curriculum', 'prerequisites_not_recorded', 'offering_terms_not_recorded']);
      expect(report.issues[0]).toMatchObject({ courseCode: 'ZZX9', position: 1, kind: 'flag', citation: CURRICULUM_CITATION });
    });

    it('reports a course missing from the catalog as unknown credits, left out of the load', () => {
      const report = check([at(term(2025, 1), course('ZZA1'), course('ZZGONE'), course('ZZC1'), course('ZZC2'))], {
        prerequisites: { ZZGONE: [], ZZA1: [], ZZC1: [], ZZC2: [] },
        offering: { ZZGONE: [1], ZZA1: [1], ZZC1: [1], ZZC2: [1] },
      });
      expect(report.terms[0].credits).toBe(12);
      expect(termIssues(report.issues)).toMatchObject([
        { code: 'credits_not_recorded', kind: 'unknown', courseCode: 'ZZGONE', position: 1 },
        { code: 'not_in_curriculum', courseCode: 'ZZGONE' },
      ]);
    });
  });

  describe('coverage with the plan completed (Điều 17.3.b)', () => {
    it('reports each group, combined minimum and the total still short, after the term issues', () => {
      const report = check([at(term(2025, 1), course('ZZA1'), course('ZZB1'), course('ZZT2'))]);
      const coverage = report.issues.filter((i) => i.code === 'requirement_not_covered');
      expect(report.issues.slice(-coverage.length)).toEqual(coverage);
      expect(coverage).toEqual([
        expect.objectContaining({ kind: 'violation', term: null, requirementGroupId: 'a-bb', missingCourseCodes: ['ZZA2'], credits: 4, limit: 8, citation: GRADUATION_CITATION }),
        expect.objectContaining({ requirementGroupId: 'a-tc', missingCourseCodes: [], credits: 0, limit: 4 }),
        expect.objectContaining({ requirementGroupId: 'non', missingCourseCodes: ['ZZN1', 'ZZPE1'], credits: 0, limit: 4 }),
        expect.objectContaining({ requirementGroupId: 'tn', credits: 5, limit: 10 }),
        expect.objectContaining({ requirementGroupId: null, combinedMinimumId: 'bc', credits: 4, limit: 12 }),
        expect.objectContaining({ requirementGroupId: null, combinedMinimumId: null, credits: 13, limit: 38 }),
      ]);
      expect(coverage[0].message).toBe('With the plan completed, "Group a-bb" still needs ZZA2.');
      expect(coverage[1].message).toBe('With the plan completed, "Group a-tc" has 0 of 4 credits.');
      expect(report.coverage).toMatchObject({ totalCredits: 13, totalRemaining: 25, graduation: 'not_yet' });
      expect(report.coverage.groups.find((g) => g.id === 'b')).toEqual({ id: 'b', name: 'Group b', kind: 'elective', requiredCredits: 4, credits: 4, remainingCredits: 0, met: true });
    });

    it('counts the transcript, courses in progress and slots as the course chosen for them would count', () => {
      const transcript = [graded('ZZA1', 4, 8, term(2024, 1)), graded('ZZA2', 4, 7, term(2024, 1)), ungraded('ZZN1', 4, 'in_progress', term(2024, 2))];
      const report = check(
        [
          at(term(2024, 3), course('ZZPE1'), slot('a-tc', 8), course('ZZB1')),
          at(term(2025, 1), course('ZZC1'), course('ZZT1')),
        ],
        { transcript },
      );
      expect(report.issues).toEqual([]);
      // a-tc's 8 slot credits pass its minimum of 4; the other 4 overflow into C, so B + C = 4 + 4 + 4.
      expect(report.coverage.groups.find((g) => g.id === 'a-tc')).toMatchObject({ credits: 8, met: true });
      expect(report.coverage.groups.find((g) => g.id === 'c')).toMatchObject({ credits: 8, met: true });
      expect(report.coverage).toMatchObject({ totalCredits: 38, graduation: 'done' });
    });

    it('counts a slot toward the total only when every course of its group counts toward it', () => {
      const rules = zzCurriculum({ groups: [...zzCurriculum().groups, PE_GROUP] });
      const options = { rules, prerequisites: { ...NONE, ZZPE2: [] }, offering: { ...EVERY_TERM, ZZPE2: [1, 2, 3] } };
      const total = (...placements: Placement[]) => check([at(term(2025, 1), ...placements)], options).coverage.totalCredits;
      expect(total(course('ZZA1'))).toBe(4);
      expect(total(course('ZZA1'), course('ZZPE2'))).toBe(4);
      expect(total(course('ZZA1'), slot('pe', 2))).toBe(4);
      // `non` mixes ZZN1 (counted) with ZZPE1 (not): the slot may hold either, so it is not counted.
      expect(total(course('ZZA1'), slot('non', 2))).toBe(4);
      expect(total(course('ZZA1'), slot('b', 4))).toBe(8);
    });

    it('says nothing about the total when the cohort total is not recorded', () => {
      const report = check(COMPLETE_PLAN.slice(0, 1), { rules: zzCurriculum({ totalCreditsMin: null }) });
      expect(report.coverage).toMatchObject({ totalRequired: null, totalRemaining: null });
      expect(report.issues.some((i) => i.code === 'requirement_not_covered' && i.requirementGroupId === null && i.combinedMinimumId === null)).toBe(false);
    });
  });

  it('orders issues by term even when the board is not, and an empty plan has only coverage issues', () => {
    const report = check([at(term(2025, 2), course('ZZC1')), at(term(2025, 1), course('ZZA1'))]);
    expect(report.terms.map((t) => t.term)).toEqual([term(2025, 1), term(2025, 2)]);
    expect(termIssues(report.issues).map((i) => i.term)).toEqual([term(2025, 1), term(2025, 2)]);
    const empty = check([]);
    expect(empty.terms).toEqual([]);
    expect(new Set(codes(empty.issues))).toEqual(new Set(['requirement_not_covered']));
  });
});
