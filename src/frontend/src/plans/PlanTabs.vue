<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { onBeforeRouteLeave, RouterLink, useRouter } from 'vue-router';
import { statusOf } from '../api.js';
import { useAuth } from '../auth/store.js';
import { useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import { useToast } from '../shell/toast.js';
import { createPlan, deletePlan, duplicatePlan, fetchPlans, type PlanCurriculum, type PlanSummary } from './api.js';
import DeletePlanDialog from './DeletePlanDialog.vue';
import { PLANNER_MESSAGES } from './messages.js';
import PlanNameDialog from './PlanNameDialog.vue';

// The student's plans as tabs above the editor (UC-05 A6), as in the prototype: switch between them, delete the one
// open (with the trash button beside its tab, behind a confirmation; the last plan stays), and make a new one with a
// name. A new plan uses the curriculum of the one open. A failed load shows no tabs: the editor still works.
const props = defineProps<{ id: string; name: string; curriculum: PlanCurriculum }>();
const auth = useAuth();
const router = useRouter();
const toast = useToast();
const m = useMessages(PLANNER_MESSAGES);

const plans = ref<PlanSummary[]>([]);
const busy = ref(false);
const naming = ref(false);
const deleting = ref(false);
const dialogError = ref<string | null>(null);
const canDelete = computed(() => plans.value.length > 1);

async function load(): Promise<void> {
  try {
    plans.value = (await auth.authed(fetchPlans)).plans;
  } catch (e) {
    if (statusOf(e) !== 401) console.error('Loading the plans for the tabs failed:', e);
  }
}
watch(() => props.id, load, { immediate: true });

/** Runs an action; a 401 has already signed the student out (App.vue), any other failure is said in `dialogError`. */
async function attempt(what: string, action: () => Promise<void>): Promise<boolean> {
  busy.value = true;
  dialogError.value = null;
  try {
    await action();
    return true;
  } catch (e) {
    if (statusOf(e) !== 401) {
      console.error(`${what} failed:`, e);
      dialogError.value = m.value.actionFailed;
    }
    return false;
  } finally {
    busy.value = false;
  }
}

/** A copy of the plan open, opened at once (What-if). The name is cut to the API's 100 characters (code points). */
async function copy(full: string): Promise<void> {
  if (busy.value) return;
  const name = Array.from(full).slice(0, 100).join('');
  const { id } = props;
  const done = await attempt('Copying the plan', async () => {
    const made = await auth.authed((token) => duplicatePlan(token, id, name));
    toast.show(m.value.copied(made.name));
    await router.push({ name: 'plan', params: { id: made.id } });
  });
  if (!done && dialogError.value) toast.show(dialogError.value);
}
defineExpose({ copy });

function openNaming(): void {
  dialogError.value = null;
  naming.value = true;
}
async function create(name: string): Promise<void> {
  const { programCode, cohortYear } = props.curriculum;
  await attempt('Creating a plan', async () => {
    const made = await auth.authed((token) => createPlan(token, { name, programCode, cohortYear }));
    naming.value = false;
    toast.show(m.value.created(made.name));
    await router.push({ name: 'plan', params: { id: made.id } });
  });
}

function askDelete(): void {
  dialogError.value = null;
  deleting.value = true;
}
async function confirmDelete(): Promise<void> {
  const { id, name } = props;
  const next = plans.value.find((p) => p.id !== id);
  const done = await attempt('Deleting the plan', async () => {
    try {
      await auth.authed((token) => deletePlan(token, id));
    } catch (e) {
      // Already gone: an earlier deletion that timed out may have gone through on the server.
      if (statusOf(e) !== 404) throw e;
    }
  });
  if (!done) return;
  deleting.value = false;
  toast.show(m.value.deleted(name));
  await router.replace(next ? { name: 'plan', params: { id: next.id } } : { name: 'plan-list' });
}

// A busy dialog refuses Escape; the back gesture would leave mid-request, so stay until it answers.
onBeforeRouteLeave(() => !(busy.value && (naming.value || deleting.value)) || !auth.signedIn);
</script>

<template>
  <nav class="plan-tabs" :aria-label="m.plansLabel" data-test="plan-tabs">
    <template v-for="p in plans" :key="p.id">
      <RouterLink :to="{ name: 'plan', params: { id: p.id } }" :aria-current="p.id === id ? 'page' : undefined" :class="{ on: p.id === id }" :title="p.name" data-test="plan-tab">
        <span class="tab-name">{{ p.name }}</span>
      </RouterLink>
      <button
        v-if="p.id === id && canDelete"
        class="del"
        type="button"
        :disabled="busy"
        :aria-label="m.deletePlan(p.name)"
        :title="m.deletePlan(p.name)"
        data-test="delete-plan"
        @click="askDelete"
      >
        <Icon name="trash" size="sm" />
      </button>
    </template>
    <button class="add" type="button" :disabled="busy" data-test="new-plan" @click="openNaming"><Icon name="plus" size="sm" />{{ m.newPlan }}</button>
  </nav>

  <PlanNameDialog
    :open="naming"
    :title="m.createTitle"
    :body="m.createBody(`${curriculum.programCode} ${curriculum.cohortYear}`)"
    :submit="m.create"
    initial=""
    :busy="busy"
    :error="dialogError"
    @close="naming = false"
    @save="create"
  />
  <DeletePlanDialog :open="deleting" :name="name" :busy="busy" :error="dialogError" @close="deleting = false" @confirm="confirmDelete" />
</template>

<style>
.plan-tabs { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.plan-tabs a, .plan-tabs .add, .plan-tabs .del {
  display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; border: 1px solid var(--edge); background: var(--surface); padding: 7px 14px;
  border-radius: 12px; font: inherit; font-weight: 650; font-size: 14px; color: var(--ink); text-decoration: none; cursor: pointer; transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.plan-tabs a { max-width: 260px; }
.plan-tabs .tab-name { overflow: hidden; text-overflow: ellipsis; }
.plan-tabs a:hover { border-color: var(--edge-strong); }
.plan-tabs a.on { background: var(--acc-bg); color: var(--acc-ink); box-shadow: var(--acc-shadow); border-color: transparent; }
.plan-tabs .add { border-style: dashed; background: transparent; color: var(--ink-2); }
.plan-tabs .add:hover { color: var(--ink); border-color: var(--ink-3); }
.plan-tabs .del { padding: 7px 9px; margin-left: -4px; border-color: transparent; background: transparent; color: var(--ink-3); }
.plan-tabs .del:hover:not(:disabled) { color: var(--bad); background: color-mix(in oklab, var(--bad) 10%, var(--surface)); }
.plan-tabs a:focus-visible, .plan-tabs button:focus-visible { outline: 2px solid var(--info); outline-offset: 2px; }
</style>
