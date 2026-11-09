import { describe, expect, it } from 'vitest';
import { fourPointAverage, weightedAverage } from './gpa.js';

describe('averages (Điều 15.2.a)', () => {
  it('weights each grade by its credits', () => {
    // (8.0·4 + 6.5·2) / 6 = 45 / 6 = 7.5
    expect(weightedAverage([{ grade: 8, credits: 4 }, { grade: 6.5, credits: 2 }])).toEqual({ value: 7.5, numerator: 450, denominator: 60 });
  });

  it('rounds half up to two decimals without floating-point drift', () => {
    // (7.0·1 + 8.0·2) / 3 = 7.666… → 7.67; (8.0 + 7.0 + 7.0) / 3 = 7.333… → 7.33
    expect(weightedAverage([{ grade: 7, credits: 1 }, { grade: 8, credits: 2 }])?.value).toBe(7.67);
    expect(weightedAverage([{ grade: 8, credits: 1 }, { grade: 7, credits: 2 }])?.value).toBe(7.33);
    // (8.1 + 8.2) / 2 = 8.15 exactly, stays 8.15
    expect(weightedAverage([{ grade: 8.1, credits: 1 }, { grade: 8.2, credits: 1 }])?.value).toBe(8.15);
    // 8.125 rounds up to 8.13
    expect(weightedAverage([{ grade: 8.1, credits: 3 }, { grade: 8.2, credits: 1 }])?.value).toBe(8.13);
  });

  it('has no average without credits', () => {
    expect(weightedAverage([])).toBeNull();
    expect(fourPointAverage([])).toBeNull();
  });

  it('averages each grade converted to the 4-point scale (Điều 11.1)', () => {
    // 8.5 → 3.5 (4 credits), 6.0 → 2.5 (2 credits): (14 + 5) / 6 = 3.1666… → 3.17
    expect(fourPointAverage([{ grade: 8.5, credits: 4 }, { grade: 6, credits: 2 }])?.value).toBe(3.17);
  });
});
