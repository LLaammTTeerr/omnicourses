import { defineStore } from 'pinia';
import { computed, ref, shallowRef, type ComputedRef } from 'vue';
import { request, send, statusOf, type RequestOptions } from '../api.js';
import { forgetLastPlan } from '../plans/last-plan.js';
import { forgetLocks } from '../plans/lock.js';
import * as api from './api.js';
import type { AuthResult, SignInBody, SignUpBody, User } from './api.js';

// The signed-in student and their session token (ADR 0002, issue #13). The token lives in memory and in
// sessionStorage, never localStorage: it survives a reload but not closing the tab, and stays out of other tabs.

// Kept in students' browsers: a new key signs everyone out once.
export const SESSION_STORAGE_KEY = 'omnicourse.session';

function readToken(): string | null {
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** What this browser keeps of the account beside the token, forgotten when the session ends here. */
function forgetAccountData(): void {
  forgetLastPlan();
  forgetLocks();
}

function writeToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(SESSION_STORAGE_KEY, token);
    else sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {}
}

export const useAuth = defineStore('auth', () => {
  const token = ref<string | null>(null);
  const user = shallowRef<User | null>(null);
  /** Set by a sign-in that cancelled a pending deletion, until the shell has told the student. */
  const accountRestored = ref(false);
  const signedIn = computed(() => user.value !== null);
  let started: Promise<void> | null = null;

  function adopt(result: AuthResult): void {
    token.value = result.token;
    user.value = result.user;
    writeToken(result.token);
  }

  /** Forgets the session on this device, and the account's plan choices kept here, without calling the API. */
  function clear(): void {
    token.value = null;
    user.value = null;
    writeToken(null);
    forgetAccountData();
  }

  /**
   * Once per page load: a saved token is exchanged for a fresh one, so an active student never meets the 7-day
   * expiry. A 401 means the session is over. Any other failure keeps the saved token for the next load, since the
   * session may still be alive, but leaves the student signed out for now.
   */
  function start(): Promise<void> {
    started ??= (async () => {
      const saved = readToken();
      if (!saved) return;
      try {
        adopt(await api.refresh(saved));
      } catch (e) {
        if (statusOf(e) === 401) {
          writeToken(null);
          forgetAccountData();
        } else console.error('Restoring the session failed:', e);
      }
    })();
    return started;
  }

  async function signIn(body: SignInBody): Promise<void> {
    const result = await api.signIn(body);
    adopt(result);
    accountRestored.value = result.accountRestored;
  }

  async function signUp(body: SignUpBody): Promise<void> {
    adopt(await api.signUp(body));
  }

  /** Revokes this session on the server, then forgets it here even if the server could not be reached. */
  async function signOut(): Promise<void> {
    const current = token.value;
    clear();
    if (!current) return;
    try {
      await api.signOut(current);
    } catch (e) {
      console.error('Signing out on the server failed:', e);
    }
  }

  /**
   * Runs an API call with the token. A 401 means the session ended elsewhere (revoked, expired, account
   * deleted): the student is signed out here too, and App.vue sends them to sign in.
   */
  async function authed<T>(call: (token: string) => Promise<T>): Promise<T> {
    if (!token.value) throw new Error('Not signed in');
    try {
      return await call(token.value);
    } catch (e) {
      if (statusOf(e) === 401) clear();
      throw e;
    }
  }

  return { token, user, signedIn, accountRestored, start, signIn, signUp, signOut, clear, authed };
});

type UserRequestOptions = Omit<RequestOptions, 'token'>;

export function requestAsUser<T>(method: string, path: string, options: UserRequestOptions = {}): Promise<T> {
  return useAuth().authed((token) => request<T>(method, path, { ...options, token }));
}

export function sendAsUser(method: string, path: string, options: UserRequestOptions = {}): Promise<Response> {
  return useAuth().authed((token) => send(method, path, { ...options, token }));
}

interface Owned<T> {
  userId: string;
  value: T;
}

export interface AccountCache<T> {
  value: ComputedRef<T | null>;
  load(options?: { fresh?: boolean }): Promise<T>;
  isLatest(load: Promise<T>): boolean;
  keep(userId: string, value: T): T;
  seed(userId: string, value: T): void;
  forget(): void;
}

export function useAccountCache<T>(fetchValue: () => Promise<T>): AccountCache<T> {
  const auth = useAuth();
  const owned = shallowRef<Owned<T> | null>(null);
  let pending: { userId: string; load: Promise<T> } | null = null;
  let latest: Promise<T> | null = null;
  const value = computed(() => (owned.value && owned.value.userId === auth.user?.id ? owned.value.value : null));

  function keep(userId: string, next: T): T {
    if (auth.user?.id === userId) owned.value = { userId, value: next };
    return next;
  }

  function start(userId: string): Promise<T> {
    const load: Promise<T> = fetchValue().then((loaded) => (latest === load ? keep(userId, loaded) : loaded));
    latest = load;
    pending = { userId, load };
    const settle = () => {
      if (pending?.load === load) pending = null;
    };
    load.then(settle, settle);
    return load;
  }

  function load({ fresh = false }: { fresh?: boolean } = {}): Promise<T> {
    const userId = auth.user?.id;
    if (!userId) return Promise.reject(new Error('Not signed in'));
    if (!fresh && value.value !== null) return Promise.resolve(value.value);
    if (fresh || pending?.userId !== userId) return start(userId);
    return pending.load;
  }

  function forget(): void {
    owned.value = null;
    pending = null;
    latest = null;
  }

  return {
    value,
    load,
    isLatest: (load) => load === latest,
    keep,
    seed: (userId, next) => void (owned.value = { userId, value: next }),
    forget,
  };
}
