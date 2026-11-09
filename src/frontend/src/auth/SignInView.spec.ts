import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, sentBody, status } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import SignInView from './SignInView.vue';
import { useAuth } from './store.js';
import { authResult } from './testing/fixtures.js';

let wrapper: VueWrapper | undefined;

async function render(path = '/sign-in') {
  const { pinia, router } = await setup(path, { signedIn: false });
  wrapper = mount(SignInView, { global: { plugins: [pinia, router] }, attachTo: document.body });
  return { w: wrapper, router };
}

async function fill(w: VueWrapper, email: string, password: string) {
  await w.get('#sign-in-email').setValue(email);
  await w.get('#sign-in-password').setValue(password);
  await w.get('form').trigger('submit');
  await flushPromises();
}

describe('SignInView (F1, issue #13)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('checks the fields before calling the API, and says what is wrong next to each', async () => {
    const fetch = mockApi({});
    const { w } = await render();
    await fill(w, 'not-an-email', '');
    expect(fetch).not.toHaveBeenCalled();
    expect(w.get('#sign-in-email').attributes('aria-invalid')).toBe('true');
    expect(w.get('#sign-in-email-error').text()).toBe('Email chưa đúng định dạng.');
    expect(w.get('#sign-in-password-error').text()).toBe('Nhập mật khẩu.');
    expect(w.get('#sign-in-email').attributes('aria-describedby')).toBe('sign-in-email-error');
    expect(document.activeElement?.id).toBe('sign-in-email');
  });

  it('signs in, keeps the session, and opens the page the guard came from', async () => {
    const fetch = mockApi({ 'POST /auth/sign-in': () => Response.json(authResult({ token: 'zz-new' })) });
    const { w, router } = await render('/sign-in?redirect=/settings');
    await fill(w, '  zz-student@example.com ', 'zz-password-1');
    expect(sentBody(fetch.mock.calls[0]![1])).toEqual({ email: 'zz-student@example.com', password: 'zz-password-1' });
    expect(useAuth().token).toBe('zz-new');
    expect(router.currentRoute.value.fullPath).toBe('/settings');
  });

  it('opens the transcript when nothing asked for another page', async () => {
    mockApi({ 'POST /auth/sign-in': () => Response.json(authResult()) });
    const { w, router } = await render();
    await fill(w, 'zz-student@example.com', 'zz-password-1');
    expect(router.currentRoute.value.fullPath).toBe('/transcript');
  });

  it.each([
    [401, 'Email hoặc mật khẩu không đúng.'],
    [429, 'Quá nhiều lần thử từ mạng này. Đợi một phút rồi thử lại.'],
    [400, 'Có ô chưa hợp lệ. Kiểm tra lại rồi gửi lần nữa.'],
    [503, 'Chưa kết nối được OmniCourse. Kiểm tra mạng rồi thử lại sau ít phút.'],
  ])('says what went wrong on a %i, and stays signed out', async (code, message) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockApi({ 'POST /auth/sign-in': status(code) });
    const { w, router } = await render();
    await fill(w, 'zz-student@example.com', 'zz-password-1');
    expect(w.get('[role="alert"]').text()).toBe(message);
    expect(useAuth().signedIn).toBe(false);
    expect(router.currentRoute.value.name).toBe('sign-in');
  });

  it('says when the API cannot be reached at all', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    const { w } = await render();
    await fill(w, 'zz-student@example.com', 'zz-password-1');
    expect(w.get('[role="alert"]').text()).toContain('Chưa kết nối được OmniCourse');
  });

  it('keeps the redirect on the link to sign-up', async () => {
    const { w } = await render('/sign-in?redirect=/settings');
    expect(w.get('a[href^="/sign-up"]').attributes('href')).toBe('/sign-up?redirect=/settings');
  });
});
