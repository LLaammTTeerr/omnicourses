import { afterEach, describe, expect, it } from 'vitest';
import { ACCOUNT_STORAGE_KEYS, forgetAccountStorage } from './account-storage.js';

describe('account storage', () => {
  afterEach(() => localStorage.clear());

  it('removes every account key and leaves the display choices of the browser', () => {
    for (const key of Object.values(ACCOUNT_STORAGE_KEYS)) localStorage.setItem(key, 'zz');
    localStorage.setItem('omnicourse.theme', 'dark');
    forgetAccountStorage();
    expect(Object.values(ACCOUNT_STORAGE_KEYS).map((key) => localStorage.getItem(key))).toEqual([null, null]);
    expect(localStorage.getItem('omnicourse.theme')).toBe('dark');
  });

  it('keeps the key names saved in students browsers', () => {
    expect(ACCOUNT_STORAGE_KEYS).toEqual({ lastPlan: 'oc-last-plan', planLocks: 'oc-plan-locks' });
  });
});
