import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { statusOf } from '../api.js';
import { forgetAccountData } from '../storage.js';
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

  /**
   * Forgets the session on this device, without calling the API, and what the account kept in this browser (the
   * plan open last, the locked plans), so the next student on it sees none of it. Runs on sign-out, on a 401 and
   * after the account is deleted.
   */
  function clear(): void {
    token.value = null;
    user.value = null;
    writeToken(null);
    forgetAccountData();
  }

  /** The shell has told the student that signing in cancelled their pending deletion. */
  function acknowledgeRestored(): void {
    accountRestored.value = false;
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
        if (statusOf(e) === 401) writeToken(null);
        else console.error('Restoring the session failed:', e);
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

  return { token, user, signedIn, accountRestored, start, signIn, signUp, signOut, clear, acknowledgeRestored, authed };
});
