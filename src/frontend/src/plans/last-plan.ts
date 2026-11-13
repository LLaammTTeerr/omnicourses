import { ACCOUNT_KEYS, readStored, writeStored } from '../storage.js';

// The plan the student had open last, so the planner's front door (PlannerEntry.vue) opens it again. A convenience
// on this browser only; missing storage just opens the first plan. Signing out forgets it (storage.ts).

export const readLastPlan = (): string | null => readStored(ACCOUNT_KEYS.lastPlan);

export const rememberLastPlan = (id: string): void => writeStored(ACCOUNT_KEYS.lastPlan, id);
