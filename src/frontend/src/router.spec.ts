import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory } from 'vue-router';
import { SESSION_STORAGE_KEY } from './auth/store.js';
import { authResult } from './auth/testing/fixtures.js';
import { createAppRouter } from './router.js';
import { NOT_STARTED } from './onboarding/api.js';
import { onboarding } from './onboarding/testing/fixtures.js';
import { mockApi, status } from './testing/fetch.js';
import { setup } from './testing/signed-in.js';

describe('router guard (issue #13)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(['/transcript', '/settings'])('sends a signed-out visitor from %s to sign-in, and remembers where they were going', async (path) => {
    const { router } = await setup(`${path}?x=1`, { signedIn: false });
    expect(router.currentRoute.value.name).toBe('sign-in');
    expect(router.currentRoute.value.query.redirect).toBe(`${path}?x=1`);
  });

  it.each(['/', '/guides', '/guides/zz-fresh', '/privacy', '/sign-in', '/sign-up'])('lets a signed-out visitor open %s', async (path) => {
    const { router } = await setup(path, { signedIn: false });
    expect(router.currentRoute.value.fullPath).toBe(path);
  });

  it('sends a signed-in student away from sign-in, to the redirect or the dashboard', async () => {
    expect((await setup('/sign-in')).router.currentRoute.value.fullPath).toBe('/dashboard');
    expect((await setup('/sign-up?redirect=/settings')).router.currentRoute.value.fullPath).toBe('/settings');
    expect((await setup('/sign-in?redirect=https://example.com')).router.currentRoute.value.fullPath).toBe('/dashboard');
  });

  it('opens a private page after a reload once the saved session is refreshed', async () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'zz-old');
    mockApi({ 'POST /auth/refresh': () => Response.json(authResult()) });
    setActivePinia(createPinia());
    const router = createAppRouter(createMemoryHistory());
    await router.push('/settings');
    expect(router.currentRoute.value.fullPath).toBe('/settings');
  });

  it('sends an unknown address to the home page', async () => {
    const { router } = await setup('/no/such/page', { signedIn: false });
    expect(router.currentRoute.value.fullPath).toBe('/');
  });
});

describe('onboarding comes first (UC-01 A5, A8)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(['/transcript', '/explorer'])('sends a student who has not finished from %s to onboarding, and back after', async (path) => {
    mockApi({ 'GET /users/me/onboarding': NOT_STARTED });
    const { router } = await setup(path, { onboarded: null });
    expect(router.currentRoute.value.name).toBe('onboarding');
    expect(router.currentRoute.value.query.redirect).toBe(path);
  });

  it('keeps settings open, so account controls work before onboarding is finished (A7)', async () => {
    mockApi({ 'GET /users/me/onboarding': NOT_STARTED });
    expect((await setup('/settings', { onboarded: null })).router.currentRoute.value.fullPath).toBe('/settings');
  });

  it('opens onboarding no more once it is finished (step 9)', async () => {
    expect((await setup('/onboarding')).router.currentRoute.value.fullPath).toBe('/dashboard');
    expect((await setup('/onboarding?redirect=/explorer')).router.currentRoute.value.fullPath).toBe('/explorer');
    expect((await setup('/onboarding?redirect=/onboarding')).router.currentRoute.value.fullPath).toBe('/dashboard');
  });

  it('opens a private page right away for a student who has finished', async () => {
    const fetch = mockApi({ 'GET /users/me/onboarding': onboarding() });
    expect((await setup('/explorer', { onboarded: null })).router.currentRoute.value.fullPath).toBe('/explorer');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('never loops when the answers cannot be loaded: the page opens', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockApi({ 'GET /users/me/onboarding': status(503) });
    expect((await setup('/transcript', { onboarded: null })).router.currentRoute.value.fullPath).toBe('/transcript');
  });

  it('leaves signed-out visitors to the sign-in guard', async () => {
    const fetch = mockApi({});
    expect((await setup('/explorer', { signedIn: false, onboarded: null })).router.currentRoute.value.name).toBe('sign-in');
    expect(fetch).not.toHaveBeenCalled();
  });
});
