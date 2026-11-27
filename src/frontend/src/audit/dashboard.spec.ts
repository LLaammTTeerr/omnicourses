import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../calendar/api.js';
import type { DegreeAudit, TermSummary } from './api.js';
import { calendarEnd, Dashboard, segments, termShort } from './dashboard.js';
import { course, degreeAudit, group, GROUP_A, GROUP_MATH } from './testing/fixtures.js';

const t = (year: number, number: 1 | 2 | 3) => ({ year, number });

const failedZZ202 = { code: 'ZZ202', name: 'Học phần thử ZZ202', credits: 4, result: 'graded' as const, grade: 4.5, passed: false, inProgress: false, requirementGroupId: GROUP_A };

function terms(): TermSummary[] {
  const first = degreeAudit().terms[0]!;
  return [
    { ...first, failedCourseCodes: ['ZZ202'], attempts: [...first.attempts, failedZZ202] },
    { ...first, term: t(2024, 2), average: null, cumulativeAccumulatedAverageChange: 0, attempts: [] },
    { ...first, term: t(2024, 3), average: 9, cumulativeAccumulatedAverageChange: 0.12, attempts: [] },
  ];
}

function pastAudit(): DegreeAudit {
  const base = degreeAudit();
  return degreeAudit({
    asOfTerm: t(2024, 1),
    credits: { ...base.credits, towardTotal: 4 },
    groups: [
      base.groups[0]!,
      group(GROUP_A, base.groups[1]!.name, {
        passedCredits: 4,
        remainingCredits: 4,
        courses: [course('ZZ201', { status: 'passed', result: 'graded', grade: 8 }), course('ZZ202', { status: 'failed', result: 'graded', grade: 4.5 })],
      }),
      base.groups[2]!,
    ],
  });
}

function dashboard(past: ReadonlyMap<string, DegreeAudit> = new Map([['2024-1', pastAudit()]])) {
  return new Dashboard({ audit: degreeAudit({ terms: terms() }), past, plan: null, today: t(2025, 1) });
}

describe('dashboard model', () => {
  it('writes short term labels in both languages', () => {
    expect(termShort(t(2026, 1), 'vi')).toBe('HK1 26–27');
    expect(termShort(t(2025, 3), 'vi')).toBe('Hè 25–26');
    expect(termShort(t(2026, 2), 'en')).toBe('T2 26–27');
    expect(termShort(t(2025, 3), 'en')).toBe('Summer 25–26');
  });

  it('reads the end month of a term from the calendar', () => {
    const events = [{ kind: 'term_end', academicYear: 2027, term: 1, endsOn: '2028-01-20' }] as CalendarEvent[];
    expect(calendarEnd(events, t(2027, 1))).toBe('01/2028');
    expect(calendarEnd(events, t(2027, 2))).toBeNull();
  });

  it('takes the term after the last summary as the live term when nothing is in progress', () => {
    const d = dashboard();
    expect(d.liveTerm).toEqual(t(2025, 1));
    expect(d.nowIndex).toBe(3);
    expect(d.termAt(0)).toEqual(t(2024, 1));
  });

  it('reads a past term from the audit as of that term, with the engine deciding what failed', () => {
    const past = dashboard().snapshot(0, 'vi')!;
    const core = past.rows.find((r) => r.row.key === GROUP_A)!;
    expect(past.live).toBe(false);
    expect(past.passed).toBe(4);
    expect(core.d).toBe(4);
    expect(core.fail.map((c) => [c.code, c.grade, c.retaken])).toEqual([['ZZ202', 4.5, true]]);
    expect(past.courses.map((c) => [c.code, c.failed])).toEqual([['ZZ090', false], ['ZZ101', false], ['ZZ201', false], ['ZZ202', true]]);
  });

  it('has no snapshot for a past term whose audit has not loaded, and the live audit for now', () => {
    const d = dashboard(new Map());
    expect(d.snapshot(0, 'vi')).toBeNull();
    expect(d.auditAt(0)).toBeNull();
    expect(d.auditAt(d.nowIndex)!.credits.towardTotal).toBe(8);
    expect(d.snapshot(d.nowIndex, 'vi')!.passed).toBe(8);
  });

  it('reads the GPA change in points from the last term with grades', () => {
    const d = dashboard();
    expect(d.gpaChange(d.nowIndex)).toEqual({ change: 0.12, since: t(2024, 2) });
    expect(d.gpaChange(1)).toBeNull();
    expect(d.gpaChange(0)).toBeNull();
  });

  it('fills the past strip from the attempts the engine reports, failed sittings marked', () => {
    const strip = dashboard().strip('vi');
    expect(strip.map((s) => s.term)).toEqual([t(2024, 1), t(2025, 1)]);
    expect(strip[0]!.cells.map((c) => [c.code, c.state])).toEqual([['ZZ090', 'done'], ['ZZ101', 'done'], ['ZZ201', 'done'], ['ZZ202', 'fail']]);
    expect(strip[0]!.cells.find((c) => c.code === 'ZZ101')!.colour).toBe(dashboard().rows.find((r) => r.key === GROUP_MATH)!.colour);
  });

  it('lays the donut out as all passed arcs, then in progress, then remaining, filling the whole turn', () => {
    const d = dashboard();
    const parts = segments(d.snapshot(d.nowIndex, 'vi')!.rows);
    const kinds = parts.map((p) => p.kind);
    expect(kinds.indexOf('c')).toBeGreaterThan(kinds.lastIndexOf('d'));
    expect(kinds.indexOf('left')).toBeGreaterThan(kinds.lastIndexOf('c'));
    expect(parts.every((p) => p.path.startsWith('M') && p.hit.startsWith('M'))).toBe(true);
  });
});
