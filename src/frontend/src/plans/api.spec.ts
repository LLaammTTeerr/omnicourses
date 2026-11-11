import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../api.js';
import { contractEnum, contractShape, type Shape } from '../testing/contract.js';
import {
  createPlan,
  deletePlan,
  duplicatePlan,
  fetchPlan,
  fetchPlanIssues,
  fetchPlans,
  previewPlanIssues,
  PLACEMENT_KINDS,
  PLAN_ISSUE_CODES,
  PLAN_ISSUE_KINDS,
  renamePlan,
  savePlacements,
  TERM_KINDS,
  type CreatePlanBody,
  type CreditCaps,
  type Placement,
  type Plan,
  type PlanCombinedMinimumCoverage,
  type PlanCoverage,
  type PlanCurriculum,
  type PlanGroupCoverage,
  type PlanIssue,
  type PlanIssues,
  type PlanList,
  type PlanSummary,
  type PlanTerm,
  type PlanTermLoad,
} from './api.js';
import { PLANNER_MESSAGES } from './messages.js';
import { course, PLAN_ID } from './testing/fixtures.js';

const summary = { id: 'required', name: 'required', curriculum: 'required', createdAt: 'required', updatedAt: 'required' } as const;

describe('plan types against the contract (F5, ADR 0014)', () => {
  it.each([
    ['PlanCurriculumDto', { id: 'required', code: 'required', programCode: 'required', cohortYear: 'required' } satisfies Shape<PlanCurriculum>],
    ['PlanSummaryDto', summary satisfies Shape<PlanSummary>],
    ['PlanDto', { ...summary, terms: 'required' } satisfies Shape<Plan>],
    ['PlanListDto', { plans: 'required' } satisfies Shape<PlanList>],
    ['PlanTermDto', { term: 'required', placements: 'required' } satisfies Shape<PlanTerm>],
    ['PlanPlacementDto', { kind: 'required', courseCode: 'optional', requirementGroupId: 'optional', credits: 'optional' } satisfies Shape<Placement>],
    ['CreatePlanDto', { name: 'required', programCode: 'required', cohortYear: 'required', terms: 'optional' } satisfies Shape<CreatePlanBody>],
    ['CreditCapsDto', { min: 'required', max: 'required' } satisfies Shape<CreditCaps>],
    ['PlanTermLoadDto', { term: 'required', kind: 'required', credits: 'required', caps: 'required' } satisfies Shape<PlanTermLoad>],
    [
      'PlanIssueDto',
      {
        code: 'required',
        kind: 'required',
        term: 'required',
        position: 'required',
        courseCode: 'required',
        requirementGroupId: 'required',
        combinedMinimumId: 'required',
        missingCourseCodes: 'required',
        offeredTermNumbers: 'required',
        credits: 'required',
        limit: 'required',
        citation: 'required',
        message: 'required',
      } satisfies Shape<PlanIssue>,
    ],
    [
      'PlanGroupCoverageDto',
      { id: 'required', name: 'required', kind: 'required', requiredCredits: 'required', credits: 'required', remainingCredits: 'required', met: 'required' } satisfies Shape<PlanGroupCoverage>,
    ],
    [
      'PlanCombinedMinimumCoverageDto',
      { id: 'required', name: 'required', creditsMin: 'required', credits: 'required', remainingCredits: 'required', met: 'required' } satisfies Shape<PlanCombinedMinimumCoverage>,
    ],
    [
      'PlanCoverageDto',
      { groups: 'required', combinedMinimums: 'required', totalRequired: 'required', totalCredits: 'required', totalRemaining: 'required', graduation: 'required' } satisfies Shape<PlanCoverage>,
    ],
    ['PlanIssuesDto', { planId: 'required', trainingType: 'required', terms: 'required', issues: 'required', coverage: 'required' } satisfies Shape<PlanIssues>],
  ])('has the fields of %s', (schema, shape) => {
    expect(contractShape(schema)).toEqual(shape);
  });

  it('has the issue codes, kinds, placement kinds and term kinds of the contract', () => {
    expect([...PLAN_ISSUE_CODES].sort()).toEqual(contractEnum('PlanIssueDto', 'code'));
    expect([...PLAN_ISSUE_KINDS].sort()).toEqual(contractEnum('PlanIssueDto', 'kind'));
    expect([...PLACEMENT_KINDS].sort()).toEqual(contractEnum('PlanPlacementDto', 'kind'));
    expect([...TERM_KINDS, null].sort()).toEqual(contractEnum('PlanTermLoadDto', 'kind'));
    expect(contractEnum('PlanCoverageDto', 'graduation')).toEqual(['done', 'not_yet']);
  });

  it('words the change a drag preview would make to the violations, in both languages', () => {
    expect([0, 1, 2, -1, -3].map(PLANNER_MESSAGES.vi.previewDelta)).toEqual(['số vi phạm không đổi', 'thêm 1 vi phạm', 'thêm 2 vi phạm', 'bớt 1 vi phạm', 'bớt 3 vi phạm']);
    expect([0, 1, 2, -1, -3].map(PLANNER_MESSAGES.en.previewDelta)).toEqual([
      'same number of violations',
      '1 more violation',
      '2 more violations',
      '1 fewer violation',
      '3 fewer violations',
    ]);
  });

  it('words every issue code of the contract in both languages', () => {
    for (const lang of ['vi', 'en'] as const) expect(Object.keys(PLANNER_MESSAGES[lang].issue).sort()).toEqual(contractEnum('PlanIssueDto', 'code'));
  });
});

describe('plan requests', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends each call to its route with the token and the body', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => (init?.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json({})));
    const terms = [{ term: { year: 2026, number: 1 as const }, placements: [course('ZZ101')] }];
    await fetchPlans('zz-token');
    await createPlan('zz-token', { name: 'A', programCode: 'APCS', cohortYear: 2024 });
    await fetchPlan('zz-token', PLAN_ID);
    await renamePlan('zz-token', PLAN_ID, 'B');
    await duplicatePlan('zz-token', PLAN_ID, 'C');
    await expect(deletePlan('zz-token', PLAN_ID)).resolves.toBeUndefined();
    await savePlacements('zz-token', PLAN_ID, terms);
    await fetchPlanIssues('zz-token', PLAN_ID);
    await previewPlanIssues('zz-token', PLAN_ID, terms);
    const calls = fetch.mock.calls.map(([url, init]) => [init?.method, String(url).slice(API_URL.length), init?.body === undefined ? undefined : JSON.parse(String(init.body))]);
    expect(calls).toEqual([
      ['GET', '/plans', undefined],
      ['POST', '/plans', { name: 'A', programCode: 'APCS', cohortYear: 2024 }],
      ['GET', `/plans/${PLAN_ID}`, undefined],
      ['PATCH', `/plans/${PLAN_ID}`, { name: 'B' }],
      ['POST', `/plans/${PLAN_ID}/duplicate`, { name: 'C' }],
      ['DELETE', `/plans/${PLAN_ID}`, undefined],
      ['PUT', `/plans/${PLAN_ID}/placements`, { terms }],
      ['GET', `/plans/${PLAN_ID}/issues`, undefined],
      ['POST', `/plans/${PLAN_ID}/issues`, { terms }],
    ]);
    for (const [, init] of fetch.mock.calls) expect(init).toMatchObject({ headers: { Authorization: 'Bearer zz-token' } });
  });

  it('escapes the id in the path', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({}));
    await fetchPlan('zz-token', 'a/b');
    expect(String(fetch.mock.calls[0]![0])).toBe(`${API_URL}/plans/a%2Fb`);
  });
});
