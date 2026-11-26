// The plan the student had open last, so the planner's front door (PlannerEntry.vue) opens it again. A convenience
// on this browser only; missing storage just opens the first plan.
const KEY = 'oc-last-plan';

export function readLastPlan(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Forgets it, when the student leaves this browser (auth/store.ts): it is this account's, not the next one's. */
export function forgetLastPlan(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: nothing was kept.
  }
}

export function rememberLastPlan(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Not kept: private mode or storage blocked.
  }
}
