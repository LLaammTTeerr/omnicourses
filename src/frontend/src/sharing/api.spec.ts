import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../api.js';
import { PLACEMENT_KINDS, PLAN_ISSUE_CODES, PLAN_ISSUE_KINDS, TERM_KINDS } from '../plans/api.js';
import { PLAN_ID } from '../plans/testing/fixtures.js';
import { contractEnum, contractNullable, contractShape, nullableKeys, type Shape } from '../testing/contract.js';
import { signedInPinia } from '../testing/signed-in.js';
import {
  fetchPlanShare,
  fetchSharedPlan,
  sharedPlanUrl,
  stopPlanShare,
  updatePlanShare,
  type PlanShare,
  type PlanShareState,
  type SharePlanBody,
  type SharedCombinedMinimumCoverage,
  type SharedCurriculum,
  type SharedGroupCoverage,
  type SharedPlacement,
  type SharedPlan,
  type SharedPlanCoverage,
  type SharedPlanIssue,
  type SharedPlanTerm,
  type SharedProgram,
} from './api.js';
import { restoreMocksAfterCheckingCalls } from '../testing/fetch.js';

const NULLABLE: Record<string, string[]> = {
  PlanShareStateDto: nullableKeys<PlanShareState>({ share: true }),
  SharedProgramDto: nullableKeys<SharedProgram>({ nameEn: true }),
  SharedCurriculumDto: nullableKeys<SharedCurriculum>({ nameEn: true }),
  SharedPlacementDto: nullableKeys<SharedPlacement>({ courseCode: true, credits: true, nameEn: true, nameVi: true, requirementGroupName: true }),
  SharedPlanTermDto: nullableKeys<SharedPlanTerm>({ caps: true, kind: true }),
  SharedPlanIssueDto: nullableKeys<SharedPlanIssue>({ combinedMinimumName: true, courseCode: true, credits: true, limit: true, position: true, requirementGroupName: true, term: true }),
  SharedGroupCoverageDto: nullableKeys<SharedGroupCoverage>({ remainingCredits: true, requiredCredits: true }),
  SharedPlanCoverageDto: nullableKeys<SharedPlanCoverage>({ totalRemaining: true, totalRequired: true }),
  SharedPlanDto: nullableKeys<SharedPlan>({ ownerName: true }),
};

describe('sharing types against the contract (F9, ADR 0010)', () => {
  it.each([
    ['SharePlanDto', { showName: 'optional', showTranscriptChecks: 'optional' } satisfies Shape<SharePlanBody>],
    ['PlanShareDto', { token: 'required', showName: 'required', showTranscriptChecks: 'required', createdAt: 'required' } satisfies Shape<PlanShare>],
    ['PlanShareStateDto', { share: 'required' } satisfies Shape<PlanShareState>],
    ['SharedProgramDto', { code: 'required', nameVi: 'required', nameEn: 'required' } satisfies Shape<SharedProgram>],
    [
      'SharedCurriculumDto',
      { code: 'required', cohortYear: 'required', nameVi: 'required', nameEn: 'required', program: 'required' } satisfies Shape<SharedCurriculum>,
    ],
    [
      'SharedPlacementDto',
      {
        kind: 'required',
        courseCode: 'required',
        nameVi: 'required',
        nameEn: 'required',
        credits: 'required',
        requirementGroupName: 'required',
      } satisfies Shape<SharedPlacement>,
    ],
    [
      'SharedPlanTermDto',
      { term: 'required', kind: 'required', credits: 'required', caps: 'required', placements: 'required' } satisfies Shape<SharedPlanTerm>,
    ],
    [
      'SharedPlanIssueDto',
      {
        code: 'required',
        kind: 'required',
        term: 'required',
        position: 'required',
        courseCode: 'required',
        offeredTermNumbers: 'required',
        credits: 'required',
        limit: 'required',
        citation: 'required',
        message: 'required',
        missingCourseCodes: 'optional',
        requirementGroupName: 'optional',
        combinedMinimumName: 'optional',
      } satisfies Shape<SharedPlanIssue>,
    ],
    [
      'SharedGroupCoverageDto',
      {
        name: 'required',
        kind: 'required',
        requiredCredits: 'required',
        credits: 'required',
        remainingCredits: 'required',
        met: 'required',
      } satisfies Shape<SharedGroupCoverage>,
    ],
    [
      'SharedCombinedMinimumCoverageDto',
      {
        name: 'required',
        creditsMin: 'required',
        credits: 'required',
        remainingCredits: 'required',
        met: 'required',
      } satisfies Shape<SharedCombinedMinimumCoverage>,
    ],
    [
      'SharedPlanCoverageDto',
      {
        groups: 'required',
        combinedMinimums: 'required',
        totalRequired: 'required',
        totalCredits: 'required',
        totalRemaining: 'required',
        graduation: 'required',
      } satisfies Shape<SharedPlanCoverage>,
    ],
    [
      'SharedPlanDto',
      {
        name: 'required',
        ownerName: 'required',
        curriculum: 'required',
        updatedAt: 'required',
        terms: 'required',
        issues: 'required',
        issueCodesNotShown: 'required',
        coverage: 'optional',
      } satisfies Shape<SharedPlan>,
    ],
    ['NotSharedDto', { statusCode: 'required', message: 'required', error: 'required' } satisfies Shape<{ statusCode: number; message: string; error: string }>],
  ])('has the fields of %s', (schema, shape) => {
    expect(contractShape(schema)).toEqual(shape);
    expect(contractNullable(schema)).toEqual(NULLABLE[schema] ?? []);
  });

  it('matches the enums of the sharing contract', () => {
    expect([...PLACEMENT_KINDS].sort()).toEqual(contractEnum('SharedPlacementDto', 'kind'));
    expect([...TERM_KINDS, null].sort()).toEqual(contractEnum('SharedPlanTermDto', 'kind'));
    expect([...PLAN_ISSUE_CODES].sort()).toEqual(contractEnum('SharedPlanIssueDto', 'code'));
    expect([...PLAN_ISSUE_CODES].sort()).toEqual(contractEnum('SharedPlanDto', 'issueCodesNotShown'));
    expect([...PLAN_ISSUE_KINDS].sort()).toEqual(contractEnum('SharedPlanIssueDto', 'kind'));
    expect(contractEnum('SharedGroupCoverageDto', 'kind')).toEqual(['compulsory', 'elective']);
    expect(contractEnum('SharedPlanCoverageDto', 'graduation')).toEqual(['done', 'not_yet']);
  });
});

describe('sharing requests', () => {
  beforeEach(() => signedInPinia());
  afterEach(() => restoreMocksAfterCheckingCalls());

  it('sends owner share calls with the bearer token and body', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (_url, init) => (init?.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json({ share: null })));

    await fetchPlanShare(PLAN_ID);
    await updatePlanShare(PLAN_ID);
    await updatePlanShare(PLAN_ID, { showName: true, showTranscriptChecks: false });
    await expect(stopPlanShare(PLAN_ID)).resolves.toBeUndefined();

    const calls = fetch.mock.calls.map(([url, init]) => [
      init?.method,
      String(url).slice(API_URL.length),
      init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    ]);
    expect(calls).toEqual([
      ['GET', `/plans/${PLAN_ID}/share`, undefined],
      ['PUT', `/plans/${PLAN_ID}/share`, {}],
      ['PUT', `/plans/${PLAN_ID}/share`, { showName: true, showTranscriptChecks: false }],
      ['DELETE', `/plans/${PLAN_ID}/share`, undefined],
    ]);
    for (const [, init] of fetch.mock.calls) {
      expect(init).toMatchObject({ headers: { Authorization: 'Bearer zz-token' } });
    }
  });

  it('reads a shared plan publicly without requiring a session, returning null on 404 and rethrowing server errors', async () => {
    setActivePinia(createPinia());
    const token = 'q3T0c6mJm0mB1bqT8mWl2k0E1e8b6Zb1K3w1r5yX9aA';
    const payload = { name: 'Main plan' };
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json(payload))
      .mockResolvedValueOnce(Response.json({ statusCode: 404, message: 'This plan is not shared', error: 'Not Found' }, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));

    await expect(fetchSharedPlan(token)).resolves.toEqual(payload);
    await expect(fetchSharedPlan('dead-token')).resolves.toBeNull();
    await expect(fetchSharedPlan(token)).rejects.toMatchObject({ status: 503 });

    expect(String(fetch.mock.calls[0]![0])).toBe(`${API_URL}/shared-plans/${token}`);
    expect((fetch.mock.calls[0]![1]?.headers as Record<string, string> | undefined)?.Authorization).toBeUndefined();
  });

  it('escapes path segments and builds full shared URLs', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ share: null }));
    await fetchPlanShare('a/b');
    await fetchSharedPlan('x/y');
    expect(String(fetch.mock.calls[0]![0])).toBe(`${API_URL}/plans/a%2Fb/share`);
    expect(String(fetch.mock.calls[1]![0])).toBe(`${API_URL}/shared-plans/x%2Fy`);
    expect(sharedPlanUrl('tok_123', 'https://omnicourse.example')).toBe('https://omnicourse.example/shared/tok_123');
  });
});
