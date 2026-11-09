import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterView, type Router } from 'vue-router';
import { useAuth } from '../auth/store.js';
import { onboarding } from '../onboarding/testing/fixtures.js';
import { useToast } from '../shell/toast.js';
import { mockApi, sentBody, status } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import { OTHER_ID, PLAN_ID, plan, report, summary } from './testing/fixtures.js';

let wrapper: VueWrapper | undefined;
let router: Router;

const MAIN = summary();
const LIGHT = summary({ id: OTHER_ID, name: 'Nhẹ tải thử' });

async function render(routes: Record<string, unknown> = {}, options: Parameters<typeof setup>[1] = {}) {
  const fetch = mockApi({ 'GET /plans': { plans: [MAIN, LIGHT] }, ...routes });
  const app = await setup('/plans', options);
  router = app.router;
  wrapper = mount(RouterView, { global: { plugins: [app.pinia, router] }, attachTo: document.body });
  await flushPromises();
  return { w: wrapper, fetch };
}

const names = (w: VueWrapper) => w.findAll('[data-test="plan"] .plan-name').map((a) => a.text());
const card = (w: VueWrapper, i: number) => w.findAll('[data-test="plan"]')[i]!;
const calls = (fetch: ReturnType<typeof mockApi>, method: string) => fetch.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === method);

describe('PlansView (F5, UC-05 A6)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('lists the student’s plans with their curriculum, each linking to its editor', async () => {
    const { w } = await render();
    expect(names(w)).toEqual(['Kế hoạch thử', 'Nhẹ tải thử']);
    expect(card(w, 0).text()).toContain('CTĐT APCS2024');
    expect(card(w, 0).get('a').attributes('href')).toBe(`/plans/${PLAN_ID}`);
  });

  it('says so when there is no plan yet', async () => {
    const { w } = await render({ 'GET /plans': { plans: [] } });
    expect(w.get('[data-test="empty"]').text()).toContain('Bạn chưa có kế hoạch nào.');
  });

  it('creates a plan on the student’s program and cohort, then opens it', async () => {
    const created = plan([], { id: OTHER_ID, name: 'Tốt nghiệp thử' });
    let body: unknown;
    const { w } = await render({
      'POST /plans': (init: RequestInit) => {
        body = sentBody(init);
        return Response.json(created, { status: 201 });
      },
      [`GET /plans/${OTHER_ID}`]: created,
      [`GET /plans/${OTHER_ID}/issues`]: report(),
      'GET /programs/APCS/curricula/2024': status(404),
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await w.get('[data-test="new-plan"]').trigger('click');
    await flushPromises();
    const dialog = w.get('dialog[open]');
    expect(dialog.text()).toContain('APCS 2024');
    await dialog.get('form').trigger('submit');
    expect(dialog.text()).toContain('Hãy nhập tên, tối đa 100 ký tự.');
    await dialog.get('input').setValue('  Tốt nghiệp thử  ');
    await dialog.get('form').trigger('submit');
    await flushPromises();
    expect(body).toEqual({ name: 'Tốt nghiệp thử', programCode: 'APCS', cohortYear: 2024 });
    expect(router.currentRoute.value.fullPath).toBe(`/plans/${OTHER_ID}`);
    expect(useToast().message).toBe('Đã tạo Tốt nghiệp thử.');
  });

  it('asks for a program before creating a plan', async () => {
    const { w } = await render({}, { onboarded: onboarding({ program: null, cohort: null }) });
    expect(w.get('[data-test="new-plan"]').attributes('disabled')).toBeDefined();
    expect(w.get('[data-test="no-program"]').text()).toContain('Cài đặt');
  });

  it('renames a plan', async () => {
    let body: unknown;
    const { w } = await render({
      [`PATCH /plans/${PLAN_ID}`]: (init: RequestInit) => {
        body = sentBody(init);
        return Response.json({ ...plan(), name: 'Đổi tên thử' });
      },
    });
    await card(w, 0).get('[data-test="rename"]').trigger('click');
    await flushPromises();
    const input = w.get('dialog[open] input');
    expect((input.element as HTMLInputElement).value).toBe('Kế hoạch thử');
    await input.setValue('Đổi tên thử');
    await w.get('dialog[open] form').trigger('submit');
    await flushPromises();
    expect(body).toEqual({ name: 'Đổi tên thử' });
    expect(names(w)).toEqual(['Đổi tên thử', 'Nhẹ tải thử']);
    expect(w.find('dialog[open]').exists()).toBe(false);
  });

  it('keeps the rename dialog open with the error when the rename fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w } = await render({ [`PATCH /plans/${PLAN_ID}`]: status(500) });
    await card(w, 0).get('[data-test="rename"]').trigger('click');
    await flushPromises();
    await w.get('dialog[open] input').setValue('Đổi tên thử');
    await w.get('dialog[open] form').trigger('submit');
    await flushPromises();
    expect(w.get('dialog[open] [role="alert"]').text()).toContain('Chưa thực hiện được.');
    expect(names(w)).toEqual(['Kế hoạch thử', 'Nhẹ tải thử']);
  });

  it('copies a plan under a name that says it is a copy', async () => {
    let body: unknown;
    const { w } = await render({
      [`POST /plans/${PLAN_ID}/duplicate`]: (init: RequestInit) => {
        body = sentBody(init);
        return Response.json(plan([], { id: '00000000-0000-4000-8000-0000000000a3', name: 'Bản sao của Kế hoạch thử' }), { status: 201 });
      },
    });
    await card(w, 0).get('[data-test="copy"]').trigger('click');
    await flushPromises();
    expect(body).toEqual({ name: 'Bản sao của Kế hoạch thử' });
    expect(names(w)).toEqual(['Kế hoạch thử', 'Nhẹ tải thử', 'Bản sao của Kế hoạch thử']);
  });

  it('asks before deleting, and deletes only on confirmation', async () => {
    const { w, fetch } = await render({ [`DELETE /plans/${OTHER_ID}`]: status(204) });
    await card(w, 1).get('[data-test="delete"]').trigger('click');
    await flushPromises();
    expect(w.get('dialog[open]').text()).toContain('Xóa Nhẹ tải thử?');
    await w.findAll('dialog[open] button').find((b) => b.text() === 'Giữ lại')!.trigger('click');
    await flushPromises();
    expect(calls(fetch, 'DELETE')).toHaveLength(0);
    expect(names(w)).toHaveLength(2);

    await card(w, 1).get('[data-test="delete"]').trigger('click');
    await flushPromises();
    await w.get('[data-test="confirm-delete"]').trigger('click');
    await flushPromises();
    expect(calls(fetch, 'DELETE')).toHaveLength(1);
    expect(names(w)).toEqual(['Kế hoạch thử']);
    expect(useToast().message).toBe('Đã xóa Nhẹ tải thử.');
  });

  it('offers a retry when the plans cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let fail = true;
    const { w } = await render({ 'GET /plans': () => (fail ? new Response(null, { status: 503 }) : Response.json({ plans: [MAIN] })) });
    expect(w.get('[role="alert"]').text()).toContain('Chưa tải được kế hoạch.');
    fail = false;
    await w.get('[role="alert"] button').trigger('click');
    await flushPromises();
    expect(names(w)).toEqual(['Kế hoạch thử']);
  });

  it('signs the student out on a 401', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await render({ 'GET /plans': status(401) });
    expect(useAuth().signedIn).toBe(false);
  });
});
