import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory } from 'vue-router';
import { SESSION_STORAGE_KEY } from './auth/store.js';
import { authResult } from './auth/testing/fixtures.js';
import { createAppRouter } from './router.js';
import { mockApi } from './testing/fetch.js';
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

  it.each(['/', '/guides', '/guides/zz-fresh', '/sign-in', '/sign-up'])('lets a signed-out visitor open %s', async (path) => {
    const { router } = await setup(path, { signedIn: false });
    expect(router.currentRoute.value.fullPath).toBe(path);
  });

  it('sends a signed-in student away from sign-in, to the redirect or the transcript', async () => {
    expect((await setup('/sign-in')).router.currentRoute.value.fullPath).toBe('/transcript');
    expect((await setup('/sign-up?redirect=/settings')).router.currentRoute.value.fullPath).toBe('/settings');
    expect((await setup('/sign-in?redirect=https://example.com')).router.currentRoute.value.fullPath).toBe('/transcript');
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
