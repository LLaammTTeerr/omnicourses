import { ref, type Ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { reportFailure, statusOf } from '../api.js';
import { useAuth } from '../auth/store.js';
import { useMessages } from '../locale.js';
import { useToast } from '../shell/toast.js';
import { createPlan, deletePlan, duplicatePlan, fetchPlans, PLAN_NAME_MAX_LENGTH, renamePlan, type CreatePlanBody, type Plan, type PlanListItem } from './api.js';
import { PLANNER_MESSAGES } from './messages.js';

// What the student does with whole plans (UC-05 A6): list, create, rename, copy and delete. The plans list, the
// editor's tabs and its What-if button share it, so a fix to one reaches all. Each screen decides what follows an
// action (open the plan, update its list); this module owns how the action runs and how it fails.

/** A name cut to the API's limit between code points, so an emoji is never split. */
export const cutPlanName = (full: string): string => Array.from(full).slice(0, PLAN_NAME_MAX_LENGTH).join('');

/** The student's plans, newest state from the API. */
export function useLoadPlans(): () => Promise<PlanListItem[]> {
  const auth = useAuth();
  return async () => (await auth.authed(fetchPlans)).plans;
}

export interface PlanActions {
  /** One action at a time: the buttons that start one are disabled meanwhile. */
  busy: Ref<boolean>;
  /** What the last action's dialog says went wrong, or null. */
  dialogError: Ref<string | null>;
  create(body: CreatePlanBody, then: (made: Plan) => Promise<void> | void): Promise<boolean>;
  rename(id: string, name: string, then: (renamed: Plan) => Promise<void> | void): Promise<boolean>;
  copy(id: string, name: string, then: (copied: Plan) => Promise<void> | void): Promise<boolean>;
  remove(id: string, then?: () => Promise<void> | void): Promise<boolean>;
  /** Keeps the student on the page while `dialogOpen` and an action is busy (see below). */
  guardLeave(dialogOpen: () => boolean): void;
}

/** The plan actions of one screen; the editor hands its own to its tabs, so What-if and the tabs share `busy`. */
export function usePlanActions(): PlanActions {
  const auth = useAuth();
  const toast = useToast();
  const m = useMessages(PLANNER_MESSAGES);
  const busy = ref(false);
  const dialogError = ref<string | null>(null);

  /** Runs an action; a 401 has already signed the student out (App.vue), any other failure is said in `dialogError`. */
  async function attempt(what: string, action: () => Promise<void>): Promise<boolean> {
    busy.value = true;
    dialogError.value = null;
    try {
      await action();
      return true;
    } catch (e) {
      if (reportFailure(what, e)) dialogError.value = m.value.actionFailed;
      return false;
    } finally {
      busy.value = false;
    }
  }

  return {
    busy,
    dialogError,
    create: (body, then) =>
      attempt('Creating a plan', async () => {
        await then(await auth.authed((token) => createPlan(token, body)));
      }),
    rename: (id, name, then) =>
      attempt('Renaming the plan', async () => {
        await then(await auth.authed((token) => renamePlan(token, id, name)));
      }),
    /** A copy has no dialog: its failure is said in a toast. The name is cut to the API's limit. */
    async copy(id, name, then) {
      if (busy.value) return false;
      const done = await attempt('Copying the plan', async () => {
        await then(await auth.authed((token) => duplicatePlan(token, id, cutPlanName(name))));
      });
      if (!done && dialogError.value) toast.show(dialogError.value);
      return done;
    },
    remove: (id, then) =>
      attempt('Deleting the plan', async () => {
        try {
          await auth.authed((token) => deletePlan(token, id));
        } catch (e) {
          // Already gone: an earlier deletion that timed out may have gone through on the server.
          if (statusOf(e) !== 404) throw e;
        }
        await then?.();
      }),
    // A busy dialog refuses Escape with `closedby="none"`, which leaves the Android back gesture to the browser:
    // history back. Stay until its request answers, so the result is said. A 401 has signed the student out, who may
    // leave; a create closes its dialog before opening the new plan.
    guardLeave(dialogOpen) {
      onBeforeRouteLeave(() => !(busy.value && dialogOpen()) || !auth.signedIn);
    },
  };
}
