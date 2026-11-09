import { describe, expect, it } from 'vitest';
import { currentTerm, goalTerms, parseTermKey, sameTerm, termKey, termName, vietnamDate } from './terms.js';

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
