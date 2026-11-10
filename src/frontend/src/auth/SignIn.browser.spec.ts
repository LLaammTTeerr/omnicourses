import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { App as VueApp } from 'vue';
import { createMemoryHistory, type Router } from 'vue-router';
import { createOmniCourseApp } from '../app.js';
import { onboarding } from '../onboarding/testing/fixtures.js';
import { createAppRouter } from '../router.js';
import { mockApi, sentBody, status } from '../testing/fetch.js';
import { HEALTHY } from '../testing/health.js';
import { SESSION_STORAGE_KEY } from './store.js';
import { authResult } from './testing/fixtures.js';

// F1 sign-in (UC-01, ADR 0002) in Chromium: the real screen, router, store and App.vue, with the API mocked
// with synthetic accounts. The real API is checked on the server in the B1 acceptance run (docs/test/browser-tests.md).

const EMAIL = 'zz-student@example.com';
const PASSWORD = 'zz-password-1';
const UNAUTHORIZED = status(401, { statusCode: 401, message: 'Unauthorized' });

let app: VueApp | undefined;
let host: HTMLDivElement | undefined;

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(() => {
  app?.unmount();
  host?.remove();
  app = host = undefined;
  sessionStorage.clear();
  localStorage.clear();
  vi.restoreAllMocks();
});

async function open(path: string, routes: Record<string, unknown>): Promise<Router> {
  mockApi({ 'GET /health': HEALTHY, 'GET /users/me/onboarding': onboarding(), ...routes });
  const router = createAppRouter(createMemoryHistory());
  host = document.createElement('div');
  document.body.append(host);
  app = createOmniCourseApp(router);
  app.mount(host);
  await router.push(path);
  await router.isReady();
  return router;
}

async function signIn(email: string, password: string): Promise<void> {
  await page.getByLabelText('Email').fill(email);
  await page.getByLabelText('Mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
}

const heading = (name: string) => page.getByRole('heading', { level: 1, name });

describe('signing in (UC-01)', () => {
  it('signs in with a valid email and password, keeps the session and opens the transcript', async () => {
    const router = await open('/sign-in', {
      'POST /auth/sign-in': (init: RequestInit) => {
        expect(sentBody(init)).toEqual({ email: EMAIL, password: PASSWORD });
        return Response.json(authResult());
      },
      'GET /users/me/transcript': { rows: [] },
    });
    await expect.element(heading('Chào mừng trở lại.')).toBeVisible();

    await signIn(`  ${EMAIL} `, PASSWORD);
    await expect.element(heading('Bảng điểm')).toBeVisible();
    expect(router.currentRoute.value.fullPath).toBe('/transcript');
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBe('zz-token');
  });

  it('says a wrong password is wrong on a 401, without saying which field, and stays signed out', async () => {
    const router = await open('/sign-in', { 'POST /auth/sign-in': UNAUTHORIZED });
    await signIn(EMAIL, 'zz-wrong-password');

    // ADR 0002: one answer for an unknown email and a wrong password.
    const alert = page.getByRole('alert');
    await expect.element(alert).toHaveTextContent('Email hoặc mật khẩu không đúng.');
    expect(router.currentRoute.value.name).toBe('sign-in');
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    // The student fixes the password without typing the email again.
    await expect.element(page.getByLabelText('Email')).toHaveValue(EMAIL);
    await expect.element(page.getByRole('button', { name: 'Đăng nhập' })).toBeEnabled();
  });

  it('on a 401 from a private page, says the session ended, and signing in again goes back', async () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'zz-saved');
    let transcriptCalls = 0;
    const router = await open('/transcript', {
      'POST /auth/refresh': () => Response.json(authResult({ token: 'zz-saved' })),
      // Revoked on another device once the session was refreshed: the page's first call gets a 401.
      'GET /users/me/transcript': () => (transcriptCalls++ === 0 ? UNAUTHORIZED() : Response.json({ rows: [] })),
      'POST /auth/sign-in': () => Response.json(authResult()),
    });
    await expect.element(heading('Chào mừng trở lại.')).toBeVisible();
    await expect.element(page.getByRole('status').filter({ hasText: 'Phiên đăng nhập đã kết thúc. Hãy đăng nhập lại.' })).toBeInTheDocument();
    expect(router.currentRoute.value.fullPath).toBe('/sign-in?redirect=/transcript');
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();

    await signIn(EMAIL, PASSWORD);
    await expect.element(heading('Bảng điểm')).toBeVisible();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBe('zz-token');
  });
});
