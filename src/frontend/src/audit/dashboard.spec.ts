import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../calendar/api.js';
import { calendarEnd, Dashboard, segments, termShort } from './dashboard.js';
import { degreeAudit, GROUP_A } from './testing/fixtures.js';

const t = (year: number, number: 1 | 2 | 3) => ({ year, number });

function dashboard() {
  const base = degreeAudit();
  const audit = degreeAudit({ terms: [{ ...base.terms[0]!, failedCourseCodes: ['ZZ202'] }] });
  return new Dashboard({
    audit,
    transcript: [
      { courseCode: 'ZZ201', courseName: 'ZZ201', credits: 4, result: 'graded', grade: 8, term: t(2024, 1) },
      { courseCode: 'ZZ202', courseName: 'ZZ202', credits: 4, result: 'graded', grade: 4.5, term: t(2024, 1) },
    ],
    plan: null,
    today: t(2025, 1),
  });
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
    expect(d.nowIndex).toBe(1);
    expect(d.termAt(0)).toEqual(t(2024, 1));
  });

  it('rebuilds a past term from the transcript, counting a failed sitting as failed', () => {
    const past = dashboard().snapshot(0, 'vi');
    const core = past.rows.find((r) => r.row.key === GROUP_A)!;
    expect(past.live).toBe(false);
    expect(core.d).toBe(4);
    expect(core.fail.map((c) => [c.code, c.grade])).toEqual([['ZZ202', 4.5]]);
    expect(past.courses.map((c) => [c.code, c.failed])).toEqual([['ZZ201', false], ['ZZ202', true]]);
  });

  it('lays the donut out as all passed arcs, then in progress, then remaining, filling the whole turn', () => {
    const live = dashboard().snapshot(1, 'vi');
    const parts = segments(live.rows);
    const kinds = parts.map((p) => p.kind);
    expect(kinds.indexOf('c')).toBeGreaterThan(kinds.lastIndexOf('d'));
    expect(kinds.indexOf('left')).toBeGreaterThan(kinds.lastIndexOf('c'));
    expect(parts.every((p) => p.path.startsWith('M') && p.hit.startsWith('M'))).toBe(true);
  });
});
