import { describe, expect, it } from 'vitest';
import { compareTerms, isTerm, LAST_TERM_NUMBER, sameTerm, termFromColumns, termKey, termLabel, termNumber } from './term.js';

describe('compareTerms', () => {
  it('orders by academic year, then by term number', () => {
    expect(compareTerms({ year: 2026, number: 3 }, { year: 2027, number: 1 })).toBeLessThan(0);
    expect(compareTerms({ year: 2027, number: 2 }, { year: 2027, number: 1 })).toBeGreaterThan(0);
    expect(compareTerms({ year: 2027, number: 2 }, { year: 2027, number: 2 })).toBe(0);
  });

  it('sameTerm is true only for the same year and number', () => {
    expect(sameTerm({ year: 2027, number: 2 }, { year: 2027, number: 2 })).toBe(true);
    expect(sameTerm({ year: 2027, number: 2 }, { year: 2028, number: 2 })).toBe(false);
    expect(sameTerm({ year: 2027, number: 2 }, { year: 2027, number: 1 })).toBe(false);
  });
});

describe('termLabel', () => {
  it('names the academic year and the term number, without calling term 3 summer', () => {
    expect(termLabel({ year: 2026, number: 3 })).toBe('2026–2027 term 3');
  });
});

describe('termKey', () => {
  it('is year-number, one string per term', () => {
    expect(termKey({ year: 2026, number: 3 })).toBe('2026-3');
    expect(termKey({ year: 2026, number: 1 })).not.toBe(termKey({ year: 2026, number: 3 }));
  });
});

describe('termFromColumns', () => {
  it('builds a term from its two stored columns', () => {
    expect(termFromColumns(2026, 3)).toEqual({ year: 2026, number: 3 });
    expect(termNumber(1)).toBe(1);
  });

  it('refuses a term number outside 1, 2 and 3 instead of casting it', () => {
    expect(() => termFromColumns(2026, 4)).toThrow(RangeError);
    expect(() => termNumber(0)).toThrow('Not a term number: 0');
  });

  it('knows term 3 is the last of the year', () => {
    expect(LAST_TERM_NUMBER).toBe(3);
  });
});

describe('isTerm', () => {
  it.each([{ year: 2026, number: 1 }, { year: 2026, number: 3 }, { year: 1999, number: 2 }])('accepts %j', (value) => {
    expect(isTerm(value)).toBe(true);
  });

  it.each([null, undefined, 'x', 2026, {}, { year: 2026 }, { year: 2026.5, number: 1 }, { year: '2026', number: 1 }, { year: 2026, number: 4 }, { year: 2026, number: '1' }])('refuses %j', (value) => {
    expect(isTerm(value)).toBe(false);
  });
});
