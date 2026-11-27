import { describe, expect, it } from 'vitest';
import { NAMESPACED_LOCKS, SINGLE_KEY_LOCKS } from './advisory-locks.js';

describe('advisory lock registry', () => {
  it.each([
    ['single-key locks', SINGLE_KEY_LOCKS],
    ['namespaced locks', NAMESPACED_LOCKS],
  ])('gives every %s key its own number', (_group, locks) => {
    const keys = Object.values(locks);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
