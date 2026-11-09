import { describe, expect, it } from 'vitest';
import { CAP_CITATION, checkTermLoad, creditCaps, PETITION_NOTE, termKind } from './credit-caps.js';

const load = (...credits: number[]) => credits.map((c) => ({ credits: c }));

describe('term kind (Điều 6.4, ADR 0012)', () => {
  it('makes every APCS term a main term, term 3 included', () => {
    expect([1, 2, 3].map((n) => termKind('advanced', n as 1 | 2 | 3))).toEqual(['main', 'main', 'main']);
  });

  it('makes term 3 a summer term only in a đại trà program', () => {
    expect(termKind('standard', 1)).toBe('main');
    expect(termKind('standard', 2)).toBe('main');
    expect(termKind('standard', 3)).toBe('summer');
    expect(termKind('high_quality', 3)).toBe('main');
    expect(termKind('joint', 3)).toBe('main');
  });

  it('says nothing when the training type is not recorded', () => {
    expect(termKind(null, 3)).toBeNull();
  });
});

describe('credit caps (Điều 7.2)', () => {
  it('gives Tiên tiến, Liên kết and Chất lượng cao 10–22 in every term', () => {
    for (const type of ['advanced', 'joint', 'high_quality'] as const) expect(creditCaps(type, 'main')).toEqual({ min: 10, max: 22 });
  });

  it('gives đại trà 14–25 in a main term and at most 12, with no minimum, in summer', () => {
    expect(creditCaps('standard', 'main')).toEqual({ min: 14, max: 25 });
    expect(creditCaps('standard', 'summer')).toEqual({ min: null, max: 12 });
  });

  it.each([1, 2, 3] as const)('APCS term %s: 10 and 22 are allowed, 9 and 23 are violations', (number) => {
    expect(checkTermLoad('advanced', number, load(4, 4, 2)).violations).toEqual([]);
    expect(checkTermLoad('advanced', number, load(4, 4, 4, 4, 4, 2)).violations).toEqual([]);
    expect(checkTermLoad('advanced', number, load(4, 4, 1)).violations).toEqual([
      { rule: 'below_minimum', credits: 9, limit: 10, citation: CAP_CITATION, petition: PETITION_NOTE },
    ]);
    expect(checkTermLoad('advanced', number, load(4, 4, 4, 4, 4, 3)).violations).toEqual([
      { rule: 'above_maximum', credits: 23, limit: 22, citation: CAP_CITATION, petition: PETITION_NOTE },
    ]);
  });

  it('cites Điều 7.2 and the petition route', () => {
    expect(CAP_CITATION).toBe('QĐ 1175/QĐ-KHTN Điều 7.2');
    expect(PETITION_NOTE).toMatch(/faculty.*Rector/);
  });

  it('đại trà term 3 (summer): 12 allowed, 13 a violation, a light load no violation', () => {
    expect(checkTermLoad('standard', 3, load(4, 4, 4))).toEqual({ kind: 'summer', credits: 12, caps: { min: null, max: 12 }, violations: [] });
    expect(checkTermLoad('standard', 3, load(4, 4, 4, 1)).violations.map((v) => [v.rule, v.credits, v.limit])).toEqual([['above_maximum', 13, 12]]);
    expect(checkTermLoad('standard', 3, load(2)).violations).toEqual([]);
  });

  it('đại trà main term: 14 and 25 allowed, 13 and 26 violations', () => {
    expect(checkTermLoad('standard', 1, load(4, 4, 4, 2)).violations).toEqual([]);
    expect(checkTermLoad('standard', 1, load(5, 5, 5, 5, 5)).violations).toEqual([]);
    expect(checkTermLoad('standard', 1, load(4, 4, 4, 1)).violations.map((v) => v.rule)).toEqual(['below_minimum']);
    expect(checkTermLoad('standard', 2, load(5, 5, 5, 5, 5, 1)).violations.map((v) => v.rule)).toEqual(['above_maximum']);
  });

  it('leaves GDQP, GDTC and general foreign language out of the đại trà minimum only', () => {
    const courses = [{ credits: 4 }, { credits: 4 }, { credits: 4 }, { credits: 4, excludedFromMinimum: true }];
    expect(checkTermLoad('standard', 1, courses).violations).toEqual([
      { rule: 'below_minimum', credits: 12, limit: 14, citation: CAP_CITATION, petition: PETITION_NOTE },
    ]);
    expect(checkTermLoad('advanced', 1, courses).violations).toEqual([]);
  });

  it('counts retakes in the load (Điều 7.1.b): the load is every course given', () => {
    expect(checkTermLoad('advanced', 1, load(4, 4, 4, 4, 4, 4)).credits).toBe(24);
  });

  it('checks no cap when the training type is not recorded', () => {
    expect(checkTermLoad(null, 1, load(30))).toEqual({ kind: null, credits: 30, caps: null, violations: [] });
  });
});
