<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { reportFailure } from '../async-load.js';
import { useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import { useToast } from '../shell/toast.js';
import { deletePlanIfThere, fitPlanName, usePlanActions } from './actions.js';
import { createPlan, duplicatePlan, fetchPlans, type PlanCurriculum, type PlanSummary } from './api.js';
import DeletePlanDialog from './DeletePlanDialog.vue';
import { PLANNER_MESSAGES } from './messages.js';
import PlanNameDialog from './PlanNameDialog.vue';

const props = defineProps<{ id: string; name: string; curriculum: PlanCurriculum; busy?: boolean }>();
const router = useRouter();
const toast = useToast();
const m = useMessages(PLANNER_MESSAGES);

const plans = ref<PlanSummary[]>([]);
const naming = ref(false);
const deleting = ref(false);
const canDelete = computed(() => plans.value.length > 1);
const { busy: actionBusy, dialogError, attempt, attemptOrToast } = usePlanActions(() => naming.value || deleting.value);
const busy = computed(() => Boolean(props.busy) || actionBusy.value);

async function load(): Promise<void> {
  try {
    plans.value = (await fetchPlans()).plans;
  } catch (e) {
    reportFailure('Loading the plans for the tabs', e);
  }
}
watch(() => props.id, load, { immediate: true });

const openPlan = (id: string) => router.push({ name: 'plan', params: { id } });

async function copy(name: string): Promise<void> {
  if (busy.value) return;
  const { id } = props;
  await attemptOrToast('Copying the plan', async () => {
    const made = await duplicatePlan(id, fitPlanName(name));
    toast.show(m.value.copied(made.name));
    await openPlan(made.id);
  });
}
defineExpose({ copy });

function openNaming(): void {
  if (busy.value) return;
  dialogError.value = null;
  naming.value = true;
}
async function create(name: string): Promise<void> {
  if (busy.value) return;
  const { programCode, cohortYear } = props.curriculum;
  await attempt('Creating a plan', async () => {
    const made = await createPlan({ name, programCode, cohortYear });
    naming.value = false;
    toast.show(m.value.created(made.name));
    await openPlan(made.id);
  });
}

function askDelete(): void {
  if (busy.value) return;
  dialogError.value = null;
  deleting.value = true;
}
async function confirmDelete(): Promise<void> {
  if (busy.value) return;
  const { id, name } = props;
  const next = plans.value.find((p) => p.id !== id);
  const done = await attempt('Deleting the plan', () => deletePlanIfThere(id));
  if (!done) return;
  deleting.value = false;
  toast.show(m.value.deleted(name));
  await router.replace(next ? { name: 'plan', params: { id: next.id } } : { name: 'plan-list' });
}
</script>

<template>
  <nav class="plan-tabs" :aria-label="m.plansLabel" data-test="plan-tabs">
    <template v-for="p in plans" :key="p.id">
      <RouterLink v-slot="{ href, navigate }" :to="{ name: 'plan', params: { id: p.id } }" custom>
        <a
          :href="href"
          :aria-current="p.id === id ? 'page' : undefined"
          :aria-disabled="busy && p.id !== id ? 'true' : undefined"
          :class="{ on: p.id === id, disabled: busy && p.id !== id }"
          :title="p.name"
          data-test="plan-tab"
          @click="busy ? $event.preventDefault() : navigate($event)"
        >
          <span class="tab-name">{{ p.name }}</span>
        </a>
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

<style scoped>
.plan-tabs { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.plan-tabs a, .plan-tabs .add, .plan-tabs .del {
  display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; border: 1px solid var(--edge); background: var(--surface); padding: 7px 14px;
  border-radius: 12px; font: inherit; font-weight: 650; font-size: 14px; color: var(--ink); text-decoration: none; cursor: pointer; transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.plan-tabs a { max-width: 260px; }
.plan-tabs .tab-name { overflow: hidden; text-overflow: ellipsis; }
.plan-tabs a:hover:not(.disabled) { border-color: var(--edge-strong); }
.plan-tabs a.on { background: var(--acc-bg); color: var(--acc-ink); box-shadow: var(--acc-shadow, var(--shadow-sm)); border-color: transparent; }
.plan-tabs a.disabled, .plan-tabs button:disabled { opacity: 0.5; cursor: not-allowed; }
.plan-tabs .add { border-style: dashed; background: transparent; color: var(--ink-2); }
.plan-tabs .add:hover:not(:disabled) { color: var(--ink); border-color: var(--ink-3); }
.plan-tabs .del { padding: 7px 9px; margin-left: -4px; border-color: transparent; background: transparent; color: var(--ink-3); }
.plan-tabs .del:hover:not(:disabled) { color: var(--bad); background: color-mix(in oklab, var(--bad) 10%, var(--surface)); }
.plan-tabs a:focus-visible, .plan-tabs button:focus-visible { outline: 2px solid var(--info); outline-offset: 2px; }
</style>
