import { afterEach, describe, expect, it, vi } from 'vitest';
import contract from '../../../backend/openapi.json';
import { API_URL } from '../api.js';
import { contractEnum } from '../testing/contract.js';
import {
  createPlan,
  deletePlan,
  duplicatePlan,
  fetchPlan,
  fetchPlanIssues,
  fetchPlans,
  previewPlanDrops,
  previewPlanIssues,
  PLAN_NAME_MAX_LENGTH,
  renamePlan,
  savePlacements,
  type PlanDropPreview,
} from './api.js';
import { PLANNER_MESSAGES } from './messages.js';
import { ISSUE_KINDS_SHOWN } from './present.js';
import { course, PLAN_ID } from './testing/fixtures.js';

describe('plan issues against the contract (F5, ADR 0014)', () => {
  it('shows every issue kind of the contract', () => {
    expect([...ISSUE_KINDS_SHOWN].sort()).toEqual(contractEnum('PlanIssueDto', 'kind'));
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
    for (const lang of ['vi', 'en'] as const) expect(Object.keys(PLANNER_MESSAGES[lang].issueTitle).sort()).toEqual(contractEnum('PlanIssueDto', 'code'));
  });
});

describe('plan name length', () => {
  it('is the length the API checks on create, rename and copy', () => {
    for (const dto of ['CreatePlanDto', 'RenamePlanDto', 'DuplicatePlanDto'] as const) expect(contract.components.schemas[dto].properties.name.maxLength).toBe(PLAN_NAME_MAX_LENGTH);
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

  it('sends the drag preview to its route with the token and the body', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ reports: [] }));
    const body: PlanDropPreview = {
      terms: [{ term: { year: 2026, number: 1 }, placements: [course('ZZ101')] }],
      placement: course('ZZ102'),
      targets: [{ year: 2026, number: 2 }],
    };
    await expect(previewPlanDrops('zz-token', PLAN_ID, body)).resolves.toEqual({ reports: [] });
    const [url, init] = fetch.mock.calls[0]!;
    expect([init?.method, String(url).slice(API_URL.length), JSON.parse(String(init?.body))]).toEqual(['POST', `/plans/${PLAN_ID}/issues/drops`, body]);
    expect(init).toMatchObject({ headers: { Authorization: 'Bearer zz-token' } });
  });

  it('lets the drag preview be cancelled with its signal', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ reports: [] }));
    const controller = new AbortController();
    await previewPlanDrops('zz-token', PLAN_ID, { terms: [], placement: course('ZZ101'), targets: [] }, controller.signal);
    const signal = fetch.mock.calls[0]![1]!.signal!;
    expect(signal.aborted).toBe(false);
    controller.abort();
    expect(signal.aborted).toBe(true);
  });

  it('lets a drag preview be cancelled with its signal', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({}));
    const controller = new AbortController();
    await previewPlanIssues('zz-token', PLAN_ID, [], controller.signal);
    const signal = fetch.mock.calls[0]![1]!.signal!;
    expect(signal.aborted).toBe(false);
    controller.abort();
    expect(signal.aborted).toBe(true);
  });

  it('escapes the id in the path', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({}));
    await fetchPlan('zz-token', 'a/b');
    expect(String(fetch.mock.calls[0]![0])).toBe(`${API_URL}/plans/a%2Fb`);
  });
});
