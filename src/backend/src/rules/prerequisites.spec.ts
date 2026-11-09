import { describe, expect, it } from 'vitest';
import { checkOfferingTerm, checkPrerequisites } from './prerequisites.js';

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

describe('offering terms', () => {
  it('says "not recorded" when there is no data', () => {
    expect(checkOfferingTerm(null, { year: 2026, number: 1 })).toEqual({ status: 'not_recorded' });
  });

  it('checks the term number', () => {
    expect(checkOfferingTerm([1, 3], { year: 2026, number: 3 })).toEqual({ status: 'offered' });
    expect(checkOfferingTerm([3, 1, 1], { year: 2026, number: 2 })).toEqual({ status: 'not_offered', offeredTermNumbers: [1, 3] });
  });
});
