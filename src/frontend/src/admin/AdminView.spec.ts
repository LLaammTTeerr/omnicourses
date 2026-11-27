import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterView, type Router } from 'vue-router';
import { useLocale } from '../locale.js';
import { mockApi, status } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import { useAdminAccess } from './store.js';
import { ACCESS_MANAGER, EVERY_GRANT, NO_GRANTS, PROGRAM_ADMIN } from './testing/fixtures.js';
import { ADMIN_MESSAGES } from './messages.js';

let wrapper: VueWrapper | undefined;
let router: Router;

async function render(path: string, routes: Record<string, unknown>) {
  const fetch = mockApi(routes);
  const app = await setup(path);
  router = app.router;
  wrapper = mount(RouterView, { global: { plugins: [app.pinia, router] }, attachTo: document.body });
  await flushPromises();
  return { w: wrapper, fetch, ...app };
}

const has = (w: VueWrapper, test: string) => w.find(`[data-test="${test}"]`).exists();

describe('AdminView: who may open the administration page (ADR 0011, UC-11 A4)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('tells a signed-in user without a grant that they have no permission, and where their user ID is', async () => {
    const { w } = await render('/admin', { 'GET /admin/grants': NO_GRANTS });
    expect(w.get('h1').text()).toBe(ADMIN_MESSAGES.vi.title);
    const none = w.get('[data-test="admin-no-permission"]');
    expect(none.get('h2').text()).toBe(ADMIN_MESSAGES.vi.noPermissionTitle);
    expect(none.text()).toContain('Tài khoản của bạn chưa được cấp quyền nào trong số đó.');
    expect(none.get('a').attributes('href')).toBe('/settings#profile');
    expect(has(w, 'admin-tabs')).toBe(false);
    expect(has(w, 'admin-held')).toBe(false);
    useLocale().set('en');
    await flushPromises();
    expect(w.get('[data-test="admin-no-permission"] h2').text()).toBe(ADMIN_MESSAGES.en.noPermissionTitle);
  });

  it('opens without the onboarding detour: an administrator need not be a student', async () => {
    const { fetch } = await render('/admin', { 'GET /admin/grants': NO_GRANTS });
    expect(router.currentRoute.value.name).toBe('admin');
    expect(fetch.mock.calls.map(([url]) => String(url).split('/api')[1])).toEqual(['/admin/grants']);
  });

  it('lists the permissions the user holds', async () => {
    const { w } = await render('/admin', { 'GET /admin/grants': EVERY_GRANT });
    expect(w.get('[data-test="admin-held"]').findAll('li').map((li) => li.text())).toEqual(['Quản trị chương trình · ZZPROG', 'Quản lý phân quyền', 'Quản lý danh mục học phần']);
    expect(has(w, 'admin-no-permission')).toBe(false);
  });

  it('opens the first section the user holds from /admin, and marks it in the tabs', async () => {
    const { w } = await render('/admin', { 'GET /admin/grants': PROGRAM_ADMIN, 'GET /admin/programs': { programs: [] } });
    expect(router.currentRoute.value.name).toBe('admin-curriculum');
    const tab = w.get('[data-test="admin-tab-curriculum"]');
    expect(tab.text()).toBe('Nhóm yêu cầu');
    expect(tab.attributes('aria-current')).toBe('page');
    expect(w.get('[data-test="admin-tabs"]').attributes('aria-label')).toBe(ADMIN_MESSAGES.vi.sections);
    expect(has(w, 'no-programs')).toBe(true);
  });

  it('offers each section only to a user who holds its permission: the three are independent', async () => {
    const all = await render('/admin/access', { 'GET /admin/grants': EVERY_GRANT, 'GET /admin/access/programs': { programs: [] } });
    expect(all.w.findAll('.admin-tabs a').map((a) => [a.text(), a.attributes('href')])).toEqual([
      ['Nhóm yêu cầu', '/admin/curriculum'],
      ['Lịch năm học', '/admin/calendar'],
      ['Danh mục học phần', '/admin/catalog'],
      ['Nhập CSV', '/admin/import'],
      ['Phân quyền', '/admin/access'],
    ]);
    expect(all.w.get('[data-test="admin-tab-access"]').attributes('aria-current')).toBe('page');
    all.w.unmount();

    const manager = await render('/admin', { 'GET /admin/grants': ACCESS_MANAGER, 'GET /admin/access/programs': { programs: [] } });
    expect(manager.w.findAll('.admin-tabs a').map((a) => a.text())).toEqual(['Phân quyền']);
    expect(router.currentRoute.value.name).toBe('admin-access');
    await router.push('/admin/calendar');
    await flushPromises();
    expect(manager.w.get('[data-test="admin-section-denied"]').attributes('data-permission')).toBe('program_admin');
    expect(manager.w.get('[data-test="admin-section-denied"]').text()).toBe('Mục này cần quyền “Quản trị chương trình”. Tài khoản của bạn không có quyền đó.');
    await router.push('/admin/catalog');
    await flushPromises();
    expect(manager.w.get('[data-test="admin-section-denied"]').text()).toBe('Mục này cần quyền “Quản lý danh mục học phần”. Tài khoản của bạn không có quyền đó.');
    await router.push('/admin/import');
    await flushPromises();
    expect(manager.w.get('[data-test="admin-section-denied"]').attributes('data-permission')).toBe('catalog_maintainer program_admin');
    expect(manager.w.get('[data-test="admin-section-denied"]').text()).toBe('Mục này cần quyền “Quản lý danh mục học phần” hoặc “Quản trị chương trình”. Tài khoản của bạn không có quyền đó.');
  });

  it('names the permission a section needs when the user opens it without holding it, and loads nothing of it', async () => {
    const { w, fetch } = await render('/admin/curriculum', { 'GET /admin/grants': ACCESS_MANAGER });
    const denied = w.get('[data-test="admin-section-denied"]');
    expect(denied.attributes('data-permission')).toBe('program_admin');
    expect(denied.attributes('role')).toBe('alert');
    expect(denied.text()).toBe('Mục này cần quyền “Quản trị chương trình”. Tài khoản của bạn không có quyền đó.');
    expect(has(w, 'admin-tab-curriculum')).toBe(false);
    expect(fetch.mock.calls.map(([url]) => String(url).split('/api')[1])).toEqual(['/admin/grants']);
    useLocale().set('en');
    await flushPromises();
    expect(w.get('[data-test="admin-section-denied"]').text()).toBe('This section needs the “Program administrator” permission. Your account does not hold it.');
  });

  it('closes a section when its permission is revoked while it is open', async () => {
    const { w, pinia } = await render('/admin/curriculum', { 'GET /admin/grants': PROGRAM_ADMIN, 'GET /admin/programs': { programs: [] } });
    expect(has(w, 'no-programs')).toBe(true);
    useAdminAccess(pinia).seed(NO_GRANTS.userId, NO_GRANTS);
    await flushPromises();
    expect(has(w, 'no-programs')).toBe(false);
    expect(has(w, 'admin-no-permission')).toBe(true);
  });

  it('does not carry a refused save over to the next visit of the page', async () => {
    const { w, pinia } = await render('/admin/curriculum', { 'GET /admin/grants': PROGRAM_ADMIN, 'GET /admin/programs': { programs: [] } });
    useAdminAccess(pinia).refusal = { permission: 'program_admin' };
    await flushPromises();
    expect(has(w, 'admin-refused')).toBe(true);
    w.unmount();
    expect(useAdminAccess(pinia).refusal).toBeNull();
  });

  it('asks for the grants on every visit, and waits for the answer before it says anything', async () => {
    let answer!: (response: Response) => void;
    const fetch = mockApi({ 'GET /admin/grants': () => new Promise<Response>((resolve) => (answer = resolve)) });
    const app = await setup('/admin');
    useAdminAccess().seed(PROGRAM_ADMIN.userId, PROGRAM_ADMIN);
    wrapper = mount(RouterView, { global: { plugins: [app.pinia, app.router] }, attachTo: document.body });
    await flushPromises();
    expect(wrapper.get('[data-test="admin-loading"]').text()).toBe('Đang tải…');
    expect(has(wrapper, 'admin-held')).toBe(false);
    expect(has(wrapper, 'admin-no-permission')).toBe(false);
    answer(Response.json(NO_GRANTS));
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(has(wrapper, 'admin-no-permission')).toBe(true);
  });

  it('says when the grants could not be checked, which is not "no permission", and tries again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let calls = 0;
    const { w } = await render('/admin', { 'GET /admin/grants': () => (calls++ === 0 ? new Response(null, { status: 503 }) : Response.json(NO_GRANTS)) });
    expect(w.get('[data-test="admin-grants-failed"]').text()).toContain(ADMIN_MESSAGES.vi.grantsFailed);
    expect(has(w, 'admin-no-permission')).toBe(false);
    await w.get('[data-test="admin-grants-failed"] button').trigger('click');
    await flushPromises();
    expect(has(w, 'admin-grants-failed')).toBe(false);
    expect(has(w, 'admin-no-permission')).toBe(true);
  });

  it('sends a signed-out visitor to sign in first', async () => {
    const fetch = mockApi({ 'GET /admin/grants': status(401) });
    const app = await setup('/admin', { signedIn: false });
    expect(app.router.currentRoute.value.name).toBe('sign-in');
    expect(app.router.currentRoute.value.query.redirect).toBe('/admin');
    expect(fetch).not.toHaveBeenCalled();
  });
});
