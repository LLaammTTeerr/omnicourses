import { describe, expect, it } from 'vitest';
import { degreeAudit } from './audit.js';
import type { DegreeAudit, GroupCoverage } from './types.js';
import { course, EXPECTED_NOT_CHECKED_CONDITIONS, graded, group, term, ungraded, zzCurriculum, zzGraduatingTranscript } from './testing/fixtures.js';

const groupOf = (audit: DegreeAudit, id: string): GroupCoverage => audit.groups.find((g) => g.id === id)!;
const statusOf = (audit: DegreeAudit, groupId: string, code: string) => groupOf(audit, groupId).courses.find((c) => c.code === code)!.status;
const halfUpTo2 = (numerator: number, denominator: number): number => Math.round((numerator * 100) / denominator) / 100;
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
      expect(audit.graduation.met.map((c) => c.id)).toEqual(['group:a-bb', 'group:a-tc', 'group:b', 'group:non', 'group:tn', 'combined:bc', 'total_credits']);
    });

    it('counts credits: Thể dục is accumulated but outside the total (Điều 11.4, the curriculum)', () => {
      expect(audit.credits).toEqual({ accumulated: 40, towardTotal: 38, inProgressTowardTotal: 0, totalRequired: 38, remaining: 0, yearLevel: 2 });
    });

    it('averages the graded curriculum courses (Điều 15.1, 15.2.a)', () => {
      const average = halfUpTo2(8 * 4 + 7 * 4 + 9 * 4 + 6 * 4 + 7.5 * 4 + 8.5 * 4 + 5 * 4 + 9 * 10, 38);
      const fourPoint = halfUpTo2((3.5 + 3 + 4 + 2.5 + 3 + 3.5 + 2) * 4 + 4 * 10, 38);
      expect(audit.gpa).toEqual({ average, accumulatedAverage: average, accumulatedAverageFourPoint: fourPoint, classification: 'good', gradedCredits: 38 });
    });

    it('summarises each term, with its averages and its load against the APCS caps', () => {
      expect(audit.terms.map((t) => [t.term, t.kind, t.credits, t.passedCredits, t.average, t.cumulativeAccumulatedAverage])).toEqual([
        [term(2024, 1), 'main', 12, 12, 8, 8],
        [term(2024, 2), 'main', 10, 10, 6.75, 7.5],
        [term(2024, 3), 'main', 8, 8, 6.75, 7.29],
        [term(2025, 1), 'main', 10, 10, 9, 7.74],
      ]);
      expect(audit.terms[2].capViolations.map((v) => [v.rule, v.credits, v.limit])).toEqual([['below_minimum', 8, 10]]);
      expect(audit.terms[0].caps).toEqual({ min: 10, max: 22 });
    });

    it('lists the conditions the data cannot check, never as met', () => {
      expect(audit.graduation.notChecked).toEqual(EXPECTED_NOT_CHECKED_CONDITIONS);
    });

    it('has no unmatched course and no warning', () => {
      expect(audit.unmatchedCourses).toEqual([]);
      expect(audit.warnings).toEqual([]);
    });
  });

  it('is not done when one group is short, and names only that group', () => {
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
    expect(groupOf(audit, 'c')).toMatchObject({ met: true, remainingCredits: null });
    expect(audit.combinedMinimums[0]).toMatchObject({ credits: 0, remainingCredits: 12, met: false });
    expect(audit.graduation.status).toBe('not_yet');
    expect(audit.graduation.met).toEqual([]);
    expect(audit.graduation.unmet.map((c) => c.id)).toEqual(['group:a-bb', 'group:a-tc', 'group:b', 'group:non', 'group:tn', 'combined:bc', 'total_credits']);
  });

  it('counts a retaken course once, by its last attempt, and every sitting in its term average', () => {
    const transcript = [graded('ZZA1', 4, 3, term(2024, 1)), graded('ZZA2', 4, 7, term(2024, 1)), graded('ZZA1', 4, 8, term(2024, 2))];
    const audit = degreeAudit(zzCurriculum(), transcript);
    expect(groupOf(audit, 'a-bb')).toMatchObject({ passedCredits: 8, met: true });
    expect(statusOf(audit, 'a-bb', 'ZZA1')).toBe('passed');
    expect(audit.credits.accumulated).toBe(8);
    expect(audit.gpa.average).toBe((8 + 7) / 2);
    expect(audit.terms.map((t) => [t.average, t.accumulatedAverage, t.cumulativeAccumulatedAverage, t.failedCourseCodes])).toEqual([
      [(3 * 4 + 7 * 4) / 8, 7, 7, ['ZZA1']],
      [8, 8, 7.5, []],
    ]);
  });

  describe('each term, as it stood at its end (UC-03 A2)', () => {
    const transcript = [
      graded('ZZA1', 4, 3, term(2024, 1)),
      graded('ZZA2', 4, 7, term(2024, 1)),
      ungraded('ZZPE1', 2, 'pass', term(2024, 1)),
      graded('ZZX1', 3, 9, term(2024, 1)),
      graded('ZZA1', 4, 8, term(2024, 2)),
      graded('ZZB1', 4, 6, term(2024, 2)),
      ungraded('ZZT1', 10, 'in_progress', term(2024, 3)),
    ];
    const full = degreeAudit(zzCurriculum(), transcript);
    const sameTermRetake = [graded('ZZA1', 4, 6, term(2024, 1)), graded('ZZA1', 4, 4, term(2024, 1)), graded('ZZA1', 4, 9, term(2024, 2))];

    it('lists every sitting of the term with its result, by course code, and the group it counts in', () => {
      expect(full.terms[0].attempts).toEqual([
        { code: 'ZZA1', name: 'Course ZZA1', credits: 4, result: 'graded', grade: 3, passed: false, inProgress: false, requirementGroupId: 'a-bb' },
        { code: 'ZZA2', name: 'Course ZZA2', credits: 4, result: 'graded', grade: 7, passed: true, inProgress: false, requirementGroupId: 'a-bb' },
        { code: 'ZZPE1', name: 'Course ZZPE1', credits: 2, result: 'pass', grade: null, passed: true, inProgress: false, requirementGroupId: 'non' },
        { code: 'ZZX1', name: 'Course ZZX1', credits: 3, result: 'graded', grade: 9, passed: true, inProgress: false, requirementGroupId: null },
      ]);
      expect(full.terms[2].attempts).toEqual([
        { code: 'ZZT1', name: 'Course ZZT1', credits: 10, result: 'in_progress', grade: null, passed: false, inProgress: true, requirementGroupId: 'tn' },
      ]);
      for (const t of full.terms) expect(t.attempts.reduce((sum, a) => sum + a.credits, 0)).toBe(t.credits);
    });

    it('gives the credits accumulated and toward the total at the end of each term', () => {
      expect(full.terms.map((t) => [t.cumulativeAccumulatedCredits, t.cumulativeTowardTotal])).toEqual([
        [6, 4],
        [14, 12],
        [14, 12],
      ]);
    });

    it("gives the change of the cumulative accumulated average from the previous term's, in points", () => {
      expect(full.terms.map((t) => [t.cumulativeAccumulatedAverage, t.cumulativeAccumulatedAverageChange])).toEqual([
        [7, null],
        [7, 0],
        [7, 0],
      ]);
      const rising = degreeAudit(zzCurriculum(), [graded('ZZA1', 4, 7, term(2024, 1)), graded('ZZA2', 4, 8, term(2024, 2)), graded('ZZB1', 4, 5, term(2024, 3))]);
      expect(rising.terms.map((t) => [t.cumulativeAccumulatedAverage, t.cumulativeAccumulatedAverageChange])).toEqual([
        [7, null],
        [7.5, 0.5],
        [6.67, -0.83],
      ]);
    });

    it('gives the year level and the classification of the cumulative average at the end of each term, never of the term average alone', () => {
      const graduating = degreeAudit(zzCurriculum(), zzGraduatingTranscript());
      expect(graduating.terms.map((t) => [t.cumulativeAccumulatedCredits, t.cumulativeYearLevel])).toEqual([
        [12, 1],
        [22, 1],
        [30, 1],
        [40, 2],
      ]);
      const rising = degreeAudit(zzCurriculum(), [graded('ZZA1', 4, 9, term(2024, 1)), graded('ZZA2', 4, 5, term(2024, 2))]);
      expect(rising.terms.map((t) => [t.average, t.cumulativeAccumulatedAverage, t.cumulativeClassification])).toEqual([
        [9, 9, 'excellent'],
        [5, 7, 'good'],
      ]);
      const old = degreeAudit(zzCurriculum({ cohortYear: 2020 }), [graded('ZZA1', 4, 6.5, term(2020, 1))]);
      expect(old.terms[0].cumulativeClassification).toBe('fairly_good');
      expect(old.terms[0].cumulativeClassification).toBe(old.gpa.classification);
      const exemptFirst = degreeAudit(zzCurriculum(), [ungraded('ZZB1', 4, 'exempt', term(2024, 1))]);
      expect(exemptFirst.terms[0]).toMatchObject({ cumulativeAccumulatedAverage: null, cumulativeClassification: null, cumulativeYearLevel: 1 });
    });

    it('has no change while a cumulative average is missing', () => {
      const audit = degreeAudit(zzCurriculum(), [ungraded('ZZB1', 4, 'exempt', term(2024, 1)), graded('ZZA1', 4, 8, term(2024, 2)), graded('ZZA2', 4, 6, term(2024, 3))]);
      expect(audit.terms.map((t) => [t.cumulativeAccumulatedAverage, t.cumulativeAccumulatedAverageChange])).toEqual([
        [null, null],
        [8, null],
        [7, -1],
      ]);
    });

    it('is the audit of the rows up to that term, and says which term', () => {
      full.terms.forEach((t, i) => {
        const asOf = degreeAudit(zzCurriculum(), transcript, t.term);
        expect(asOf.asOfTerm).toEqual(t.term);
        expect(asOf.terms).toEqual(full.terms.slice(0, i + 1));
        expect(asOf.gpa.accumulatedAverage).toBe(t.cumulativeAccumulatedAverage);
        expect([asOf.credits.accumulated, asOf.credits.towardTotal]).toEqual([t.cumulativeAccumulatedCredits, t.cumulativeTowardTotal]);
        expect(asOf.credits.yearLevel).toBe(t.cumulativeYearLevel);
        expect(asOf.gpa.classification).toBe(t.cumulativeClassification);
      });
      expect(full.asOfTerm).toBeNull();
      expect({ ...degreeAudit(zzCurriculum(), transcript, term(2024, 3)), asOfTerm: null }).toEqual(full);
    });

    it('gives the groups, combined minimums and remaining credits at the end of each term, as the audit of that term does', () => {
      for (const rows of [transcript, zzGraduatingTranscript(), sameTermRetake]) {
        for (const t of degreeAudit(zzCurriculum(), rows).terms) {
          const asOf = degreeAudit(zzCurriculum(), rows, t.term);
          expect(t.cumulativeRemaining).toBe(asOf.credits.remaining);
          expect(t.cumulativeGroups).toEqual(
            asOf.groups.map((g) => ({
              id: g.id,
              passedCredits: g.passedCredits,
              inProgressCredits: g.inProgressCredits,
              overflowInCredits: g.overflowInCredits,
              remainingCredits: g.remainingCredits,
              courses: g.courses.map((c) => ({ code: c.code, credits: c.credits, status: c.status, grade: c.grade })),
            })),
          );
          expect(t.cumulativeCombinedMinimums).toEqual(
            asOf.combinedMinimums.map((c) => ({ id: c.id, credits: c.credits, inProgressCredits: c.inProgressCredits, remainingCredits: c.remainingCredits })),
          );
        }
      }
      const first = full.terms[0];
      expect(first.cumulativeGroups.find((g) => g.id === 'a-bb')).toMatchObject({ passedCredits: 4, remainingCredits: 4 });
      expect(first.cumulativeGroups.find((g) => g.id === 'a-bb')!.courses.find((c) => c.code === 'ZZA1')).toEqual({ code: 'ZZA1', credits: 4, status: 'failed', grade: 3 });
      expect(full.terms[1].cumulativeGroups.find((g) => g.id === 'a-bb')!.courses.find((c) => c.code === 'ZZA1')).toMatchObject({ status: 'passed', grade: 8 });
      expect(full.terms[2].cumulativeGroups.find((g) => g.id === 'tn')!.courses.find((c) => c.code === 'ZZT1')!.status).toBe('in_progress');
    });

    it('reads a course failed by then as failed, though a later term passes it', () => {
      const first = degreeAudit(zzCurriculum(), transcript, term(2024, 1));
      expect(statusOf(first, 'a-bb', 'ZZA1')).toBe('failed');
      expect(groupOf(first, 'a-bb')).toMatchObject({ passedCredits: 4, remainingCredits: 4, met: false });
      expect(statusOf(first, 'tn', 'ZZT1')).toBe('not_taken');
      expect(first.credits).toMatchObject({ accumulated: 6, towardTotal: 4, inProgressTowardTotal: 0, yearLevel: 1 });
      expect(statusOf(full, 'a-bb', 'ZZA1')).toBe('passed');
    });

    it('is an empty audit before the first term and the whole one after the last', () => {
      const before = degreeAudit(zzCurriculum(), transcript, term(2023, 3));
      expect({ ...before, asOfTerm: null }).toEqual(degreeAudit(zzCurriculum(), []));
      expect({ ...degreeAudit(zzCurriculum(), transcript, term(2030, 1)), asOfTerm: null }).toEqual(full);
    });
  });

  it('counts exempt and pass results in credits but not in the GPA (Điều 13.3)', () => {
    const audit = degreeAudit(zzCurriculum(), [ungraded('ZZB1', 4, 'exempt'), ungraded('ZZA1', 4, 'pass'), graded('ZZA2', 4, 6)]);
    expect(groupOf(audit, 'b')).toMatchObject({ passedCredits: 4, met: true });
    expect(groupOf(audit, 'b').courses[0]).toMatchObject({ status: 'passed', result: 'exempt', grade: null });
    expect(audit.credits.towardTotal).toBe(12);
    expect(audit.gpa).toMatchObject({ average: 6, accumulatedAverage: 6, gradedCredits: 4 });
  });

  it('keeps Thể dục and GDQP out of the GPA and the total even when graded, but its group still needs them passed (Điều 15.1.c)', () => {
    const audit = degreeAudit(zzCurriculum(), [graded('ZZPE1', 2, 10), graded('ZZN1', 4, 6)]);
    expect(audit.gpa.average).toBe(6);
    expect(audit.credits).toMatchObject({ accumulated: 6, towardTotal: 4 });
    expect(groupOf(audit, 'non')).toMatchObject({ passedCredits: 4, met: true });
    expect(groupOf(degreeAudit(zzCurriculum(), [graded('ZZN1', 4, 6)]), 'non')).toMatchObject({ passedCredits: 4, remainingCredits: 0, met: false });
  });

  it('reports a failed course as failed, in the average but not the accumulated average (Điều 15.1.a, 15.1.b)', () => {
    const audit = degreeAudit(zzCurriculum(), [graded('ZZA1', 4, 4), graded('ZZA2', 4, 8), ungraded('ZZB1', 4, 'fail')]);
    expect(statusOf(audit, 'a-bb', 'ZZA1')).toBe('failed');
    expect(statusOf(audit, 'b', 'ZZB1')).toBe('failed');
    expect(groupOf(audit, 'a-bb')).toMatchObject({ passedCredits: 4, remainingCredits: 4, met: false });
    expect(audit.gpa).toMatchObject({ average: (4 * 4 + 8 * 4) / 8, accumulatedAverage: 8 });
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
      expect(audit.combinedMinimums[0]).toMatchObject({ credits: 4 + 0 + 8, met: true });
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
      expect(audit.combinedMinimums.map((m) => [m.id, m.credits, m.met])).toEqual([
        ['pq', 8 + 0 + 4, true],
        ['r-only', 4, false],
      ]);
    });
  });

  it('lists a transcript course outside the curriculum as unmatched and counts it toward nothing but its term load (Điều 7.1.b)', () => {
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
    expect(audit.terms[0].credits).toBe(9);
  });

  it('counts the smaller credit number when the transcript and the catalog disagree, and warns', () => {
    const audit = degreeAudit(zzCurriculum(), [graded('ZZA1', 3, 8), graded('ZZA2', 5, 6)]);
    expect(groupOf(audit, 'a-bb')).toMatchObject({ passedCredits: 7, requiredCredits: 8, met: true, remainingCredits: 0 });
    expect(audit.gpa.average).toBe(halfUpTo2(8 * 3 + 6 * 4, 7));
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

  it('deduplicates same-term attempts in the term summary using the conservative resolved attempt', () => {
    const audit = degreeAudit(zzCurriculum(), [graded('ZZA1', 4, 8), graded('ZZA1', 4, 3)]);
    expect(audit.terms[0]).toMatchObject({
      credits: 4,
      passedCredits: 0,
      average: 3,
      accumulatedAverage: null,
      failedCourseCodes: ['ZZA1'],
    });
    expect(audit.terms[0].attempts).toMatchObject([{ code: 'ZZA1', credits: 4, grade: 3, passed: false }]);
    expect(audit.warnings).toMatchObject([{ code: 'same_term_attempts', courseCode: 'ZZA1', transcriptCredits: null, curriculumCredits: null }]);

    const inProgressTwice = degreeAudit(zzCurriculum(), [ungraded('ZZA1', 4, 'in_progress'), ungraded('ZZA1', 4, 'in_progress')]);
    expect(inProgressTwice.terms[0]).toMatchObject({
      credits: 4,
      passedCredits: 0,
      average: null,
      accumulatedAverage: null,
      inProgressCourseCodes: ['ZZA1'],
    });
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
