import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import App from './App.vue';
import { useAuth } from './auth/store.js';
import { session } from './auth/testing/fixtures.js';
import { useSidebar } from './shell/sidebar.js';
import { useToast } from './shell/toast.js';
import { mockApi } from './testing/fetch.js';
import { HEALTHY } from './testing/health.js';
import { setup } from './testing/signed-in.js';

let wrapper: VueWrapper | undefined;

async function render(path: string, signedIn: boolean) {
  mockApi({ 'GET /health': HEALTHY, 'GET /guides': { guides: [] }, 'GET /auth/sessions': [session({ current: true })], 'GET /users/me/transcript': { rows: [] } });
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
    expect(student.w.findAll('.side .nav a').map((a) => a.text())).toEqual(['Tổng quan', 'Xét tốt nghiệp', 'Bảng điểm', 'Chương trình', 'Lộ trình', 'Hướng dẫn', 'Cài đặt']);
    expect(student.w.get('.side .nav a[href="/guides"]').classes()).toContain('router-link-active');
    expect(student.w.get('.side .me').text()).toContain('Sinh viên thử');
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
});
