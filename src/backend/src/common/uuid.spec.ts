import { describe, expect, it } from 'vitest';
import { UUID_PATTERN } from './uuid.js';

describe('UUID_PATTERN', () => {
  it.each(['00000000-0000-4000-8000-000000000000', 'A1B2C3D4-E5F6-4789-8ABC-DEF012345678'])('accepts %s', (id) => {
    expect(UUID_PATTERN.test(id)).toBe(true);
  });

  it.each(['', 'not-a-uuid', '00000000-0000-4000-8000-00000000000', '00000000000040008000000000000000', ' 00000000-0000-4000-8000-000000000000'])('refuses %j', (id) => {
    expect(UUID_PATTERN.test(id)).toBe(false);
  });
});
