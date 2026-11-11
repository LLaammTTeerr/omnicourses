<script setup lang="ts">
import { ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { statusOf } from '../api.js';
import { useAuth } from '../auth/store.js';
import { useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import { useToast } from '../shell/toast.js';
import { duplicatePlan, fetchPlans, type PlanSummary } from './api.js';
import { PLANNER_MESSAGES } from './messages.js';

// The student's plans as tabs above the editor (UC-05 A6), to switch between them and copy the one open. Renaming
// and deleting stay on the plans list, behind its confirmation. A failed load shows no tabs: the editor still works,
// and so does a copy, which needs only the plan open (`id`, `name`), not the list.
const props = defineProps<{ id: string; name: string }>();
const auth = useAuth();
const router = useRouter();
const toast = useToast();
const m = useMessages(PLANNER_MESSAGES);

const plans = ref<PlanSummary[]>([]);
const busy = ref(false);

async function load(): Promise<void> {
  try {
    plans.value = (await auth.authed(fetchPlans)).plans;
  } catch (e) {
    if (statusOf(e) !== 401) console.error('Loading the plans for the tabs failed:', e);
  }
}
watch(() => props.id, load, { immediate: true });

/** A copy of the plan open, opened at once; `name` defaults to the list's "Copy of …". */
async function copy(name?: string): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  const { id } = props;
  try {
    const made = await auth.authed((token) => duplicatePlan(token, id, name ?? m.value.copyName(props.name)));
    toast.show(m.value.copied(made.name));
    await router.push({ name: 'plan', params: { id: made.id } });
  } catch (e) {
    if (statusOf(e) !== 401) {
      console.error('Copying the plan failed:', e);
      toast.show(m.value.actionFailed);
    }
  } finally {
    busy.value = false;
  }
}
defineExpose({ copy });
</script>

<template>
  <nav v-if="plans.length" class="plan-tabs" :aria-label="m.plansLabel" data-test="plan-tabs">
    <RouterLink
      v-for="p in plans"
      :key="p.id"
      :to="{ name: 'plan', params: { id: p.id } }"
      :aria-current="p.id === id ? 'page' : undefined"
      :class="{ on: p.id === id }"
      data-test="plan-tab"
    >
      {{ p.name }}
    </RouterLink>
    <button class="add" type="button" :disabled="busy" data-test="copy-plan" @click="copy()"><Icon name="plus" size="sm" />{{ m.copyTab }}</button>
  </nav>
</template>

<style>
.plan-tabs { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px; border-radius: 12px; background: var(--surface-2); border: 1px solid var(--edge); width: fit-content; max-width: 100%; }
.plan-tabs a, .plan-tabs .add {
  display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 14px; border-radius: 9px; border: 0; background: none;
  font: inherit; font-size: 13.5px; font-weight: 600; color: var(--ink-2); text-decoration: none; cursor: pointer;
}
.plan-tabs a:hover, .plan-tabs .add:hover { color: var(--ink); background: var(--surface); }
.plan-tabs a.on { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-sm); }
.plan-tabs .add { color: var(--ink-3); }
.plan-tabs a:focus-visible, .plan-tabs .add:focus-visible { outline: 2px solid var(--info); outline-offset: 1px; }
</style>
