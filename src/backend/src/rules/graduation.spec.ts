import { describe, expect, it } from 'vitest';
import { graduationStatus } from './graduation.js';
import type { CombinedMinimumCoverage, CreditSummary, GroupCoverage } from './types.js';

const makeCredits = (overrides: Partial<CreditSummary> = {}): CreditSummary => ({
  accumulated: 0,
  towardTotal: 0,
  inProgressTowardTotal: 0,
  totalRequired: 163,
  remaining: 163,
  yearLevel: 1,
  ...overrides,
});

const makeGroup = (overrides: Partial<GroupCoverage> = {}): GroupCoverage => ({
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Compulsory Core',
  kind: 'compulsory',
  requiredCredits: 40,
  passedCredits: 40,
  inProgressCredits: 0,
  overflowInCredits: 0,
  overflowOutCredits: 0,
  overflowToGroupId: null,
  remainingCredits: 0,
  met: true,
  courses: [],
  ...overrides,
});

const makeCombined = (overrides: Partial<CombinedMinimumCoverage> = {}): CombinedMinimumCoverage => ({
  id: '00000000-0000-4000-8000-0000000000c1',
  name: 'Electives Block',
  creditsMin: 43,
  officialNotes: null,
  groupIds: ['00000000-0000-4000-8000-000000000002'],
  credits: 43,
  inProgressCredits: 0,
  remainingCredits: 0,
  met: true,
  ...overrides,
});

describe('graduationStatus (ADR 0011, ADR 0013)', () => {
  it('returns not_yet when any ruled group, combined minimum, or recorded cohort total is unmet', () => {
    const unmetTotal = graduationStatus([makeGroup()], [makeCombined()], makeCredits({ towardTotal: 120 }));
    expect(unmetTotal.status).toBe('not_yet');
    expect(unmetTotal.unmet.map((c) => c.id)).toEqual(['total_credits']);

    const unmetGroup = graduationStatus([makeGroup({ met: false })], [], makeCredits({ towardTotal: 163, remaining: 0 }));
    expect(unmetGroup.status).toBe('not_yet');
    expect(unmetGroup.unmet.map((c) => c.id)).toEqual(['group:00000000-0000-4000-8000-000000000001']);
  });

  it('returns done when all ruled groups, combined minimums, and the recorded cohort total are met', () => {
    const verdict = graduationStatus([makeGroup()], [makeCombined()], makeCredits({ towardTotal: 163, remaining: 0 }));
    expect(verdict.status).toBe('done');
    expect(verdict.unmet).toEqual([]);
    expect(verdict.met.map((c) => c.id)).toEqual([
      'group:00000000-0000-4000-8000-000000000001',
      'combined:00000000-0000-4000-8000-0000000000c1',
      'total_credits',
    ]);
    expect(verdict.notChecked.map((c) => c.id)).toEqual([
      'no_prosecution_or_suspension',
      'defence_education_certificate',
      'foreign_language_standard',
      'it_standard',
      'study_time_limit',
    ]);
  });

  it('records total_credits as not_checked when totalRequired is null (ADR 0011 unrecorded cohort total)', () => {
    const withUnmetGroup = graduationStatus(
      [makeGroup({ met: false })],
      [],
      makeCredits({ totalRequired: null, remaining: null }),
    );
    expect(withUnmetGroup.status).toBe('not_yet');
    expect(withUnmetGroup.notChecked[0]).toMatchObject({ id: 'total_credits', status: 'not_checked' });

    const withAllGroupsMet = graduationStatus(
      [makeGroup({ met: true })],
      [],
      makeCredits({ towardTotal: 40, totalRequired: null, remaining: null }),
    );
    expect(withAllGroupsMet.status).toBe('done');
    expect(withAllGroupsMet.notChecked[0]).toMatchObject({ id: 'total_credits', status: 'not_checked' });
  });
});