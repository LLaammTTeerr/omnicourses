import { describe, expect, it } from 'vitest';
import { byText } from './by-text.js';

describe('byText', () => {
  it('orders by code point: digits, then capitals, then lower case', () => {
    expect(['b', 'B', 'a', '2', 'A', '10'].sort(byText)).toEqual(['10', '2', 'A', 'B', 'a', 'b']);
  });

  it('puts Vietnamese letters after every ASCII letter, as no locale does', () => {
    expect(['Đại', 'Zeta', 'Anh'].sort(byText)).toEqual(['Anh', 'Zeta', 'Đại']);
  });

  it('is 0 only for the same text', () => {
    expect(byText('CS101', 'CS101')).toBe(0);
    expect(byText('CS101', 'CS102')).toBeLessThan(0);
    expect(byText('CS102', 'CS101')).toBeGreaterThan(0);
  });
});
