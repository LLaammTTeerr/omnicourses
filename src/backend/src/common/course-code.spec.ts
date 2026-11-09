import { describe, expect, it } from 'vitest';
import { canonicalCourseCode, isCourseCode } from './course-code.js';

describe('course code format (ADR 0007, UC-11 step 5)', () => {
  it.each(['CS101', 'MTH201', 'CSC10001', 'AB', 'A'.repeat(20)])('accepts %s as it is', (code) => {
    expect(isCourseCode(code)).toBe(true);
    expect(canonicalCourseCode(code)).toBe(code);
  });

  it('trims and upper-cases what an administrator types', () => {
    expect(canonicalCourseCode('  cs101 ')).toBe('CS101');
    expect(canonicalCourseCode('Mth201')).toBe('MTH201');
  });

  it.each(['', ' ', 'A', 'A'.repeat(21), 'CS 101', 'CS-101', 'CS.101', 'CS_101', 'Đ101'])('refuses %j', (input) => {
    expect(canonicalCourseCode(input)).toBeNull();
  });

  it('is strict where the code must already be canonical', () => {
    expect(isCourseCode('cs101')).toBe(false);
    expect(isCourseCode(' CS101')).toBe(false);
  });
});
