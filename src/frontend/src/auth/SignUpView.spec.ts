import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { useLocale } from '../locale.js';
import { mockApi, sentBody, status } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import SignUpView from './SignUpView.vue';
import { useAuth } from './store.js';
import { authResult } from './testing/fixtures.js';

let wrapper: VueWrapper | undefined;

async function render(path = '/sign-up') {
  const { pinia, router } = await setup(path, { signedIn: false });
  wrapper = mount(SignUpView, { global: { plugins: [pinia, router] }, attachTo: document.body });
  return { w: wrapper, router };
}

async function fill(w: VueWrapper, { name = 'Sinh viên thử', email = 'zz-student@example.com', password = 'zz-password-1', consent = true } = {}) {
  await w.get('#sign-up-displayName').setValue(name);
  await w.get('#sign-up-email').setValue(email);
  await w.get('#sign-up-password').setValue(password);
  await w.get('#sign-up-consent').setValue(consent);
}

async function submit(w: VueWrapper) {
  await w.get('form').trigger('submit');
  await flushPromises();
}

describe('SignUpView (F1, issue #13)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('creates the account with the consent the API records, and opens the transcript', async () => {
    const fetch = mockApi({ 'POST /auth/sign-up': () => Response.json(authResult({ token: 'zz-new' }), { status: 201 }) });
    const { w, router } = await render();
    await fill(w, { name: '  Sinh viên thử ', email: ' zz-student@example.com ' });
    await submit(w);
    expect(sentBody(fetch.mock.calls[0]![1])).toEqual({
      displayName: 'Sinh viên thử',
      email: 'zz-student@example.com',
      password: 'zz-password-1',
      acceptedTerms: true,
    });
    expect(useAuth().token).toBe('zz-new');
    expect(router.currentRoute.value.fullPath).toBe('/transcript');
  });

  it('refuses to send without consent, a name, a valid email and a 10-character password', async () => {
    const fetch = mockApi({});
    const { w } = await render();
    await fill(w, { name: '   ', email: 'zz@', password: 'short', consent: false });
    await submit(w);
    expect(fetch).not.toHaveBeenCalled();
    expect(w.get('#sign-up-displayName-error').text()).toBe('Nhập tên hiển thị.');
    expect(w.get('#sign-up-email-error').text()).toBe('Email chưa đúng định dạng.');
    expect(w.get('#sign-up-password-error').text()).toBe('Còn thiếu 5 ký tự.');
    expect(w.get('#sign-up-consent-error').text()).toBe('Cần đồng ý xử lý dữ liệu để tạo tài khoản.');
    expect(w.get('#sign-up-consent').attributes('aria-invalid')).toBe('true');
    expect(document.activeElement?.id).toBe('sign-up-displayName');
  });

  it('rates the password as the student types, in words as well as colour', async () => {
    const { w } = await render();
    const strength = () => w.get('[data-test="strength"]').text();
    expect(strength()).toBe('Dùng một mật khẩu riêng, khác mật khẩu cổng trường.');
    await w.get('#sign-up-password').setValue('abc');
    expect(strength()).toBe('Còn thiếu 7 ký tự.');
    await w.get('#sign-up-password').setValue('abcdefghij');
    expect(strength()).toBe('Độ mạnh mật khẩu: Yếu');
    await w.get('#sign-up-password').setValue('abcdefghijklm1!');
    expect(strength()).toBe('Độ mạnh mật khẩu: Rất mạnh');
    useLocale().set('en');
    await nextTick();
    expect(strength()).toBe('Password strength: Very strong');
    expect(w.get('#sign-up-password').attributes('aria-describedby')).toBe('sign-up-password-strength');
  });

  it('says when the email already has an account, with a way to sign in that keeps the redirect (409)', async () => {
    mockApi({ 'POST /auth/sign-up': status(409, { message: 'Email already registered' }) });
    const { w } = await render('/sign-up?redirect=/settings');
    await fill(w);
    await submit(w);
    const alert = w.get('[role="alert"]');
    expect(alert.text()).toContain('Email này đã có tài khoản.');
    expect(alert.get('a').attributes('href')).toBe('/sign-in?redirect=/settings');
    expect(useAuth().signedIn).toBe(false);
  });

  it.each([
    [429, 'Quá nhiều lần thử từ mạng này. Đợi một phút rồi thử lại.'],
    [400, 'Có ô chưa hợp lệ. Kiểm tra lại rồi gửi lần nữa.'],
  ])('says what went wrong on a %i', async (code, message) => {
    mockApi({ 'POST /auth/sign-up': status(code, { message: ['password must be longer than or equal to 10 characters'] }) });
    const { w } = await render();
    await fill(w);
    await submit(w);
    expect(w.get('[role="alert"]').text()).toBe(message);
  });
});
