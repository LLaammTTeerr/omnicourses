const KEY = 'oc-last-plan';

export function readLastPlan(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function forgetLastPlan(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function rememberLastPlan(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {}
}
