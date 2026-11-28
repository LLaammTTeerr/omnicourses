export const ACCOUNT_STORAGE_KEYS = {
  lastPlan: 'oc-last-plan',
  planLocks: 'oc-plan-locks',
} as const;

export function forgetAccountStorage(): void {
  for (const key of Object.values(ACCOUNT_STORAGE_KEYS)) {
    try {
      localStorage.removeItem(key);
    } catch {}
  }
}
