import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL, HttpError } from '../api.js';
import { ACCOUNT_KEYS } from '../storage.js';
import { SESSION_STORAGE_KEY, useAuth } from './store.js';
import { authResult } from './testing/fixtures.js';

const fetchMock = () => vi.spyOn(globalThis, 'fetch');

describe('auth store (ADR 0002)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    setActivePinia(createPinia());
  });
  afterEach(() => vi.restoreAllMocks());

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

  it('keeps a saved token for the next load when the API cannot be reached', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'zz-maybe');
    fetchMock().mockRejectedValue(new TypeError('Failed to fetch'));
    await useAuth().start();
    expect(useAuth().signedIn).toBe(false);
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBe('zz-maybe');
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

  it('forgets what the account kept in this browser when it signs out', async () => {
    const fetch = fetchMock().mockResolvedValueOnce(Response.json(authResult()));
    await useAuth().signIn({ email: 'zz@example.com', password: 'zz-password-1' });
    localStorage.setItem(ACCOUNT_KEYS.lastPlan, 'zz-plan');
    localStorage.setItem(ACCOUNT_KEYS.planLocks, '["zz-plan"]');
    localStorage.setItem('omnicourse.lang', 'en');
    fetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await useAuth().signOut();
    expect(localStorage.getItem(ACCOUNT_KEYS.lastPlan)).toBeNull();
    expect(localStorage.getItem(ACCOUNT_KEYS.planLocks)).toBeNull();
    expect(localStorage.getItem('omnicourse.lang')).toBe('en');
  });

  it('forgets what the account kept in this browser when a call answers 401', async () => {
    fetchMock().mockResolvedValue(Response.json(authResult()));
    const auth = useAuth();
    await auth.signIn({ email: 'zz@example.com', password: 'zz-password-1' });
    localStorage.setItem(ACCOUNT_KEYS.lastPlan, 'zz-plan');
    await expect(auth.authed(async () => Promise.reject(new HttpError('/x', 401)))).rejects.toThrow('401');
    expect(localStorage.getItem(ACCOUNT_KEYS.lastPlan)).toBeNull();
  });

  it('forgets what the account kept in this browser when the saved session has ended', async () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'zz-dead');
    localStorage.setItem(ACCOUNT_KEYS.lastPlan, 'zz-plan');
    localStorage.setItem(ACCOUNT_KEYS.planLocks, '["zz-plan"]');
    fetchMock().mockResolvedValue(new Response(null, { status: 401 }));
    await useAuth().start();
    expect(localStorage.getItem(ACCOUNT_KEYS.lastPlan)).toBeNull();
    expect(localStorage.getItem(ACCOUNT_KEYS.planLocks)).toBeNull();
  });

  it('keeps what the account kept in this browser when the session may still be alive', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'zz-maybe');
    localStorage.setItem(ACCOUNT_KEYS.lastPlan, 'zz-plan');
    localStorage.setItem(ACCOUNT_KEYS.planLocks, '["zz-plan"]');
    fetchMock().mockRejectedValue(new TypeError('Failed to fetch'));
    await useAuth().start();
    expect(localStorage.getItem(ACCOUNT_KEYS.lastPlan)).toBe('zz-plan');
    expect(localStorage.getItem(ACCOUNT_KEYS.planLocks)).toBe('["zz-plan"]');
  });

  it('lets the shell say once that a sign-in cancelled a pending deletion', async () => {
    fetchMock().mockResolvedValue(Response.json(authResult({ accountRestored: true })));
    const auth = useAuth();
    await auth.signIn({ email: 'zz@example.com', password: 'zz-password-1' });
    auth.acknowledgeRestored();
    expect(auth.accountRestored).toBe(false);
  });
});
