import { ACCOUNT_KEYS, readStored, writeStored } from '../storage.js';

// Which plans the student locked in the editor, so a stray drag or key cannot change them. A guard against
// accidents on this browser only: the API still accepts changes, and missing storage leaves every plan unlocked.
// The locks belong to the account: signing out forgets them (storage.ts).

function read(): string[] {
  try {
    const value: unknown = JSON.parse(readStored(ACCOUNT_KEYS.planLocks) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export const isLocked = (planId: string): boolean => read().includes(planId);

/** Not kept when storage is blocked: the lock still holds until the page reloads. */
export function setLocked(planId: string, locked: boolean): void {
  const ids = read().filter((id) => id !== planId);
  writeStored(ACCOUNT_KEYS.planLocks, JSON.stringify(locked ? [...ids, planId] : ids));
}
