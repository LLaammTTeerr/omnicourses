import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_KEYS, forgetAccountData, readStored, writeStored } from './storage.js';

describe('storage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('keeps a value, and forgets it when written null', () => {
    writeStored('omnicourse.test', 'kept');
    expect(readStored('omnicourse.test')).toBe('kept');
    writeStored('omnicourse.test', null);
    expect(readStored('omnicourse.test')).toBeNull();
  });

  it('keeps nothing and finds nothing when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    expect(() => writeStored('omnicourse.test', 'kept')).not.toThrow();
    expect(readStored('omnicourse.test')).toBeNull();
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
