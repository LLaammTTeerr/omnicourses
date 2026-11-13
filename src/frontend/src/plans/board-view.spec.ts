import { describe, expect, it } from 'vitest';
import type { PlanTermLoad } from './api.js';
import { capOf, meter, splitIssues, toneOf } from './board-view.js';
import { issue } from './testing/fixtures.js';

const term = { year: 2026, number: 1 } as const;
const load = (credits: number, caps: PlanTermLoad['caps']): PlanTermLoad => ({ term, kind: 'main', credits, caps });

describe('the credit meter', () => {
  it('runs 6 credits past the maximum and marks the caps, the change from the saved load shaded', () => {
    // Scale 22 + 6 = 28: 14 → 50 %, 21 → 75 %.
    expect(meter(load(21, { min: 14, max: 22 }), 14)).toEqual({ fill: 50, from: 50, to: 75, min: 50, minLabel: 14, max: (22 / 28) * 100, maxLabel: 22 });
  });

  it('stops at the end of the bar, has no minimum mark without a minimum, and is not drawn without caps', () => {
    expect(meter(load(40, { min: null, max: 22 }), 40)).toMatchObject({ fill: 100, to: 100, min: null, minLabel: null });
    expect(meter(load(12, null), 12)).toBeNull();
    expect(meter(null, 0)).toBeNull();
  });
});

describe('the meter colour', () => {
  it('follows the engine’s load issues, not the credits', () => {
    expect(capOf([issue({ code: 'load_above_maximum', kind: 'violation' })], 10)).toBe('over');
    expect(capOf([issue({ code: 'load_below_minimum', kind: 'violation' })], 30)).toBe('under');
    expect(capOf([], 30)).toBe('ok');
    expect(capOf([], 0)).toBe('');
  });
});

describe('tones', () => {
  it('colours a row or tile by its most serious issue, and not by an unknown alone', () => {
    expect(toneOf([issue({ code: 'not_offered', kind: 'flag' }), issue({ code: 'prerequisite_not_met', kind: 'violation' })])).toBe('has-violation');
    expect(toneOf([issue({ code: 'not_offered', kind: 'flag' })])).toBe('has-flag');
    expect(toneOf([issue({ code: 'prerequisites_not_recorded', kind: 'unknown' })])).toBe('');
    expect(toneOf([])).toBe('');
  });
});

describe('a tile’s issues', () => {
  it('shows violations before flags, and keeps the unchecked codes apart', () => {
    const flag = issue({ code: 'not_offered', kind: 'flag' });
    const violation = issue({ code: 'prerequisite_not_met', kind: 'violation' });
    const unknown = issue({ code: 'prerequisites_not_recorded', kind: 'unknown' });
    expect(splitIssues([flag, unknown, violation])).toEqual({ shown: [violation, flag], unknowns: ['prerequisites_not_recorded'] });
  });
});
