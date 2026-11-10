import { describe, expect, it } from 'vitest';
import { degreeAudit } from './audit.js';
import type { DegreeAudit, GroupCoverage } from './audit-types.js';
import { NOT_CHECKED_CONDITIONS } from './graduation.js';
import { course, graded, group, term, ungraded, zzCurriculum, zzGraduatingTranscript } from './testing/fixtures.js';

// Every expected number below is worked out by hand from the synthetic curriculum in
// testing/fixtures.ts (total 38: A bb 8, A tc 4, B 4, B + C 12, Non 4, TN 10).

const groupOf = (audit: DegreeAudit, id: string): GroupCoverage => audit.groups.find((g) => g.id === id)!;
const statusOf = (audit: DegreeAudit, groupId: string, code: string) => groupOf(audit, groupId).courses.find((c) => c.code === code)!.status;
const without = (code: string) => zzGraduatingTranscript().filter((e) => e.courseCode !== code);

describe('degree audit', () => {
  describe('a transcript that meets every requirement', () => {
    const audit = degreeAudit(zzCurriculum(), zzGraduatingTranscript());

    it('meets every group, the combined minimum and the total', () => {
      expect(audit.groups.map((g) => [g.id, g.passedCredits, g.requiredCredits, g.met])).toEqual([
        ['a-bb', 8, 8, true],
        ['a-tc', 4, 4, true],
        ['b', 4, 4, true],
        ['c', 8, null, true],
        ['non', 4, 4, true],
        ['tn', 10, 10, true],
      ]);
      expect(audit.combinedMinimums.map((m) => [m.credits, m.creditsMin, m.met, m.remainingCredits])).toEqual([[12, 12, true, 0]]);
      expect(audit.graduation.status).toBe('done');
      expect(audit.graduation.unmet).toEqual([]);
      // C has no minimum of its own, so it is no condition: its rule is the combined minimum B + C.
      expect(audit.graduation.met.map((c) => c.id)).toEqual(['group:a-bb', 'group:a-tc', 'group:b', 'group:non', 'group:tn', 'combined:bc', 'total_credits']);
    });

    it('counts credits: Thể dục is accumulated but outside the total (Điều 11.4, the curriculum)', () => {
      expect(audit.credits).toEqual({ accumulated: 40, towardTotal: 38, inProgressTowardTotal: 0, totalRequired: 38, remaining: 0, yearLevel: 2 });
    });

    it('averages the graded curriculum courses (Điều 15.1, 15.2.a)', () => {
      // (8·4 + 7·4 + 9·4 + 6·4 + 7.5·4 + 8.5·4 + 5·4 + 9·10) / 38 = 294 / 38 = 7.7368…
      // 4-point: (3.5 + 3 + 4 + 2.5 + 3 + 3.5 + 2)·4 + 4·10 = 126 / 38 = 3.3157…
      expect(audit.gpa).toEqual({ average: 7.74, accumulatedAverage: 7.74, accumulatedAverageFourPoint: 3.32, classification: 'good', gradedCredits: 38 });
    });

    it('summarises each term, with its averages and its load against the APCS caps', () => {
      expect(audit.terms.map((t) => [t.term, t.kind, t.credits, t.passedCredits, t.average, t.cumulativeAccumulatedAverage])).toEqual([
        [term(2024, 1), 'main', 12, 12, 8, 8],
        [term(2024, 2), 'main', 10, 10, 6.75, 7.5],
        [term(2024, 3), 'main', 8, 8, 6.75, 7.29],
        [term(2025, 1), 'main', 10, 10, 9, 7.74],
      ]);
      // Term 3 is a main term in a Tiên tiến program: 8 credits is below its minimum of 10.
      expect(audit.terms[2].capViolations.map((v) => [v.rule, v.credits, v.limit])).toEqual([['below_minimum', 8, 10]]);
      expect(audit.terms[0].caps).toEqual({ min: 10, max: 22 });
    });

    it('lists the conditions the data cannot check, never as met', () => {
      expect(audit.graduation.notChecked).toEqual(NOT_CHECKED_CONDITIONS);
      expect(audit.graduation.notChecked.map((c) => c.id)).toEqual([
        'no_prosecution_or_suspension',
        'defence_education_certificate',
        'foreign_language_standard',
        'it_standard',
        'study_time_limit',
      ]);
    });

    it('has no unmatched course and no warning', () => {
      expect(audit.unmatchedCourses).toEqual([]);
      expect(audit.warnings).toEqual([]);
    });
  });

  it('is not done when one group is short, and names only that group', () => {
    // B1 replaced by C3: B + C still 12 and the total still 38, but B's own minimum of 4 is not met.
    const audit = degreeAudit(zzCurriculum(), [...without('ZZB1'), graded('ZZC3', 4, 7, term(2024, 3))]);
    expect(audit.graduation.status).toBe('not_yet');
    expect(audit.graduation.unmet.map((c) => c.id)).toEqual(['group:b']);
    expect(groupOf(audit, 'b')).toMatchObject({ passedCredits: 0, remainingCredits: 4, met: false });
    expect(audit.credits.towardTotal).toBe(38);
  });

  it('handles an empty transcript', () => {
    const audit = degreeAudit(zzCurriculum(), []);
    expect(audit.credits).toEqual({ accumulated: 0, towardTotal: 0, inProgressTowardTotal: 0, totalRequired: 38, remaining: 38, yearLevel: 1 });
    expect(audit.gpa).toEqual({ average: null, accumulatedAverage: null, accumulatedAverageFourPoint: null, classification: null, gradedCredits: 0 });
    expect(audit.terms).toEqual([]);
    expect(audit.groups.flatMap((g) => g.courses.map((c) => c.status))).toEqual(Array(15).fill('not_taken'));
    expect(groupOf(audit, 'tn')).toMatchObject({ passedCredits: 0, remainingCredits: 10, met: false });
    // C has no minimum of its own: its rule is the combined minimum, which is not met.
    expect(groupOf(audit, 'c')).toMatchObject({ met: true, remainingCredits: null });
    expect(audit.combinedMinimums[0]).toMatchObject({ credits: 0, remainingCredits: 12, met: false });
    expect(audit.graduation.status).toBe('not_yet');
    // ...so C is never listed as a condition met with nothing taken.
    expect(audit.graduation.met).toEqual([]);
    expect(audit.graduation.unmet.map((c) => c.id)).toEqual(['group:a-bb', 'group:a-tc', 'group:b', 'group:non', 'group:tn', 'combined:bc', 'total_credits']);
  });

  it('counts a retaken course once, by its last attempt, and every sitting in its term average', () => {
    const transcript = [graded('ZZA1', 4, 3, term(2024, 1)), graded('ZZA2', 4, 7, term(2024, 1)), graded('ZZA1', 4, 8, term(2024, 2))];
    const audit = degreeAudit(zzCurriculum(), transcript);
    expect(groupOf(audit, 'a-bb')).toMatchObject({ passedCredits: 8, met: true });
    expect(statusOf(audit, 'a-bb', 'ZZA1')).toBe('passed');
    expect(audit.credits.accumulated).toBe(8);
    // Overall: official grades 8 and 7 → 7.5. Term 2024-1 counts the failed sitting: (3·4 + 7·4) / 8 = 5.
    expect(audit.gpa.average).toBe(7.5);
    expect(audit.terms.map((t) => [t.average, t.accumulatedAverage, t.cumulativeAccumulatedAverage, t.failedCourseCodes])).toEqual([
      [5, 7, 7, ['ZZA1']],
      [8, 8, 7.5, []],
    ]);
  });

  it('counts exempt and pass results in credits but not in the GPA (Điều 13.3)', () => {
    const audit = degreeAudit(zzCurriculum(), [ungraded('ZZB1', 4, 'exempt'), ungraded('ZZA1', 4, 'pass'), graded('ZZA2', 4, 6)]);
    expect(groupOf(audit, 'b')).toMatchObject({ passedCredits: 4, met: true });
    expect(groupOf(audit, 'b').courses[0]).toMatchObject({ status: 'passed', result: 'exempt', grade: null });
    expect(audit.credits.towardTotal).toBe(12);
    expect(audit.gpa).toMatchObject({ average: 6, accumulatedAverage: 6, gradedCredits: 4 });
  });

  it('keeps Thể dục and GDQP out of the GPA and the total even when graded (Điều 15.1.c)', () => {
    const audit = degreeAudit(zzCurriculum(), [graded('ZZPE1', 2, 10), graded('ZZN1', 4, 6)]);
    expect(audit.gpa.average).toBe(6);
    expect(audit.credits).toMatchObject({ accumulated: 6, towardTotal: 4 });
    expect(groupOf(audit, 'non')).toMatchObject({ passedCredits: 4, met: true });
    // The group needs its Thể dục course passed, though it adds nothing to the group's credits.
    expect(groupOf(degreeAudit(zzCurriculum(), [graded('ZZN1', 4, 6)]), 'non')).toMatchObject({ passedCredits: 4, remainingCredits: 0, met: false });
  });

  it('reports a failed course as failed, in the average but not the accumulated average', () => {
    const audit = degreeAudit(zzCurriculum(), [graded('ZZA1', 4, 4), graded('ZZA2', 4, 8), ungraded('ZZB1', 4, 'fail')]);
    expect(statusOf(audit, 'a-bb', 'ZZA1')).toBe('failed');
    expect(statusOf(audit, 'b', 'ZZB1')).toBe('failed');
    expect(groupOf(audit, 'a-bb')).toMatchObject({ passedCredits: 4, remainingCredits: 4, met: false });
    // Điều 15.1.a: (4·4 + 8·4) / 8 = 6. Điều 15.1.b: 8 only.
    expect(audit.gpa).toMatchObject({ average: 6, accumulatedAverage: 8 });
    expect(audit.terms[0].failedCourseCodes).toEqual(['ZZA1', 'ZZB1']);
    expect(audit.terms[0].passedCredits).toBe(4);
  });

  it('shows an in-progress course as in progress, not passed', () => {
    const audit = degreeAudit(zzCurriculum(), [...without('ZZT1'), ungraded('ZZT1', 10, 'in_progress', term(2025, 1))]);
    expect(groupOf(audit, 'tn')).toMatchObject({ passedCredits: 0, inProgressCredits: 10, remainingCredits: 0, met: false });
    expect(statusOf(audit, 'tn', 'ZZT1')).toBe('in_progress');
    expect(audit.credits).toMatchObject({ towardTotal: 28, inProgressTowardTotal: 10, remaining: 10 });
    expect(audit.terms.at(-1)).toMatchObject({ credits: 10, passedCredits: 0, average: null, inProgressCourseCodes: ['ZZT1'] });
    expect(audit.graduation.unmet.map((c) => c.id)).toEqual(['group:tn', 'total_credits']);
  });

  describe('a course in two groups', () => {
    const shared = course('ZZS1', 4);
    const rules = zzCurriculum({
      groups: [
        group('b', 'elective', 4, [course('ZZB1', 4), shared]),
        group('c', 'elective', null, [course('ZZC1', 4), shared]),
        group('z', 'compulsory', 4, [course('ZZZ1', 4), course('ZZS2', 4)]),
        group('y', 'elective', 4, [course('ZZS2', 4)]),
      ],
      combinedMinimums: [],
      totalCreditsMin: 8,
    });

    it('counts it once: in a compulsory group first, then by group name', () => {
      const audit = degreeAudit(rules, [graded('ZZS1', 4, 8), graded('ZZS2', 4, 8)]);
      expect(groupOf(audit, 'b')).toMatchObject({ passedCredits: 4, met: true });
      expect(groupOf(audit, 'c').passedCredits).toBe(0);
      expect(groupOf(audit, 'c').courses.find((c) => c.code === 'ZZS1')).toMatchObject({ status: 'counted_in_other_group', countedInGroupId: 'b' });
      // "Group z" sorts after "Group y", but z is compulsory, so ZZS2 counts there.
      expect(groupOf(audit, 'z').passedCredits).toBe(4);
      expect(groupOf(audit, 'y')).toMatchObject({ passedCredits: 0, met: false });
      expect(audit.credits.towardTotal).toBe(8);
    });

    it('shows a failed or in-progress course with its own status in each group, so every compulsory group still names it', () => {
      const twice = zzCurriculum({
        groups: [
          group('p', 'compulsory', 12, [course('ZZP1', 4), course('ZZF1', 4), course('ZZI1', 4)]),
          group('q', 'compulsory', 12, [course('ZZQ1', 4), course('ZZF1', 4), course('ZZI1', 4)]),
        ],
        combinedMinimums: [],
        totalCreditsMin: 16,
      });
      const audit = degreeAudit(twice, [graded('ZZP1', 4, 8), graded('ZZQ1', 4, 8), graded('ZZF1', 4, 3), ungraded('ZZI1', 4, 'in_progress')]);
      const shared = (id: string) => groupOf(audit, id).courses.filter((c) => c.code !== 'ZZP1' && c.code !== 'ZZQ1').map((c) => [c.code, c.status, c.countedInGroupId]);
      expect(shared('p')).toEqual([
        ['ZZF1', 'failed', null],
        ['ZZI1', 'in_progress', null],
      ]);
      // Group p sorts first, so the in-progress credits count there; group q still needs both courses passed.
      expect(shared('q')).toEqual([
        ['ZZF1', 'failed', null],
        ['ZZI1', 'in_progress', 'p'],
      ]);
      expect(groupOf(audit, 'p')).toMatchObject({ passedCredits: 4, inProgressCredits: 4, met: false });
      expect(groupOf(audit, 'q')).toMatchObject({ passedCredits: 4, inProgressCredits: 0, met: false });
    });

    it('shows a course not taken as not taken in each group', () => {
      const audit = degreeAudit(rules, []);
      expect(statusOf(audit, 'c', 'ZZS1')).toBe('not_taken');
      expect(statusOf(audit, 'b', 'ZZS1')).toBe('not_taken');
    });
  });

  describe('overflow, (A) tự chọn into (C) (APCS p.5)', () => {
    const allOfA = [graded('ZZAT1', 4, 7), graded('ZZAT2', 4, 7), graded('ZZAT3', 4, 7), graded('ZZB1', 4, 7)];

    it('counts the excess of A tự chọn toward C and the combined minimum', () => {
      const audit = degreeAudit(zzCurriculum(), allOfA);
      expect(groupOf(audit, 'a-tc')).toMatchObject({ passedCredits: 12, overflowOutCredits: 8, overflowToGroupId: 'c', met: true });
      expect(groupOf(audit, 'c')).toMatchObject({ passedCredits: 0, overflowInCredits: 8 });
      // B 4 + C 0 + 8 from A = 12.
      expect(audit.combinedMinimums[0]).toMatchObject({ credits: 12, met: true });
      // The cohort total counts each course once: 16.
      expect(audit.credits.towardTotal).toBe(16);
    });

    it('fails the combined minimum without the overflow rule', () => {
      const rules = zzCurriculum();
      rules.groups = rules.groups.map((g) => ({ ...g, overflowToGroupId: null }));
      expect(degreeAudit(rules, allOfA).combinedMinimums[0]).toMatchObject({ credits: 4, remainingCredits: 8, met: false });
    });

    it('overflows nothing below the minimum, and never in-progress credits', () => {
      const audit = degreeAudit(zzCurriculum(), [graded('ZZAT1', 4, 3), ungraded('ZZAT2', 4, 'in_progress'), ungraded('ZZAT3', 4, 'in_progress')]);
      expect(groupOf(audit, 'a-tc')).toMatchObject({ passedCredits: 0, inProgressCredits: 8, overflowOutCredits: 0, met: false });
      expect(groupOf(audit, 'c').overflowInCredits).toBe(0);
    });

    it('lets overflow into an elective group meet its minimum, and ignores a target outside the curriculum', () => {
      const rules = zzCurriculum({
        groups: [
          group('x', 'elective', 4, [course('ZZX1', 4), course('ZZX2', 4)], 'y'),
          group('y', 'elective', 4, [course('ZZY1', 4)]),
          group('w', 'elective', 4, [course('ZZW1', 4), course('ZZW2', 4)], 'not-in-this-curriculum'),
        ],
        combinedMinimums: [],
      });
      const audit = degreeAudit(rules, [graded('ZZX1', 4, 7), graded('ZZX2', 4, 7), graded('ZZW1', 4, 7), graded('ZZW2', 4, 7)]);
      expect(groupOf(audit, 'y')).toMatchObject({ passedCredits: 0, overflowInCredits: 4, remainingCredits: 0, met: true });
      expect(groupOf(audit, 'w')).toMatchObject({ overflowOutCredits: 0 });
    });

    it('counts overflow between two groups of one combined minimum once, and leaves out overflow to a group outside it', () => {
      const rules = zzCurriculum({
        groups: [
          group('p', 'elective', 4, [course('ZZP1', 4), course('ZZP2', 4)], 'q'),
          group('q', 'elective', null, [course('ZZQ1', 4)]),
          group('r', 'elective', 4, [course('ZZR1', 4), course('ZZR2', 4)], 'q'),
        ],
        combinedMinimums: [
          { id: 'pq', name: 'P + Q', creditsMin: 8, officialNotes: null, groupIds: ['p', 'q'] },
          { id: 'r-only', name: 'R', creditsMin: 8, officialNotes: 'synthetic', groupIds: ['r', 'missing'] },
        ],
      });
      const audit = degreeAudit(rules, ['ZZP1', 'ZZP2', 'ZZR1', 'ZZR2'].map((c) => graded(c, 4, 7)));
      // P 8 (its excess 4 already counted once) + Q 0 + 4 from R outside = 12.
      expect(audit.combinedMinimums.map((m) => [m.id, m.credits, m.met])).toEqual([
        ['pq', 12, true],
        // R passed 8 but sends 4 to Q, outside this minimum: 4 left.
        ['r-only', 4, false],
      ]);
    });
  });

  it('lists a transcript course outside the curriculum as unmatched and counts it toward nothing', () => {
    const audit = degreeAudit(zzCurriculum(), [graded('ZZ999', 3, 9), ungraded('ZZ998', 2, 'in_progress'), graded('ZZA1', 4, 6)]);
    expect(audit.unmatchedCourses).toEqual([
      { code: 'ZZ998', name: 'Course ZZ998', credits: 2, result: null, grade: null, passed: false, inProgress: true },
      { code: 'ZZ999', name: 'Course ZZ999', credits: 3, result: 'graded', grade: 9, passed: true, inProgress: false },
    ]);
    expect(audit.credits).toMatchObject({ accumulated: 4, towardTotal: 4 });
    expect(audit.gpa.average).toBe(6);
    expect(audit.warnings.map((w) => [w.code, w.courseCode])).toEqual([
      ['not_in_curriculum', 'ZZ998'],
      ['not_in_curriculum', 'ZZ999'],
    ]);
    // The term load still counts every course registered (Điều 7.1.b).
    expect(audit.terms[0].credits).toBe(9);
  });

  it('counts the smaller credit number when the transcript and the catalog disagree, and warns', () => {
    const audit = degreeAudit(zzCurriculum(), [graded('ZZA1', 3, 8), graded('ZZA2', 5, 6)]);
    // Every course is passed, so the group is met and nothing remains, though its credits are 7 of 8.
    expect(groupOf(audit, 'a-bb')).toMatchObject({ passedCredits: 7, requiredCredits: 8, met: true, remainingCredits: 0 });
    // (8·3 + 6·4) / 7 = 6.857…
    expect(audit.gpa.average).toBe(6.86);
    expect(audit.warnings.map((w) => [w.code, w.courseCode, w.transcriptCredits, w.curriculumCredits])).toEqual([
      ['credits_differ', 'ZZA1', [3], 4],
      ['credits_differ', 'ZZA2', [5], 4],
    ]);
  });

  it('gives every differing transcript figure once, smallest first', () => {
    const audit = degreeAudit(zzCurriculum(), [graded('ZZA1', 5, 3, term(2024, 1)), graded('ZZA1', 3, 4, term(2024, 2)), graded('ZZA1', 5, 8, term(2025, 1))]);
    expect(audit.warnings).toMatchObject([{ code: 'credits_differ', courseCode: 'ZZA1', transcriptCredits: [3, 5], curriculumCredits: 4 }]);
  });

  it('warns about two completed attempts in one term', () => {
    const audit = degreeAudit(zzCurriculum(), [graded('ZZA1', 4, 8), graded('ZZA1', 4, 3)]);
    expect(statusOf(audit, 'a-bb', 'ZZA1')).toBe('failed');
    expect(audit.warnings).toMatchObject([{ code: 'same_term_attempts', transcriptCredits: null, curriculumCredits: null }]);
  });

  it('checks no cap and no total when the curriculum does not record them', () => {
    const audit = degreeAudit(zzCurriculum({ trainingType: null, totalCreditsMin: null }), [graded('ZZA1', 4, 8)]);
    expect(audit.terms[0]).toMatchObject({ kind: null, caps: null, capViolations: [] });
    expect(audit.credits).toMatchObject({ totalRequired: null, remaining: null });
    expect(audit.graduation.notChecked.map((c) => c.id)).toContain('total_credits');
  });

  it('reads term 3 as a đại trà summer term with its own cap', () => {
    const audit = degreeAudit(zzCurriculum({ trainingType: 'standard' }), [graded('ZZT1', 10, 8, term(2024, 3)), graded('ZZA1', 4, 8, term(2024, 3))]);
    expect(audit.terms[0]).toMatchObject({ kind: 'summer', credits: 14, caps: { min: null, max: 12 } });
    expect(audit.terms[0].capViolations.map((v) => v.rule)).toEqual(['above_maximum']);
  });

  it('leaves Thể dục out of a đại trà minimum (Điều 7.2.a)', () => {
    const audit = degreeAudit(zzCurriculum({ trainingType: 'standard' }), [graded('ZZT1', 10, 8), graded('ZZA1', 4, 8), graded('ZZPE1', 2, 8)]);
    expect(audit.terms[0].capViolations.map((v) => [v.rule, v.credits])).toEqual([]);
    const short = degreeAudit(zzCurriculum({ trainingType: 'standard' }), [graded('ZZT1', 10, 8), graded('ZZPE1', 2, 8), graded('ZZA2', 2, 8)]);
    expect(short.terms[0].capViolations.map((v) => [v.rule, v.credits])).toEqual([['below_minimum', 12]]);
  });
});
