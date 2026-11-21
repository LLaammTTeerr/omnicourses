<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useAsyncLoad } from '../async-load.js';
import LoadState from '../components/LoadState.vue';
import { formatDateTime, useLocale, useMessages } from '../locale.js';
import { COMMON_MESSAGES } from '../messages.js';
import { termName } from '../terms.js';
import { useOnboarding } from '../onboarding/store.js';
import { usePageTitle } from '../page-title.js';
import Icon from '../shell/Icon.vue';
import { useToast } from '../shell/toast.js';
import type { PlanListItem, PlanSummary } from './api.js';
import DeletePlanDialog from './DeletePlanDialog.vue';
import { PLANNER_MESSAGES } from './messages.js';
import { useLoadPlans, usePlanActions } from './plan-actions.js';
import PlanNameDialog from './PlanNameDialog.vue';

// F5 (UC-05 A6): the student's plans, to open, create, rename, copy and delete. A plan keeps the curriculum it was
// created with (ADR 0014); a new one uses the student's program and cohort from onboarding.
const onboarding = useOnboarding();
const locale = useLocale();
const toast = useToast();
const router = useRouter();
const m = useMessages(PLANNER_MESSAGES);
const common = useMessages(COMMON_MESSAGES);

const plans = ref<PlanListItem[]>([]);
const loadPlans = useLoadPlans();
const { status, reload } = useAsyncLoad('the plans', async () => {
  plans.value = await loadPlans();
});

// The router guard loads the onboarding answers but opens the page when that fails, so the list loads them too:
// "pick a program in Settings" is said only once they are known to have none.
const answers = useAsyncLoad('the onboarding answers', () => onboarding.load());
const program = computed(() => {
  const answers = onboarding.answers;
  return answers?.program && answers.cohort ? { code: answers.program, cohort: answers.cohort } : null;
});

/** Name dialog: create a plan, or rename `plan`. */
const naming = shallowRef<{ plan: PlanSummary | null } | null>(null);
const actions = usePlanActions();
const { busy, dialogError } = actions;
const deleting = shallowRef<PlanSummary | null>(null);

function openNaming(plan: PlanSummary | null): void {
  dialogError.value = null;
  naming.value = { plan };
}

async function saveName(name: string): Promise<void> {
  const target = naming.value?.plan ?? null;
  if (target) {
    const done = await actions.rename(target.id, name, (renamed) => {
      plans.value = plans.value.map((plan) => (plan.id === renamed.id ? { ...plan, ...renamed } : plan));
      toast.show(m.value.renamed(renamed.name));
    });
    if (done) naming.value = null;
    return;
  }
  if (!program.value) return;
  const { code, cohort } = program.value;
  await actions.create({ name, programCode: code, cohortYear: cohort }, async (created) => {
    toast.show(m.value.created(created.name));
    naming.value = null;
    await router.push({ name: 'plan', params: { id: created.id } });
  });
}

async function copy(plan: PlanSummary): Promise<void> {
  await actions.copy(plan.id, m.value.copyName(plan.name), (copied) => {
    const source = plans.value.find((p) => p.id === plan.id);
    plans.value = [...plans.value, { ...copied, preview: source!.preview }];
    toast.show(m.value.copied(copied.name));
  });
}

function askDelete(plan: PlanSummary): void {
  dialogError.value = null;
  deleting.value = plan;
}

async function confirmDelete(): Promise<void> {
  const plan = deleting.value;
  if (!plan) return;
  const done = await actions.remove(plan.id, () => {
    plans.value = plans.value.filter((p) => p.id !== plan.id);
    toast.show(m.value.deleted(plan.name));
  });
  if (done) deleting.value = null;
}

actions.guardLeave(() => naming.value !== null || deleting.value !== null);

/** The plan at a glance: the terms it spans and what it holds. */
function previewOf(plan: PlanListItem): { span: string | null; counts: string } {
  const p = plan.preview;
  if (!p.firstTerm || !p.lastTerm) return { span: null, counts: m.value.previewEmpty };
  const lang = locale.lang;
  return { span: m.value.previewSpan(termName(p.firstTerm, lang), termName(p.lastTerm, lang)), counts: m.value.previewCounts(p.termCount, p.courseCount, p.slotCount) };
}

/** A click anywhere on a card opens the plan, except on its buttons. */
function openCard(event: MouseEvent, plan: PlanSummary): void {
  if ((event.target as Element).closest('button, a')) return;
  void router.push({ name: 'plan', params: { id: plan.id } });
}

usePageTitle(() => m.value.title);
</script>

<template>
  <div class="page plans-page">
    <header class="page-head">
      <div>
        <h1>{{ m.title }}</h1>
        <p>{{ m.listLead }}</p>
      </div>
      <div class="head-actions">
        <button class="btn primary" type="button" :disabled="!program || status !== 'loaded' || busy" data-test="new-plan" @click="openNaming(null)">
          <Icon name="plus" size="sm" />{{ m.newPlan }}
        </button>
      </div>
    </header>

    <LoadState v-if="answers.status.value === 'failed'" status="failed" tone="warn" :failed="m.programFailed" data-test="program-failed" @retry="answers.reload" />
    <p v-else-if="answers.status.value === 'loaded' && !program" class="callout warn" data-test="no-program">
      <Icon name="info" /><span>{{ m.noProgram }} <RouterLink class="link" :to="{ name: 'settings' }">{{ m.openSettings }}</RouterLink></span>
    </p>

    <LoadState v-if="status !== 'loaded'" :status="status" :loading="common.loading" :failed="m.loadFailed" @retry="reload" />
    <div v-else-if="plans.length === 0" class="card empty" role="status" data-test="empty">
      <b>{{ m.empty }}</b>
      <p class="small t2">{{ m.emptyHint }}</p>
    </div>
    <ul v-else class="plan-list">
      <li v-for="plan in plans" :key="plan.id" class="card plan-card" data-test="plan" @click="openCard($event, plan)">
        <div class="plan-card-main">
          <RouterLink class="plan-name" :to="{ name: 'plan', params: { id: plan.id } }" :title="plan.name">{{ plan.name }}</RouterLink>
          <p v-if="previewOf(plan).span" class="plan-span" data-test="plan-span"><Icon name="cap" size="sm" />{{ previewOf(plan).span }}</p>
          <p class="plan-counts" data-test="plan-counts">{{ previewOf(plan).counts }}</p>
          <p class="small t3">{{ m.curriculum(plan.curriculum.code) }} · {{ m.updated(formatDateTime(plan.updatedAt, locale.lang)) }}</p>
        </div>
        <!-- One action at a time: they share `busy` and `dialogError`, so a copy's failure cannot show in another's dialog. -->
        <div class="plan-card-acts" role="group" :aria-label="m.actionsFor(plan.name)">
          <button class="btn sm" type="button" data-test="rename" :disabled="busy" @click="openNaming(plan)"><Icon name="edit" size="sm" />{{ m.rename }}</button>
          <button class="btn sm" type="button" data-test="copy" :disabled="busy" @click="copy(plan)"><Icon name="copy" size="sm" />{{ m.copy }}</button>
          <button class="btn sm ghost" type="button" data-test="delete" :disabled="busy" @click="askDelete(plan)"><Icon name="trash" size="sm" />{{ m.delete }}</button>
        </div>
      </li>
    </ul>

    <PlanNameDialog
      :open="naming !== null"
      :title="naming?.plan ? m.renameTitle : m.createTitle"
      :body="naming?.plan || !program ? undefined : m.createBody(`${program.code} ${program.cohort}`)"
      :submit="naming?.plan ? m.save : m.create"
      :initial="naming?.plan?.name ?? ''"
      :busy="busy"
      :error="dialogError"
      @close="naming = null"
      @save="saveName"
    />

    <DeletePlanDialog :open="deleting !== null" :name="deleting?.name ?? ''" :busy="busy" :error="dialogError" @close="deleting = null" @confirm="confirmDelete" />
  </div>
</template>

<style>
.plans-page .empty { text-align: center; display: grid; gap: 4px; }
.plan-list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 14px; }
.plan-card {
  display: grid; grid-template-rows: 1fr auto; gap: 14px; cursor: pointer; min-width: 0;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}
.plan-card:hover { border-color: var(--edge-strong); box-shadow: var(--shadow-lg); transform: translateY(-1px); }
.plan-card:has(.plan-name:focus-visible) { outline: 2px solid var(--info); outline-offset: 2px; }
.plan-card-main { min-width: 0; display: grid; gap: 6px; align-content: start; }
.plan-name {
  font: 700 17px var(--display); color: var(--ink); text-decoration: none; overflow-wrap: anywhere; outline: none;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden;
}
.plan-span { display: flex; align-items: center; gap: 6px; font-weight: 650; font-size: 14px; color: var(--ink-2); }
.plan-span .icon { color: var(--ink-3); }
.plan-counts { font-size: 14px; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.plan-card-acts { display: flex; gap: 8px; flex-wrap: wrap; padding-top: 12px; border-top: 1px solid var(--edge); }
</style>
