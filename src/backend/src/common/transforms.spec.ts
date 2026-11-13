import { describe, expect, it } from 'vitest';
import { blankToNull, trimString } from './transforms.js';

describe('trimString', () => {
  it('trims a string and leaves anything else for the validators', () => {
    expect(trimString({ value: '  Main plan ' } as Parameters<typeof trimString>[0])).toBe('Main plan');
    expect(trimString({ value: 42 } as Parameters<typeof trimString>[0])).toBe(42);
  });
});

describe('blankToNull', () => {
  it('trims a text with something in it', () => {
    expect(blankToNull('  Introduction  ')).toBe('Introduction');
  });

  it.each(['', '   ', null, undefined])('is null for %j', (value) => {
    expect(blankToNull(value)).toBeNull();
  });
});
