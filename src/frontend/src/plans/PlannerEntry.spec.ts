import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterView, type Router } from 'vue-router';
import { onboarding } from '../onboarding/testing/fixtures.js';
import { mockApi, sentBody, status } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import { rememberLastPlan } from './last-plan.js';
import { listItem, OTHER_ID, PLAN_ID, plan } from './testing/fixtures.js';

// The planner's front door (/plans): it opens a plan at once instead of a list.
let wrapper: VueWrapper | undefined;
let router: Router;

// Each opened plan's own requests are not this spec's concern: answer them with errors and keep the console quiet.
const opened = (id: string) => ({ [`GET /plans/${id}`]: status(500), [`GET /plans/${id}/issues`]: status(500), 'GET /programs/APCS/curricula/2024': status(500) });

async function render(routes: Record<string, unknown>, options: Parameters<typeof setup>[1] = {}) {
  const fetch = mockApi(routes);
  const app = await setup('/plans', options);
  router = app.router;
  wrapper = mount(RouterView, { global: { plugins: [app.pinia, router] }, attachTo: document.body });
  await flushPromises();
  return { w: wrapper, fetch };
}

describe('PlannerEntry (F5)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('opens the plan the student had open last', async () => {
    rememberLastPlan(OTHER_ID);
    await render({ 'GET /plans': { plans: [listItem(), listItem({ id: OTHER_ID })] }, ...opened(OTHER_ID) });
    expect(router.currentRoute.value.fullPath).toBe(`/plans/${OTHER_ID}`);
  });

  it('opens the first plan when the last one is gone or unknown', async () => {
    rememberLastPlan('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    await render({ 'GET /plans': { plans: [listItem(), listItem({ id: OTHER_ID })] }, ...opened(PLAN_ID) });
    expect(router.currentRoute.value.fullPath).toBe(`/plans/${PLAN_ID}`);
  });

  it('makes a "Default plan" on the student’s program and cohort when there is none, and opens it', async () => {
    let body: unknown;
    await render({
      'GET /plans': { plans: [] },
      'POST /plans': (init: RequestInit) => ((body = sentBody(init)), Response.json(plan([], { id: OTHER_ID }), { status: 201 })),
      ...opened(OTHER_ID),
    });
    expect(body).toEqual({ name: 'Kế hoạch mặc định', programCode: 'APCS', cohortYear: 2024 });
    expect(router.currentRoute.value.fullPath).toBe(`/plans/${OTHER_ID}`);
  });

  it('shows the plans list, which says what to do, when the student has no program yet', async () => {
    await render({ 'GET /plans': { plans: [] } }, { onboarded: onboarding({ program: null, cohort: null }) });
    expect(router.currentRoute.value.name).toBe('plan-list');
  });

  it('offers a retry and the list when the plans cannot be read', async () => {
    const { w } = await render({ 'GET /plans': status(500) });
    expect(w.get('[data-test="entry-failed"]').text()).toContain('Danh sách kế hoạch');
    expect(router.currentRoute.value.name).toBe('plans');
  });
});
