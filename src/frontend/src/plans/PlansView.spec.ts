import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterView, type Router } from 'vue-router';
import { useAuth } from '../auth/store.js';
import { onboarding } from '../onboarding/testing/fixtures.js';
import { useToast } from '../shell/toast.js';
import { closeNatively, hung, mockApi, sentBody, status } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import { listItem, OTHER_ID, PLAN_ID, plan, report } from './testing/fixtures.js';

let wrapper: VueWrapper | undefined;
let router: Router;

const MAIN = listItem();
const LIGHT = listItem({ id: OTHER_ID, name: 'Nhẹ tải thử', preview: { termCount: 0, courseCount: 0, slotCount: 0, firstTerm: null, lastTerm: null } });

async function render(routes: Record<string, unknown> = {}, options: Parameters<typeof setup>[1] = {}) {
  const fetch = mockApi({ 'GET /plans': { plans: [MAIN, LIGHT] }, ...routes });
  const app = await setup('/plans/all', options);
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

  it('shows what each plan holds, and opens it from a click anywhere on its card but its buttons', async () => {
    const { w } = await render({ [`GET /plans/${PLAN_ID}`]: plan(), [`GET /plans/${PLAN_ID}/issues`]: report(), 'GET /programs/APCS/curricula/2024': status(404) });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(card(w, 0).get('[data-test="plan-span"]').text()).toBe('HK1 2026–2027 → HK3 2026–2027');
    expect(card(w, 0).get('[data-test="plan-counts"]').text()).toBe('2 học kỳ · 2 môn · 1 chỗ tự chọn');
    expect(card(w, 1).find('[data-test="plan-span"]').exists()).toBe(false);
    expect(card(w, 1).get('[data-test="plan-counts"]').text()).toBe('Chưa xếp môn nào');
    await card(w, 0).get('[data-test="rename"]').trigger('click');
    expect(router.currentRoute.value.name).toBe('plan-list');
    await card(w, 0).get('[data-test="plan-counts"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe(`/plans/${PLAN_ID}`);
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
    expect(w.get('dialog[open] h2').text()).toBe('Xóa kế hoạch này?');
    expect(w.get('dialog[open] [data-test="delete-name"]').text()).toBe('Nhẹ tải thử');
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

  it('keeps the delete dialog open until the deletion answers', async () => {
    let answer!: (response: Response) => void;
    const { w } = await render({ [`DELETE /plans/${OTHER_ID}`]: () => new Promise<Response>((resolve) => (answer = resolve)) });
    await card(w, 1).get('[data-test="delete"]').trigger('click');
    await flushPromises();
    await w.get('[data-test="confirm-delete"]').trigger('click');
    await flushPromises();
    const keep = w.findAll('dialog[open] button').find((b) => b.text() === 'Giữ lại')!;
    expect(keep.attributes('disabled')).toBeDefined();
    expect(w.get('dialog[open] [role="status"]').text()).toBe('Đang xử lý…');
    // Escape reaches the dialog as a cancel event.
    await w.get('dialog[open]').trigger('cancel');
    await flushPromises();
    expect(w.find('dialog[open]').exists()).toBe(true);
    answer(new Response(null, { status: 204 }));
    await flushPromises();
    expect(w.find('dialog[open]').exists()).toBe(false);
    expect(names(w)).toEqual(['Kế hoạch thử']);
  });

  it('keeps the name dialog open until its request answers', async () => {
    let answer!: (response: Response) => void;
    const { w } = await render({ [`PATCH /plans/${PLAN_ID}`]: () => new Promise<Response>((resolve) => (answer = resolve)) });
    await card(w, 0).get('[data-test="rename"]').trigger('click');
    await flushPromises();
    await w.get('dialog[open] input').setValue('Đổi tên thử');
    await w.get('dialog[open] form').trigger('submit');
    await flushPromises();
    const cancel = w.findAll('dialog[open] button').find((b) => b.text() === 'Hủy')!;
    expect(cancel.attributes('disabled')).toBeDefined();
    expect(w.get('dialog[open] [role="status"]').text()).toBe('Đang xử lý…');
    await w.get('dialog[open]').trigger('cancel');
    await flushPromises();
    expect(w.find('dialog[open]').exists()).toBe(true);
    answer(Response.json({ ...plan(), name: 'Đổi tên thử' }));
    await flushPromises();
    expect(w.find('dialog[open]').exists()).toBe(false);
    expect(names(w)).toEqual(['Đổi tên thử', 'Nhẹ tải thử']);
  });

  it('brings the delete dialog back when the browser closes it during the deletion, and says there if it fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let answer!: (response: Response) => void;
    const { w } = await render({ [`DELETE /plans/${OTHER_ID}`]: () => new Promise<Response>((resolve) => (answer = resolve)) });
    await card(w, 1).get('[data-test="delete"]').trigger('click');
    await flushPromises();
    await w.get('[data-test="confirm-delete"]').trigger('click');
    await flushPromises();
    closeNatively(w.get('dialog[open]').element);
    await flushPromises();
    expect(w.find('dialog[open]').exists()).toBe(true);
    answer(status(503)());
    await flushPromises();
    const dialog = w.get('dialog[open]');
    expect(dialog.get('[role="alert"]').text()).toBe('Chưa thực hiện được. Hãy thử lại.');
    expect(names(w)).toEqual(['Kế hoạch thử', 'Nhẹ tải thử']);
  });

  it('brings the name dialog back when the browser closes it during its request', async () => {
    let answer!: (response: Response) => void;
    const { w } = await render({ [`PATCH /plans/${PLAN_ID}`]: () => new Promise<Response>((resolve) => (answer = resolve)) });
    await card(w, 0).get('[data-test="rename"]').trigger('click');
    await flushPromises();
    await w.get('dialog[open] input').setValue('Đổi tên thử');
    await w.get('dialog[open] form').trigger('submit');
    await flushPromises();
    closeNatively(w.get('dialog[open]').element);
    await flushPromises();
    expect(w.find('dialog[open]').exists()).toBe(true);
    answer(Response.json({ ...plan(), name: 'Đổi tên thử' }));
    await flushPromises();
    expect(w.find('dialog[open]').exists()).toBe(false);
    expect(names(w)).toEqual(['Đổi tên thử', 'Nhẹ tải thử']);
  });

  // While busy, `closedby="none"` leaves the Android back gesture to the browser, which goes back in history.
  it('stays on the page when the student goes back during a deletion, and says its result', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let answer!: (response: Response) => void;
    const { w } = await render({
      [`DELETE /plans/${OTHER_ID}`]: () => new Promise<Response>((resolve) => (answer = resolve)),
      'GET /guides': { guides: [] },
    });
    // A page to go back to.
    await router.push('/guides');
    await router.push('/plans/all');
    await flushPromises();
    await card(w, 1).get('[data-test="delete"]').trigger('click');
    await flushPromises();
    await w.get('[data-test="confirm-delete"]').trigger('click');
    await flushPromises();
    router.back();
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/plans/all');
    expect(w.find('dialog[open]').exists()).toBe(true);

    answer(status(503)());
    await flushPromises();
    expect(w.get('dialog[open] [role="alert"]').text()).toBe('Chưa thực hiện được. Hãy thử lại.');
    await w.findAll('dialog[open] button').find((b) => b.text() === 'Giữ lại')!.trigger('click');
    router.back();
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/guides');
  });

  it('says a deletion that gets no answer in its dialog, and lets the student out', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // The request's timeout, fired by the test instead of after 30 seconds.
    const timer = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timer.signal);
    const { w } = await render({ [`DELETE /plans/${OTHER_ID}`]: hung });
    await card(w, 1).get('[data-test="delete"]').trigger('click');
    await flushPromises();
    await w.get('[data-test="confirm-delete"]').trigger('click');
    await flushPromises();
    const keep = () => w.findAll('dialog[open] button').find((b) => b.text() === 'Giữ lại')!;
    expect(keep().attributes('disabled')).toBeDefined();

    timer.abort(new DOMException('The operation timed out.', 'TimeoutError'));
    await flushPromises();
    expect(w.get('dialog[open] [role="alert"]').text()).toBe('Chưa thực hiện được. Hãy thử lại.');
    expect(keep().attributes('disabled')).toBeUndefined();
    await keep().trigger('click');
    await flushPromises();
    expect(w.find('dialog[open]').exists()).toBe(false);
  });

  // A deletion that timed out here may still have gone through on the server, so a retry finds no plan.
  it('takes a plan that is already gone (404) out of the list instead of asking to try again', async () => {
    const { w } = await render({ [`DELETE /plans/${OTHER_ID}`]: status(404, { statusCode: 404, message: 'No plan with this id' }) });
    await card(w, 1).get('[data-test="delete"]').trigger('click');
    await flushPromises();
    await w.get('[data-test="confirm-delete"]').trigger('click');
    await flushPromises();
    expect(w.find('dialog[open]').exists()).toBe(false);
    expect(names(w)).toEqual(['Kế hoạch thử']);
    expect(useToast().message).toBe('Đã xóa Nhẹ tải thử.');
  });

  it('lets no other action start while a copy runs, so its failure is not said in another dialog', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let answer!: (response: Response) => void;
    const { w, fetch } = await render({ [`POST /plans/${PLAN_ID}/duplicate`]: () => new Promise<Response>((resolve) => (answer = resolve)) });
    await card(w, 0).get('[data-test="copy"]').trigger('click');
    await flushPromises();
    for (const action of ['rename', 'copy', 'delete']) expect(card(w, 1).get(`[data-test="${action}"]`).attributes('disabled')).toBeDefined();
    expect(w.get('[data-test="new-plan"]').attributes('disabled')).toBeDefined();
    await card(w, 1).get('[data-test="delete"]').trigger('click');
    await flushPromises();
    expect(w.find('dialog[open]').exists()).toBe(false);

    answer(status(503)());
    await flushPromises();
    expect(w.find('dialog[open]').exists()).toBe(false);
    expect(useToast().message).toBe('Chưa thực hiện được. Hãy thử lại.');
    expect(calls(fetch, 'DELETE')).toHaveLength(0);
    expect(card(w, 1).get('[data-test="delete"]').attributes('disabled')).toBeUndefined();
  });

  it('loads the student’s program itself, with a retry, when the answers were not loaded before', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let failures = 2;
    const { w } = await render(
      { 'GET /users/me/onboarding': () => (failures-- > 0 ? new Response(null, { status: 503 }) : Response.json(onboarding())) },
      { onboarded: null },
    );
    // The router guard's load and the view's both failed: the program is unknown, not missing.
    expect(w.find('[data-test="no-program"]').exists()).toBe(false);
    expect(w.get('[data-test="program-failed"]').text()).toContain('Chưa tải được chương trình và khóa của bạn.');
    expect(w.get('[data-test="new-plan"]').attributes('disabled')).toBeDefined();
    await w.get('[data-test="program-failed"] button').trigger('click');
    await flushPromises();
    expect(w.find('[data-test="program-failed"]').exists()).toBe(false);
    expect(w.get('[data-test="new-plan"]').attributes('disabled')).toBeUndefined();
  });

  it('cuts a long copy name between characters, never inside one', async () => {
    let body: unknown;
    const long = `${'x'.repeat(87)}😀yy`;
    const { w } = await render({
      'GET /plans': { plans: [listItem({ name: long })] },
      [`POST /plans/${PLAN_ID}/duplicate`]: (init: RequestInit) => {
        body = sentBody(init);
        return Response.json(plan([], { id: '00000000-0000-4000-8000-0000000000a3', name: 'Bản sao' }), { status: 201 });
      },
    });
    await card(w, 0).get('[data-test="copy"]').trigger('click');
    await flushPromises();
    expect(body).toEqual({ name: `Bản sao của ${'x'.repeat(87)}😀` });
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
