import { ACCOUNT_STORAGE_KEYS } from '../account-storage.js';

const KEY = ACCOUNT_STORAGE_KEYS.planLocks;

function read(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export const isLocked = (planId: string): boolean => read().includes(planId);

export function setLocked(planId: string, locked: boolean): void {
  const ids = read().filter((id) => id !== planId);
  try {
    localStorage.setItem(KEY, JSON.stringify(locked ? [...ids, planId] : ids));
  } catch {}
}
