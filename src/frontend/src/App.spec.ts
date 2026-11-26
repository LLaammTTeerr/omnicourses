import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { EVERY_GRANT, NO_GRANTS } from './admin/testing/fixtures.js';
import App from './App.vue';
import { useAuth } from './auth/store.js';
import { session } from './auth/testing/fixtures.js';
import { useSidebar } from './shell/sidebar.js';
import { useToast } from './shell/toast.js';
import { UNREAD_POLL_MS } from './notifications/store.js';
import { mockApi } from './testing/fetch.js';
import { HEALTHY } from './testing/health.js';
import { NOT_STARTED } from './onboarding/api.js';
import { setup } from './testing/signed-in.js';

let wrapper: VueWrapper | undefined;

async function render(path: string, signedIn: boolean, routes: Record<string, unknown> = {}) {
  mockApi({
    'GET /health': HEALTHY,
    'GET /guides': { guides: [] },
    'GET /auth/sessions': [session({ current: true })],
    'GET /users/me/transcript': { rows: [] },
    'GET /admin/grants': NO_GRANTS,
    'GET /notifications/unread-count': { unread: 0 },
    ...routes,
  });
  const { pinia, router } = await setup(path, { signedIn });
  wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body });
  await flushPromises();
  return { w: wrapper, router };
}

describe('App shell', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('frames the guides with the public header for a visitor and the sidebar for a student (ADR 0010)', async () => {
    const visitor = await render('/guides', false);
    expect(visitor.w.find('.pub-head').exists()).toBe(true);
    expect(visitor.w.find('.side').exists()).toBe(false);
    visitor.w.unmount();

    const student = await render('/guides', true);
    expect(student.w.find('.pub-head').exists()).toBe(false);
    expect(student.w.findAll('.side .nav a').map((a) => a.text())).toEqual(['Tổng quan', 'Lịch', 'Thông báo', 'Xét tốt nghiệp', 'Bảng điểm', 'Chương trình', 'Lộ trình', 'Hướng dẫn', 'Cài đặt']);
    expect(student.w.get('.side .nav a[href="/guides"]').classes()).toContain('router-link-active');
    expect(student.w.get('.side .me').text()).toContain('Sinh viên thử');
  });

  it('lists Administration in the sidebar only for a user who holds a grant, as the API says (ADR 0011)', async () => {
    const holder = await render('/guides', true, { 'GET /admin/grants': EVERY_GRANT });
    expect(holder.w.findAll('.side .nav a').map((a) => a.text())).toEqual(['Tổng quan', 'Lịch', 'Thông báo', 'Xét tốt nghiệp', 'Bảng điểm', 'Chương trình', 'Lộ trình', 'Hướng dẫn', 'Cài đặt', 'Quản trị']);
    expect(holder.w.get('[data-test="nav-admin"]').attributes('href')).toBe('/admin');
    holder.w.unmount();

    vi.spyOn(console, 'error').mockImplementation(() => {});
    const unknown = await render('/guides', true, { 'GET /admin/grants': () => new Response(null, { status: 503 }) });
    expect(unknown.w.find('[data-test="nav-admin"]').exists()).toBe(false);
    expect(unknown.w.findAll('.side .nav a')).toHaveLength(9);
  });

  it('asks for the grants again on the next page when the first request failed, so the entry appears without a reload', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let down = true;
    const { w, router } = await render('/guides', true, { 'GET /admin/grants': () => (down ? new Response(null, { status: 503 }) : Response.json(EVERY_GRANT)) });
    expect(w.find('[data-test="nav-admin"]').exists()).toBe(false);
    down = false;
    await router.push('/privacy');
    await flushPromises();
    expect(w.get('[data-test="nav-admin"]').attributes('href')).toBe('/admin');
    const asked = () => vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/admin/grants')).length;
    const before = asked();
    await router.push('/guides');
    await flushPromises();
    expect(asked()).toBe(before);
  });

  it('asks for no grants while nobody is signed in', async () => {
    await render('/guides', false);
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url)).filter((url) => url.includes('/admin/'))).toEqual([]);
  });

  it('frames the privacy notice with the public header for a visitor, and links it from the footer', async () => {
    const { w } = await render('/privacy', false);
    expect(w.find('.pub-head').exists()).toBe(true);
    expect(w.get('#main h1').text()).toBe('Quyền riêng tư');
    expect(w.get('.pub-foot a[href="/privacy"]').text()).toBe('Quyền riêng tư');
  });

  it('has one main landmark on the onboarding page, the shell’s, for the skip link', async () => {
    mockApi({ 'GET /health': HEALTHY, 'GET /programs': { programs: [] }, 'GET /admin/grants': NO_GRANTS, 'GET /notifications/unread-count': { unread: 0 } });
    const { pinia, router } = await setup('/onboarding', { onboarded: NOT_STARTED });
    wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body });
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('onboarding');
    expect(wrapper.findAll('main')).toHaveLength(1);
    expect(document.querySelectorAll('#main')).toHaveLength(1);
  });

  it('shows sign-in without any header', async () => {
    const { w } = await render('/sign-in', false);
    expect(w.find('.pub-head').exists()).toBe(false);
    expect(w.find('.side').exists()).toBe(false);
    expect(w.get('#main h1').text()).toBe('Chào mừng trở lại.');
  });

  it('offers a visitor sign-in and sign-up, and a student the app', async () => {
    const visitor = await render('/', false);
    expect(visitor.w.get('.pub-head').text()).toContain('Đăng nhập');
    expect(visitor.w.get('.pub-head').text()).toContain('Tạo tài khoản');
    visitor.w.unmount();
    const student = await render('/', true);
    expect(student.w.get('.pub-head a.primary').attributes('href')).toBe('/dashboard');
  });

  it('sends the student to sign in, and back, when the session ends on a private page', async () => {
    const { router } = await render('/settings', true);
    useAuth().clear();
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('sign-in');
    expect(router.currentRoute.value.query.redirect).toBe('/settings');
    expect(useToast().message).toBe('Phiên đăng nhập đã kết thúc. Hãy đăng nhập lại.');
  });

  it('tells the student when signing in cancelled a pending deletion (ADR 0004)', async () => {
    await render('/transcript', true);
    useAuth().accountRestored = true;
    await nextTick();
    expect(useToast().message).toBe('Chào mừng trở lại. Việc xóa tài khoản đã được hủy, dữ liệu của bạn vẫn còn nguyên.');
    expect(useAuth().accountRestored).toBe(false);
  });

  it('narrows the sidebar with [ unless the student is typing', async () => {
    const { w } = await render('/settings', true);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '[', bubbles: true }));
    await nextTick();
    expect(useSidebar().mini).toBe(true);
    expect(w.get('.frame').classes()).toContain('side-mini');
    w.get('.side-toggle[aria-pressed]').element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    expect(useSidebar().mini).toBe(false);

    const input = document.createElement('input');
    document.body.append(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: '[', bubbles: true }));
    input.remove();
    expect(useSidebar().mini).toBe(false);
  });

  it('switches the theme from the sidebar, naming the theme it switches to', async () => {
    const { w } = await render('/settings', true);
    const button = w.get('.side .theme-btn');
    const before = document.documentElement.dataset.theme;
    const label = button.text();
    expect(label).toBe(before === 'dark' ? 'Giao diện sáng' : 'Giao diện tối');
    await button.trigger('click');
    expect(document.documentElement.dataset.theme).toBe(before === 'dark' ? 'light' : 'dark');
    expect(button.text()).not.toBe(label);
  });

  it('stops asking for the grants on each page after three failures in a row (#160)', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { router } = await render('/guides', true, { 'GET /admin/grants': () => new Response(null, { status: 503 }) });
    for (const path of ['/privacy', '/guides', '/privacy', '/guides', '/privacy', '/guides']) {
      await router.push(path);
      await flushPromises();
    }
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/admin/grants'))).toHaveLength(3);
    expect(logged.mock.calls.filter(([text]) => String(text).includes('administration grants'))).toHaveLength(3);
  });

});

describe('the notification bell (F10)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const unreadReads = () => vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/notifications/unread-count')).length;

  it('shows the unread count on the Notifications entry, spoken as a count', async () => {
    const { w } = await render('/guides', true, { 'GET /notifications/unread-count': { unread: 3 } });
    const entry = w.get('[data-test="nav-notifications"]');
    expect(entry.attributes('href')).toBe('/notifications');
    expect(entry.get('[data-test="unread-badge"]').text()).toBe('33 chưa đọc');
    expect(entry.get('.badge [aria-hidden="true"]').text()).toBe('3');
  });

  it('shows no badge when nothing is unread, and caps a large count', async () => {
    const none = await render('/guides', true);
    expect(none.w.find('[data-test="unread-badge"]').exists()).toBe(false);
    none.w.unmount();
    const many = await render('/guides', true, { 'GET /notifications/unread-count': { unread: 150 } });
    expect(many.w.get('.badge [aria-hidden="true"]').text()).toBe('99+');
  });

  it('reads the count again on each page and every minute, and never while signed out', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { router } = await render('/guides', true);
    const first = unreadReads();
    expect(first).toBe(1);
    await router.push('/privacy');
    await flushPromises();
    expect(unreadReads()).toBe(first + 1);
    vi.advanceTimersByTime(UNREAD_POLL_MS);
    await flushPromises();
    expect(unreadReads()).toBe(first + 2);
    wrapper!.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();

    await render('/guides', false);
    vi.advanceTimersByTime(UNREAD_POLL_MS);
    await flushPromises();
    expect(unreadReads()).toBe(0);
  });
});
