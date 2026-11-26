const KEY = 'oc-plan-locks';

function read(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export const isLocked = (planId: string): boolean => read().includes(planId);

export function forgetLocks(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function setLocked(planId: string, locked: boolean): void {
  const ids = read().filter((id) => id !== planId);
  try {
    localStorage.setItem(KEY, JSON.stringify(locked ? [...ids, planId] : ids));
  } catch {}
}
