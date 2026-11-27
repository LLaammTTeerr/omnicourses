import { defineStore } from 'pinia';
import { computed, ref, shallowRef, type ComputedRef } from 'vue';
import { request, send, statusOf, type RequestOptions } from '../api.js';
import { forgetLastPlan } from '../plans/last-plan.js';
import { forgetLocks } from '../plans/lock.js';
import * as api from './api.js';
import type { AuthResult, SignInBody, SignUpBody, User } from './api.js';

export const SESSION_STORAGE_KEY = 'omnicourse.session';

function readToken(): string | null {
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

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
  const accountRestored = ref(false);
  const signedIn = computed(() => user.value !== null);
  let started: Promise<void> | null = null;

  function adopt(result: AuthResult): void {
    token.value = result.token;
    user.value = result.user;
    writeToken(result.token);
  }

  function clear(): void {
    token.value = null;
    user.value = null;
    writeToken(null);
    forgetAccountData();
  }

  function start(): Promise<void> {
    if (signedIn.value) return Promise.resolve();
    started ??= (async () => {
      const saved = readToken();
      if (!saved) return;
      try {
        adopt(await api.refresh(saved));
      } catch (e) {
        if (statusOf(e) === 401) {
          writeToken(null);
          forgetAccountData();
        } else {
          started = null;
          console.error('Restoring the session failed:', e);
        }
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

  function setUser(next: User): void {
    user.value = next;
  }

  async function authed<T>(call: (token: string) => Promise<T>): Promise<T> {
    if (!token.value) throw new Error('Not signed in');
    try {
      return await call(token.value);
    } catch (e) {
      if (statusOf(e) === 401) clear();
      throw e;
    }
  }

  return { token, user, signedIn, accountRestored, start, signIn, signUp, signOut, clear, setUser, authed };
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

interface AccountCache<T> {
  value: ComputedRef<T | null>;
  load(options?: { fresh?: boolean }): Promise<T>;
  isLatest(load: Promise<T>): boolean;
  keep(userId: string, value: T): T;
  seed(userId: string, value: T): void;
  forget(): void;
}

function sharedLoad<T>(fetchValue: () => Promise<T>, keep: (userId: string, value: T) => T) {
  let pending: { userId: string; load: Promise<T> } | null = null;
  let latest: Promise<T> | null = null;

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

  return {
    start,
    pendingFor: (userId: string) => (pending?.userId === userId ? pending.load : null),
    isLatest: (load: Promise<T>) => load === latest,
    drop: () => void ((pending = null), (latest = null)),
  };
}

export function useAccountCache<T>(fetchValue: () => Promise<T>): AccountCache<T> {
  const auth = useAuth();
  const owned = shallowRef<Owned<T> | null>(null);
  const value = computed(() => (owned.value && owned.value.userId === auth.user?.id ? owned.value.value : null));

  function keep(userId: string, next: T): T {
    if (auth.user?.id === userId) owned.value = { userId, value: next };
    return next;
  }

  const loads = sharedLoad(fetchValue, keep);

  function load({ fresh = false }: { fresh?: boolean } = {}): Promise<T> {
    const userId = auth.user?.id;
    if (!userId) return Promise.reject(new Error('Not signed in'));
    if (!fresh && value.value !== null) return Promise.resolve(value.value);
    return (fresh ? null : loads.pendingFor(userId)) ?? loads.start(userId);
  }

  function forget(): void {
    owned.value = null;
    loads.drop();
  }

  return {
    value,
    load,
    isLatest: loads.isLatest,
    keep,
    seed: (userId, next) => void (owned.value = { userId, value: next }),
    forget,
  };
}
