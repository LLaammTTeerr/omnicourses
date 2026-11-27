import { describe, expect, it } from 'vitest';
import { courseRecords } from './attempts.js';
import { checkOfferingTerm, checkPrerequisites, passedOnly, passedOrAssumedBefore } from './prerequisites.js';
import { graded, term, ungraded } from './testing/fixtures.js';

describe('prerequisites (Điều 3.1.c)', () => {
  const passed = new Set(['ZZ101', 'ZZ102']);

  it('says "not recorded" when there is no data, distinct from "none"', () => {
    expect(checkPrerequisites(null, passed)).toEqual({ status: 'not_recorded' });
    expect(checkPrerequisites([], passed)).toEqual({ status: 'none' });
  });

  it('is met when every prerequisite is passed', () => {
    expect(checkPrerequisites(['ZZ101', 'ZZ102'], passed)).toEqual({ status: 'met' });
  });

  it('lists the prerequisites not passed, once each, by code', () => {
    expect(checkPrerequisites(['ZZ109', 'ZZ101', 'ZZ103', 'ZZ109'], passed)).toEqual({ status: 'not_met', missing: ['ZZ103', 'ZZ109'] });
  });
});

describe('the courses that satisfy a prerequisite (ADR 0013, 27 November 2026)', () => {
  const records = courseRecords([
    graded('ZZ101', 4, 8, term(2024, 1)),
    graded('ZZ102', 4, 3, term(2024, 1)),
    ungraded('ZZ103', 4, 'in_progress', term(2024, 2)),
    graded('ZZ104', 4, 2, term(2024, 1)),
    ungraded('ZZ104', 4, 'in_progress', term(2024, 2)),
    graded('ZZ105', 4, 7, term(2024, 3)),
  ]);

  it('counts only passed courses for the explorer', () => {
    expect(passedOnly(records)).toEqual(new Set(['ZZ101', 'ZZ105']));
  });

  it('counts courses passed or in progress before the term for the planner, never the same term', () => {
    expect(passedOrAssumedBefore(records, new Map(), term(2024, 2))).toEqual(new Set(['ZZ101']));
    expect(passedOrAssumedBefore(records, new Map(), term(2024, 3))).toEqual(new Set(['ZZ101', 'ZZ103', 'ZZ104']));
    expect(passedOrAssumedBefore(records, new Map(), term(2025, 1))).toEqual(new Set(['ZZ101', 'ZZ103', 'ZZ104', 'ZZ105']));
  });

  it('assumes a course planned earlier passes until the transcript completes it in or after that term', () => {
    const planned = new Map([
      ['ZZ102', term(2024, 1)],
      ['ZZ106', term(2024, 1)],
      ['ZZ107', term(2024, 3)],
    ]);
    expect(passedOrAssumedBefore(records, planned, term(2024, 2))).toEqual(new Set(['ZZ101', 'ZZ106', 'ZZ107']));
    expect(passedOrAssumedBefore(courseRecords([graded('ZZ102', 4, 3, term(2023, 3))]), planned, term(2024, 2))).toEqual(new Set(['ZZ102', 'ZZ106', 'ZZ107']));
  });

  it('still assumes a course planned earlier when the transcript completes it in the checked term', () => {
    const passedInCheckedTerm = courseRecords([graded('ZZ102', 4, 3, term(2024, 2))]);
    expect(passedOrAssumedBefore(passedInCheckedTerm, new Map([['ZZ102', term(2024, 1)]]), term(2024, 2))).toEqual(new Set(['ZZ102']));
  });
});

describe('offering terms', () => {
  it('says "not recorded" when there is no data', () => {
    expect(checkOfferingTerm(null, { year: 2026, number: 1 })).toEqual({ status: 'not_recorded' });
  });

  it('checks the term number', () => {
    expect(checkOfferingTerm([1, 3], { year: 2026, number: 3 })).toEqual({ status: 'offered' });
    expect(checkOfferingTerm([3, 1, 1], { year: 2026, number: 2 })).toEqual({ status: 'not_offered', offeredTermNumbers: [1, 3] });
  });
});
