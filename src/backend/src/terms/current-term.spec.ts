import { describe, expect, it } from 'vitest';
import { compareTerms, currentTerm, termLabel } from './current-term.js';

describe('currentTerm', () => {
  it.each([
    ['2026-09-01', { year: 2026, number: 1 }],
    ['2026-11-09', { year: 2026, number: 1 }],
    ['2026-12-31', { year: 2026, number: 1 }],
    ['2027-01-01', { year: 2026, number: 2 }],
    ['2027-05-31', { year: 2026, number: 2 }],
    ['2027-06-01', { year: 2026, number: 3 }],
    ['2027-08-31', { year: 2026, number: 3 }],
  ])('on %s is %j', (day, term) => {
    expect(currentTerm(day)).toEqual(term);
  });

  it('refuses a value that is not a date', () => {
    expect(() => currentTerm('soon')).toThrow(RangeError);
  });
});

describe('compareTerms', () => {
  it('orders by academic year, then by term number', () => {
    expect(compareTerms({ year: 2026, number: 3 }, { year: 2027, number: 1 })).toBeLessThan(0);
    expect(compareTerms({ year: 2027, number: 2 }, { year: 2027, number: 1 })).toBeGreaterThan(0);
    expect(compareTerms({ year: 2027, number: 2 }, { year: 2027, number: 2 })).toBe(0);
  });
});

describe('termLabel', () => {
  it('names the academic year and the term number, without calling term 3 summer', () => {
    expect(termLabel({ year: 2026, number: 3 })).toBe('2026–2027 term 3');
  });
});
