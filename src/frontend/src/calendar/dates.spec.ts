import { describe, expect, it } from 'vitest';
import { academicYearMonths, academicYearOf, addDays, eventsByDay, monthDays, monthStart, monthWeeks, mondayOf, termWeek, weekday } from './dates.js';
import { calendar, event, EXAMS, HOLIDAY, REGISTRATION, TERM_START } from './testing/fixtures.js';

const events = calendar().events;

describe('calendar dates', () => {
  it('counts whole days across months and years, Monday first', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(weekday('2026-11-09')).toBe(0);
    expect(weekday('2026-11-15')).toBe(6);
    expect(mondayOf('2026-11-15')).toBe('2026-11-09');
    expect(monthStart('2026-12-15', 1)).toBe('2027-01-01');
    expect(monthStart('2027-01-15', -1)).toBe('2026-12-01');
  });

  it('shows whole weeks for a month: five rows when they fit, six when they do not', () => {
    const november = monthDays('2026-11-01');
    expect(november[0]).toBe('2026-10-26');
    expect(november).toHaveLength(42);
    expect(november.at(-1)).toBe('2026-12-06');
    const february = monthDays('2027-02-01');
    expect(february[0]).toBe('2027-02-01');
    expect(february).toHaveLength(28);
  });

  it('lists the weeks that hold a day of the month', () => {
    expect(monthWeeks('2026-11-01')).toEqual(['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']);
  });

  it('names the academic year from September (ADR 0009)', () => {
    expect(academicYearOf('2026-08-31')).toBe(2025);
    expect(academicYearOf('2026-09-01')).toBe(2026);
    expect(academicYearMonths(2026)[0]).toBe('2026-09-01');
    expect(academicYearMonths(2026).at(-1)).toBe('2027-08-01');
  });

  it('counts term weeks from the week the term starts, and only inside the term', () => {
    expect(termWeek('2026-09-07', events)).toEqual({ term: { year: 2026, number: 1 }, week: 1 });
    expect(termWeek('2026-11-12', events)?.week).toBe(10);
    expect(termWeek('2027-01-10', events)?.week).toBe(18);
    expect(termWeek('2027-01-11', events)).toBeNull();
    expect(termWeek('2026-09-06', events)).toBeNull();
  });

  it('gives no term week without a term start, and ends a term with no end date when its term is over', () => {
    expect(termWeek('2026-11-12', [REGISTRATION, HOLIDAY])).toBeNull();
    expect(termWeek('2026-12-31', [TERM_START])?.week).toBe(17);
    expect(termWeek('2027-01-04', [TERM_START])).toBeNull();
  });

  it('puts each event on every day it covers inside the range, in the API order', () => {
    const days = eventsByDay(events, '2026-11-16', '2026-11-22');
    expect(days.get('2026-11-16')?.map((e) => e.id)).toEqual([REGISTRATION.id]);
    expect(days.get('2026-11-20')?.map((e) => e.id)).toEqual([REGISTRATION.id, HOLIDAY.id]);
    expect(days.has('2026-11-21')).toBe(false);
    const exams = eventsByDay([EXAMS], '2026-12-28', '2027-01-31');
    expect([...exams.keys()]).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
    expect(eventsByDay([event({ id: 'x', kind: 'other', startsOn: '2026-01-01', title: 'x' })], '2026-11-01', '2026-11-30').size).toBe(0);
  });
});
