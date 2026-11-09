import { describe, expect, it } from 'vitest';
import { passwordStrength, strengthFill } from './password-strength.js';

describe('passwordStrength', () => {
  it.each([
    ['', 'short'],
    ['abcdefghi', 'short'],
    ['abcdefghij', 'weak'],
    ['abcdefghij1', 'fair'],
    ['abcdefghijklmn', 'fair'],
    ['abcdefghij1!', 'strong'],
    ['abcdefghijklm1!', 'very-strong'],
    ['mật khẩu dài 1', 'very-strong'],
  ])('rates %j as %s', (password, strength) => {
    expect(passwordStrength(password)).toBe(strength);
  });

  it('counts a Vietnamese letter as a letter, not a symbol', () => {
    expect(passwordStrength('đườnghọcphầnn')).toBe('weak');
  });
});

describe('strengthFill', () => {
  it('is empty with no password and grows with the strength', () => {
    expect(strengthFill('')).toBe(0);
    expect(strengthFill('abc')).toBeGreaterThan(0);
    expect(strengthFill('abcdefghij')).toBe(0.25);
    expect(strengthFill('abcdefghijklm1!')).toBe(1);
  });
});
