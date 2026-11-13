import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_KEYS, forgetAccountData, readStored, writeStored } from './storage.js';

describe('storage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('keeps a value, and forgets it when written null', () => {
    writeStored('omnicourse.test', 'kept');
    expect(readStored('omnicourse.test')).toBe('kept');
    writeStored('omnicourse.test', null);
    expect(readStored('omnicourse.test')).toBeNull();
  });

  it('keeps a value for this tab only in sessionStorage', () => {
    writeStored('omnicourse.test', 'kept', 'session');
    expect(sessionStorage.getItem('omnicourse.test')).toBe('kept');
    expect(readStored('omnicourse.test')).toBeNull();
    expect(readStored('omnicourse.test', 'session')).toBe('kept');
    writeStored('omnicourse.test', null, 'session');
    expect(sessionStorage.getItem('omnicourse.test')).toBeNull();
  });

  it('keeps nothing and finds nothing when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    for (const area of ['local', 'session'] as const) {
      expect(() => writeStored('omnicourse.test', 'kept', area)).not.toThrow();
      expect(readStored('omnicourse.test', area)).toBeNull();
    }
  });

  it('forgets what one account kept, and only that', () => {
    localStorage.setItem(ACCOUNT_KEYS.lastPlan, 'zz-plan');
    localStorage.setItem(ACCOUNT_KEYS.planLocks, '["zz-plan"]');
    localStorage.setItem('omnicourse.lang', 'en');
    forgetAccountData();
    expect(localStorage.getItem(ACCOUNT_KEYS.lastPlan)).toBeNull();
    expect(localStorage.getItem(ACCOUNT_KEYS.planLocks)).toBeNull();
    expect(localStorage.getItem('omnicourse.lang')).toBe('en');
  });
});
