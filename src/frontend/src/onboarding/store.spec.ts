import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/store.js';
import { user } from '../auth/testing/fixtures.js';
import { mockApi, sentBody, status } from '../testing/fetch.js';
import { NOT_STARTED } from './api.js';
import { useOnboarding } from './store.js';
import { onboarding } from './testing/fixtures.js';

function signIn(id = user().id) {
  const auth = useAuth();
  auth.token = 'zz-token';
  auth.user = user({ id });
}

describe('useOnboarding', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    sessionStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('loads the answers once per account', async () => {
    const fetch = mockApi({ 'GET /users/me/onboarding': NOT_STARTED });
    signIn();
    const store = useOnboarding();
    const [a, b] = await Promise.all([store.load(), store.load()]);
    expect(a).toEqual(NOT_STARTED);
    expect(b).toBe(a);
    await store.load();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(store.finished).toBe(false);
  });

  it('saves the whole object and keeps what the API saved', async () => {
    const fetch = mockApi({ 'PUT /users/me/onboarding': (init: RequestInit) => Response.json(sentBody(init)) });
    signIn();
    const store = useOnboarding();
    await store.save(onboarding());
    expect(sentBody(fetch.mock.calls[0]![1])).toEqual(onboarding());
    expect(store.finished).toBe(true);
  });

  it('never shows one account the answers of another', async () => {
    mockApi({ 'GET /users/me/onboarding': onboarding() });
    signIn();
    const store = useOnboarding();
    await store.load();
    expect(store.answers?.program).toBe('APCS');
    useAuth().clear();
    expect(store.answers).toBeNull();
    signIn('00000000-0000-4000-8000-000000000002');
    expect(store.answers).toBeNull();
    expect(store.finished).toBe(false);
  });

  it('signs the student out when the API says the session is over', async () => {
    mockApi({ 'GET /users/me/onboarding': status(401) });
    signIn();
    await expect(useOnboarding().load()).rejects.toThrow('401');
    expect(useAuth().signedIn).toBe(false);
  });
});
