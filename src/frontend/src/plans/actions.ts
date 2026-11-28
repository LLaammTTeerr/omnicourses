import { onBeforeRouteLeave } from 'vue-router';
import { statusOf } from '../api.js';
import { useAttempt } from '../async-load.js';
import { useAuth } from '../auth/store.js';
import { useMessages } from '../locale.js';
import { useToast } from '../shell/toast.js';
import { deletePlan } from './api.js';
import { PLANNER_MESSAGES } from './messages.js';

export const PLAN_NAME_MAX_CODE_POINTS = 100;

export const fitPlanName = (name: string): string => Array.from(name).slice(0, PLAN_NAME_MAX_CODE_POINTS).join('');

export async function deletePlanIfThere(id: string): Promise<void> {
  try {
    await deletePlan(id);
  } catch (e) {
    if (statusOf(e) !== 404) throw e;
  }
}

export function usePlanActions(dialogOpen: () => boolean) {
  const auth = useAuth();
  const toast = useToast();
  const m = useMessages(PLANNER_MESSAGES);
  const { busy, error: dialogError, run: attempt } = useAttempt(() => m.value.actionFailed);

  async function attemptOrToast(what: string, action: () => Promise<void>): Promise<void> {
    const done = await attempt(what, action);
    if (!done && dialogError.value) toast.show(dialogError.value);
  }

  onBeforeRouteLeave(() => !(busy.value && dialogOpen()) || !auth.signedIn);

  return { busy, dialogError, attempt, attemptOrToast };
}
