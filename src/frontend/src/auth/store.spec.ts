import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL, HttpError } from '../api.js';
import { requestAsUser, sendAsUser, SESSION_STORAGE_KEY, useAccountCache, useAuth } from './store.js';
import { authResult, user } from './testing/fixtures.js';
import { ACCOUNT_STORAGE_KEYS } from '../account-storage.js';
import { restoreMocksAfterCheckingCalls } from '../testing/fetch.js';

const fetchMock = () => vi.spyOn(globalThis, 'fetch');

describe('auth store (ADR 0002)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    setActivePinia(createPinia());
  });
  afterEach(() => restoreMocksAfterCheckingCalls());

  it('keeps the token in sessionStorage, never localStorage', async () => {
    fetchMock().mockResolvedValue(Response.json(authResult({ token: 'zz-new' })));
    await useAuth().signIn({ email: 'zz@example.com', password: 'zz-password-1' });
    expect(useAuth().token).toBe('zz-new');
    expect(useAuth().signedIn).toBe(true);
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBe('zz-new');
    expect(Object.values({ ...localStorage })).not.toContain('zz-new');
  });

  it('starts signed out, without calling the API, when no token is saved', async () => {
    const fetch = fetchMock();
    await useAuth().start();
    expect(useAuth().signedIn).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('exchanges a saved token for a fresh one once per page load', async () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'zz-old');
    const fetch = fetchMock().mockResolvedValue(Response.json(authResult({ token: 'zz-fresh' })));
    const auth = useAuth();
    await Promise.all([auth.start(), auth.start()]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/auth/refresh`, expect.objectContaining({ method: 'POST', headers: { Authorization: 'Bearer zz-old' } }));
    expect(auth.token).toBe('zz-fresh');
    expect(auth.user?.displayName).toBe('Sinh viên thử');
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBe('zz-fresh');
  });

  it('forgets a saved token the API no longer accepts', async () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'zz-dead');
    fetchMock().mockResolvedValue(new Response(null, { status: 401 }));
    await useAuth().start();
    expect(useAuth().signedIn).toBe(false);
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('keeps a saved token for the next load when the API cannot be reached, and retries on the next start()', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'zz-maybe');
    const fetch = fetchMock().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(Response.json(authResult({ token: 'zz-recovered' })));
    const auth = useAuth();
    await auth.start();
    expect(auth.signedIn).toBe(false);
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBe('zz-maybe');

    await auth.start();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(auth.signedIn).toBe(true);
    expect(auth.token).toBe('zz-recovered');
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBe('zz-recovered');
  });

  it('remembers that a sign-in cancelled a pending deletion (ADR 0004)', async () => {
    fetchMock().mockResolvedValue(Response.json(authResult({ accountRestored: true })));
    await useAuth().signIn({ email: 'zz@example.com', password: 'zz-password-1' });
    expect(useAuth().accountRestored).toBe(true);
  });

  it('signs out on the server and forgets the session here', async () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'zz-old');
    const fetch = fetchMock().mockResolvedValueOnce(Response.json(authResult({ token: 'zz-live' })));
    await useAuth().start();
    fetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await useAuth().signOut();
    expect(fetch).toHaveBeenLastCalledWith(`${API_URL}/auth/sign-out`, expect.objectContaining({ method: 'POST', headers: { Authorization: 'Bearer zz-live' } }));
    expect(useAuth().signedIn).toBe(false);
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('forgets the session even when the server cannot be told', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetch = fetchMock().mockResolvedValueOnce(Response.json(authResult()));
    await useAuth().signIn({ email: 'zz@example.com', password: 'zz-password-1' });
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await useAuth().signOut();
    expect(useAuth().signedIn).toBe(false);
  });

  const PLAN_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const leaveAccountData = () => {
    localStorage.setItem(ACCOUNT_STORAGE_KEYS.lastPlan, PLAN_ID);
    localStorage.setItem(ACCOUNT_STORAGE_KEYS.planLocks, JSON.stringify([PLAN_ID]));
  };
  const accountData = () => [localStorage.getItem(ACCOUNT_STORAGE_KEYS.lastPlan), localStorage.getItem(ACCOUNT_STORAGE_KEYS.planLocks)];

  it('forgets the student’s last plan and plan locks on this browser when they sign out', async () => {
    fetchMock().mockResolvedValueOnce(Response.json(authResult({ token: 'zz-live' }))).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await useAuth().signIn({ email: 'zz@example.com', password: 'zz-password-1' });
    leaveAccountData();
    expect(accountData()).toEqual([PLAN_ID, JSON.stringify([PLAN_ID])]);
    await useAuth().signOut();
    expect(accountData()).toEqual([null, null]);
  });

  it('forgets them too when the session ends on a 401, during a call or at page load', async () => {
    fetchMock().mockResolvedValue(Response.json(authResult({ token: 'zz-live' })));
    const auth = useAuth();
    await auth.signIn({ email: 'zz@example.com', password: 'zz-password-1' });
    leaveAccountData();
    await expect(auth.authed(async () => Promise.reject(new HttpError('/x', 401)))).rejects.toThrow('401');
    expect(accountData()).toEqual([null, null]);

    setActivePinia(createPinia());
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'zz-old');
    leaveAccountData();
    fetchMock().mockResolvedValue(new Response(null, { status: 401 }));
    await useAuth().start();
    expect(accountData()).toEqual([null, null]);
  });

  it('signs the student out here when a call answers 401, and passes other errors on', async () => {
    fetchMock().mockResolvedValue(Response.json(authResult({ token: 'zz-live' })));
    const auth = useAuth();
    await auth.signIn({ email: 'zz@example.com', password: 'zz-password-1' });

    await expect(auth.authed(async () => Promise.reject(new HttpError('/x', 403, 'DELETE')))).rejects.toThrow('403');
    expect(auth.signedIn).toBe(true);

    const seen: string[] = [];
    await expect(auth.authed(async (token) => (seen.push(token), Promise.reject(new HttpError('/x', 401))))).rejects.toThrow('401');
    expect(seen).toEqual(['zz-live']);
    expect(auth.signedIn).toBe(false);
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});

describe('calls outside the contract', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    setActivePinia(createPinia());
  });
  afterEach(() => vi.restoreAllMocks());

  it('sends a call as the signed-in student with their token, and signs them out on a 401', async () => {
    const fetch = fetchMock().mockResolvedValueOnce(Response.json(authResult({ token: 'zz-live' }))).mockResolvedValueOnce(Response.json({ ok: true }));
    const auth = useAuth();
    await auth.signIn({ email: 'zz@example.com', password: 'zz-password-1' });

    await expect(requestAsUser('GET', '/x')).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenLastCalledWith(`${API_URL}/x`, expect.objectContaining({ method: 'GET', headers: { Authorization: 'Bearer zz-live' } }));

    fetch.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await expect(sendAsUser('GET', '/x')).rejects.toThrow('401');
    expect(auth.signedIn).toBe(false);
  });
});

describe('useAccountCache', () => {
  const OTHER_ID = '00000000-0000-4000-8000-000000000002';

  function signIn(id = user().id) {
    const auth = useAuth();
    auth.token = 'zz-token';
    auth.user = user({ id });
  }

  function deferred() {
    let resolve!: (value: string) => void;
    const promise = new Promise<string>((done) => { resolve = done; });
    return { promise, resolve };
  }

  beforeEach(() => setActivePinia(createPinia()));

  it('loads once per account, and joins a load that is still out', async () => {
    const fetchValue = vi.fn().mockResolvedValue('zz-answers');
    signIn();
    const cache = useAccountCache(fetchValue);
    const [a, b] = await Promise.all([cache.load(), cache.load()]);
    expect([a, b]).toEqual(['zz-answers', 'zz-answers']);
    await cache.load();
    expect(fetchValue).toHaveBeenCalledTimes(1);
    expect(cache.value.value).toBe('zz-answers');
  });

  it('loads again for another account, and never shows one account the value of another', async () => {
    const fetchValue = vi.fn().mockResolvedValueOnce('zz-first').mockResolvedValueOnce('zz-second');
    signIn();
    const cache = useAccountCache(fetchValue);
    await cache.load();
    signIn(OTHER_ID);
    expect(cache.value.value).toBeNull();
    expect(await cache.load()).toBe('zz-second');
    expect(fetchValue).toHaveBeenCalledTimes(2);
  });

  it('keeps only the newest answer when a fresh load overtakes an older one', async () => {
    const older = deferred();
    const newer = deferred();
    signIn();
    const cache = useAccountCache(vi.fn().mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise));
    const first = cache.load();
    const second = cache.load({ fresh: true });
    expect(cache.isLatest(first)).toBe(false);
    expect(cache.isLatest(second)).toBe(true);
    newer.resolve('zz-newer');
    older.resolve('zz-older');
    await Promise.all([first, second]);
    expect(cache.value.value).toBe('zz-newer');
  });

  it('does not let a late answer for one account replace the value of the account now signed in', async () => {
    signIn();
    const cache = useAccountCache(vi.fn());
    signIn(OTHER_ID);
    cache.seed(OTHER_ID, 'zz-other');
    cache.keep(user().id, 'zz-late');
    expect(cache.value.value).toBe('zz-other');
  });

  it('forgets the value and any load that is out', async () => {
    const out = deferred();
    const fetchValue = vi.fn().mockReturnValueOnce(out.promise).mockResolvedValueOnce('zz-again');
    signIn();
    const cache = useAccountCache(fetchValue);
    const first = cache.load();
    cache.forget();
    out.resolve('zz-dropped');
    await first;
    expect(cache.value.value).toBeNull();
    expect(await cache.load()).toBe('zz-again');
  });

  it('refuses to load while signed out', async () => {
    await expect(useAccountCache(vi.fn()).load()).rejects.toThrow('Not signed in');
  });
});
