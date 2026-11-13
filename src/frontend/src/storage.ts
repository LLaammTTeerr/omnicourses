// The browser's localStorage, guarded: storage can be blocked (private mode, site data off), and then nothing is
// kept and every read finds nothing. Each key is kept in students' browsers, so renaming one forgets what it held.

/** What one account keeps on this browser. `auth.clear()` forgets them, so the next student on it never sees them. */
export const ACCOUNT_KEYS = {
  /** The plan open last (plans/last-plan.ts). */
  lastPlan: 'oc-last-plan',
  /** The plans locked in the editor (plans/lock.ts). */
  planLocks: 'oc-plan-locks',
} as const;

export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Keeps `value` under `key`, or forgets the key when `value` is null. Blocked storage keeps nothing. */
export function writeStored(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Not kept: private mode or storage blocked.
  }
}

/** Forgets everything one account kept on this browser. */
export function forgetAccountData(): void {
  for (const key of Object.values(ACCOUNT_KEYS)) writeStored(key, null);
}
