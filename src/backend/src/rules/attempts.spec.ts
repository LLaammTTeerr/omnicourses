import { describe, expect, it } from 'vitest';
import { attemptPasses, courseRecords, recordAsOf, recordBefore } from './attempts.js';
import { graded, term, ungraded } from './testing/fixtures.js';

const one = (...entries: Parameters<typeof courseRecords>[0]) => [...courseRecords(entries).values()][0];

describe('what passes', () => {
  it('passes a grade of 5.0 or more, an exemption and a pass (Điều 11.4, 13.2)', () => {
    expect(attemptPasses(graded('ZZ1', 4, 5))).toBe(true);
    expect(attemptPasses(graded('ZZ1', 4, 4.9))).toBe(false);
    expect(attemptPasses(ungraded('ZZ1', 4, 'exempt'))).toBe(true);
    expect(attemptPasses(ungraded('ZZ1', 4, 'pass'))).toBe(true);
    expect(attemptPasses(ungraded('ZZ1', 4, 'fail'))).toBe(false);
    expect(attemptPasses(ungraded('ZZ1', 4, 'in_progress'))).toBe(false);
  });
});

describe('retakes (Điều 14)', () => {
  it('counts the last attempt: a failed course retaken and passed is passed', () => {
    const r = one(graded('ZZ1', 4, 3, term(2024, 1)), graded('ZZ1', 4, 7, term(2024, 2)));
    expect(r.official?.grade).toBe(7);
    expect(r.passed).toBe(true);
    expect(r.attempts).toHaveLength(2);
  });

  it('counts the last attempt even when an improvement scores lower (Điều 14.2.a)', () => {
    const r = one(graded('ZZ1', 4, 9, term(2024, 1)), graded('ZZ1', 4, 6, term(2025, 1)));
    expect(r.official?.grade).toBe(6);
  });

  it('orders attempts by term, not by transcript order', () => {
    const r = one(graded('ZZ1', 4, 7, term(2025, 1)), graded('ZZ1', 4, 3, term(2024, 2)));
    expect(r.official?.grade).toBe(7);
    expect(r.passed).toBe(true);
  });

  it('keeps a passed course passed while a later improvement is in progress', () => {
    const r = one(graded('ZZ1', 4, 6, term(2024, 1)), ungraded('ZZ1', 4, 'in_progress', term(2025, 1)));
    expect(r.passed).toBe(true);
    expect(r.inProgress).toBe(true);
    expect(r.official?.grade).toBe(6);
  });

  it('marks a failed course being retaken as in progress, not passed', () => {
    const r = one(graded('ZZ1', 4, 2, term(2024, 1)), ungraded('ZZ1', 4, 'in_progress', term(2024, 2)));
    expect(r.passed).toBe(false);
    expect(r.inProgress).toBe(true);
  });

  it('ignores an in-progress row older than a completed attempt', () => {
    const r = one(ungraded('ZZ1', 4, 'in_progress', term(2024, 1)), graded('ZZ1', 4, 8, term(2024, 2)));
    expect(r.inProgress).toBe(false);
  });

  it('takes the worse of two completed attempts in the same term, and flags it', () => {
    const r = one(graded('ZZ1', 4, 8, term(2024, 1)), graded('ZZ1', 4, 4, term(2024, 1)));
    expect(r.official?.grade).toBe(4);
    expect(r.passed).toBe(false);
    expect(r.sameTermAttempts).toBe(true);
    expect(one(ungraded('ZZ1', 4, 'pass', term(2024, 1)), ungraded('ZZ1', 4, 'fail', term(2024, 1))).official?.result).toBe('fail');
    expect(one(ungraded('ZZ1', 4, 'exempt', term(2024, 1)), graded('ZZ1', 4, 9, term(2024, 1))).official?.grade).toBe(9);
    expect(one(graded('ZZ1', 4, 4, term(2024, 1)), ungraded('ZZ1', 4, 'fail', term(2024, 1))).official?.result).toBe('fail');
  });

  it('has no official attempt for a course only in progress', () => {
    const r = one(ungraded('ZZ1', 4, 'in_progress'));
    expect(r.official).toBeNull();
    expect(r.passed).toBe(false);
    expect(r.inProgress).toBe(true);
  });

  it('resolves a course as it stood at the end of an earlier term', () => {
    const r = one(graded('ZZ1', 4, 3, term(2024, 1)), graded('ZZ1', 4, 7, term(2024, 2)));
    expect(recordAsOf(r, term(2024, 1))?.passed).toBe(false);
    expect(recordAsOf(r, term(2024, 2))?.passed).toBe(true);
    expect(recordAsOf(r, term(2023, 3))).toBeNull();
  });

  it('resolves a course as it stood before a term began, without that term', () => {
    const r = one(graded('ZZ1', 4, 3, term(2024, 1)), graded('ZZ1', 4, 7, term(2024, 2)));
    expect(recordBefore(r, term(2024, 2))?.passed).toBe(false);
    expect(recordBefore(r, term(2024, 3))?.passed).toBe(true);
    expect(recordBefore(r, term(2024, 1))).toBeNull();
  });

  it('ranks a failed attempt without a grade below a failed grade, and a pass without a grade above a passing one', () => {
    expect(one(ungraded('ZZ1', 4, 'fail', term(2024, 1)), graded('ZZ1', 4, 1, term(2024, 1))).official?.result).toBe('fail');
    expect(one(graded('ZZ1', 4, 4.9, term(2024, 1)), graded('ZZ1', 4, 5, term(2024, 1))).official?.grade).toBe(4.9);
    expect(one(ungraded('ZZ1', 4, 'pass', term(2024, 1)), graded('ZZ1', 4, 10, term(2024, 1))).official?.grade).toBe(10);
  });

  it('takes the name from the latest attempt and sorts courses by code', () => {
    const records = courseRecords([graded('ZZ2', 4, 7), { ...graded('ZZ1', 4, 7, term(2025, 1)), courseName: 'New name' }, graded('ZZ1', 4, 7, term(2024, 1))]);
    expect([...records.keys()]).toEqual(['ZZ1', 'ZZ2']);
    expect(records.get('ZZ1')?.name).toBe('New name');
  });

  it('reads same-term attempts the same whatever order the transcript lists them in (ADR 0013)', () => {
    const first = { ...ungraded('ZZ1', 3, 'in_progress', term(2024, 1)), courseName: 'Name A' };
    const second = { ...ungraded('ZZ1', 4, 'in_progress', term(2024, 1)), courseName: 'Name B' };
    for (const entries of [[first, second], [second, first]]) {
      const r = one(...entries);
      expect(r.name).toBe('Name B');
      expect(r.attempts.map((a) => a.credits)).toEqual([3, 4]);
    }
    const failed = [{ ...ungraded('ZZ1', 3, 'fail', term(2024, 1)), courseName: 'Name A' }, { ...ungraded('ZZ1', 4, 'fail', term(2024, 1)), courseName: 'Name B' }];
    expect(one(...failed).official?.credits).toBe(one(...[...failed].reverse()).official?.credits);
  });
});
