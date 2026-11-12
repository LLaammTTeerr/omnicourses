// Which plans the student locked in the editor, so a stray drag or key cannot change them. A guard against
// accidents on this browser only: the API still accepts changes, and missing storage leaves every plan unlocked.
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

export function setLocked(planId: string, locked: boolean): void {
  const ids = read().filter((id) => id !== planId);
  try {
    localStorage.setItem(KEY, JSON.stringify(locked ? [...ids, planId] : ids));
  } catch {
    // Not kept: private mode or storage blocked. The lock still holds until the page reloads.
  }
}
