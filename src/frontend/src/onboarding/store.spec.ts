import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/store.js';
import { user } from '../auth/testing/fixtures.js';
import { mockApi, sentBody, status, restoreMocksAfterCheckingCalls } from '../testing/fetch.js';
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
  afterEach(() => restoreMocksAfterCheckingCalls());

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

  it('keeps the answers of the account now signed in when an earlier account’s save answers late', async () => {
    let answerSave!: (response: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) =>
      init?.method === 'PUT' ? new Promise((resolve) => { answerSave = resolve; }) : Promise.resolve(Response.json(NOT_STARTED)));
    signIn();
    const store = useOnboarding();
    const saving = store.save(onboarding());
    signIn('00000000-0000-4000-8000-000000000002');
    await store.load();
    answerSave(Response.json(onboarding()));
    await saving;
    expect(store.answers).toEqual(NOT_STARTED);
    expect(store.finished).toBe(false);
  });

  it('signs the student out when the API says the session is over', async () => {
    mockApi({ 'GET /users/me/onboarding': status(401) });
    signIn();
    await expect(useOnboarding().load()).rejects.toThrow('401');
    expect(useAuth().signedIn).toBe(false);
  });

  it('purges cached answers on sign-out and re-fetches when the same account signs in again', async () => {
    let calls = 0;
    mockApi({
      'GET /users/me/onboarding': () => Response.json(++calls === 1 ? onboarding({ cohort: 2024 }) : onboarding({ cohort: 2025 })),
    });
    signIn();
    const store = useOnboarding();
    await store.load();
    expect(store.answers?.cohort).toBe(2024);

    useAuth().clear();
    expect(store.answers).toBeNull();

    signIn();
    expect(store.answers).toBeNull();
    await store.load();
    expect(calls).toBe(2);
    expect(store.answers?.cohort).toBe(2025);
  });

  it('forwards fresh: true to re-fetch while signed in', async () => {
    let calls = 0;
    mockApi({
      'GET /users/me/onboarding': () => Response.json(++calls === 1 ? NOT_STARTED : onboarding()),
    });
    signIn();
    const store = useOnboarding();
    await store.load();
    expect(store.finished).toBe(false);
    await store.load({ fresh: true });
    expect(calls).toBe(2);
    expect(store.finished).toBe(true);
  });
});
