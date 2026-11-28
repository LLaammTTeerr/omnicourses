import { ACCOUNT_STORAGE_KEYS } from '../account-storage.js';

const KEY = ACCOUNT_STORAGE_KEYS.lastPlan;

export function readLastPlan(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function rememberLastPlan(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {}
}
