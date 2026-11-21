import { describe, expect, it, vi } from 'vitest';
import { academicYearAt, compareTerms, currentTerm, goalTerms, nextTerm, parseTermKey, sameTerm, termKey, termMonths, termName, termsBetween, vietnamDate, type Term } from './terms.js';

// The same cases as the API's current-term.spec, so the choices match what the API accepts.

describe('currentTerm', () => {
  it.each([
    ['2026-09-01', { year: 2026, number: 1 }],
    ['2026-12-31', { year: 2026, number: 1 }],
    ['2027-01-01', { year: 2026, number: 2 }],
    ['2027-05-31', { year: 2026, number: 2 }],
    ['2027-06-01', { year: 2026, number: 3 }],
    ['2027-08-31', { year: 2026, number: 3 }],
  ])('on %s is %j', (day, term) => {
    expect(currentTerm(day)).toEqual(term);
  });
});

describe('vietnamDate', () => {
  it('is already the next day in Vietnam at 17:00 UTC', () => {
    expect(vietnamDate(new Date('2026-08-31T17:00:00Z'))).toBe('2026-09-01');
    expect(vietnamDate(new Date('2026-08-31T16:59:59Z'))).toBe('2026-08-31');
  });
});

describe('goalTerms', () => {
  it('runs from the current term to term 3, eight academic years on', () => {
    const terms = goalTerms(new Date('2027-02-10T03:00:00Z'));
    expect(terms[0]).toEqual({ year: 2026, number: 2 });
    expect(terms.at(-1)).toEqual({ year: 2034, number: 3 });
    expect(terms).toHaveLength(2 + 8 * 3);
  });
});

describe('termKey', () => {
  it('round-trips a term and refuses anything else', () => {
    expect(termKey({ year: 2026, number: 3 })).toBe('2026-3');
    expect(parseTermKey('2026-3')).toEqual({ year: 2026, number: 3 });
    expect(parseTermKey('2026-4')).toBeNull();
    expect(parseTermKey('none')).toBeNull();
  });

  it('compares terms by value', () => {
    expect(sameTerm({ year: 2026, number: 1 }, { year: 2026, number: 1 })).toBe(true);
    expect(sameTerm({ year: 2026, number: 1 }, null)).toBe(false);
  });
});

describe('termName', () => {
  it('names every term by its number, term 3 included (ADR 0009, amended)', () => {
    expect(termName({ year: 2026, number: 3 }, 'vi')).toBe('HK3 2026–2027');
    expect(termName({ year: 2026, number: 1 }, 'en')).toBe('Term 1 2026–2027');
  });
});

const t = (year: number, number: 1 | 2 | 3): Term => ({ year, number });

describe('term arithmetic', () => {
  it('counts three terms a year (ADR 0009)', () => {
    expect(nextTerm(t(2026, 1))).toEqual(t(2026, 2));
    expect(nextTerm(t(2026, 3))).toEqual(t(2027, 1));
    expect(termsBetween(t(2026, 2), t(2027, 1))).toEqual([t(2026, 2), t(2026, 3), t(2027, 1)]);
    expect(termsBetween(t(2027, 1), t(2026, 1))).toEqual([]);
  });

  it('orders terms by year, then number', () => {
    expect(compareTerms(t(2026, 3), t(2027, 1))).toBeLessThan(0);
    expect(compareTerms(t(2026, 2), t(2026, 1))).toBeGreaterThan(0);
    expect(compareTerms(t(2026, 2), t(2026, 2))).toBe(0);
  });
});

describe('termMonths', () => {
  it('runs each term from its first month to the month before the next term, in its calendar year', () => {
    expect(termMonths(t(2026, 1))).toEqual({ first: 9, last: 12, year: 2026 });
    expect(termMonths(t(2026, 2))).toEqual({ first: 1, last: 5, year: 2027 });
    expect(termMonths(t(2026, 3))).toEqual({ first: 6, last: 8, year: 2027 });
  });

  it('agrees with currentTerm on every month', () => {
    for (const number of [1, 2, 3] as const) {
      const { first, last, year } = termMonths(t(2026, number));
      for (let month = first; month <= last; month++) expect(currentTerm(`${year}-${String(month).padStart(2, '0')}-15`)).toEqual(t(2026, number));
    }
  });
});

describe('academicYearAt', () => {
  it('counts the year on the date in Vietnam, not on the browser clock', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles');
    try {
      // 31 August in Los Angeles, already 1 September in Vietnam.
      expect(academicYearAt(new Date('2026-08-31T18:00:00Z'))).toBe(2026);
      expect(academicYearAt(new Date('2026-08-31T16:00:00Z'))).toBe(2025);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
