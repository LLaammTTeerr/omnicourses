<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { statusOf } from '../api.js';
import { useAsyncLoad } from '../async-load.js';
import { useAuth } from '../auth/store.js';
import ModalDialog from '../components/ModalDialog.vue';
import { formatDateTime, useLocale, useMessages } from '../locale.js';
import { useOnboarding } from '../onboarding/store.js';
import { usePageTitle } from '../page-title.js';
import Icon from '../shell/Icon.vue';
import { useToast } from '../shell/toast.js';
import { createPlan, deletePlan, duplicatePlan, fetchPlans, renamePlan, type PlanSummary } from './api.js';
import { PLANNER_MESSAGES } from './messages.js';
import PlanNameDialog from './PlanNameDialog.vue';

// F5 (UC-05 A6): the student's plans, to open, create, rename, copy and delete. A plan keeps the curriculum it was
// created with (ADR 0014); a new one uses the student's program and cohort from onboarding.
const auth = useAuth();
const onboarding = useOnboarding();
const locale = useLocale();
const toast = useToast();
const router = useRouter();
const m = useMessages(PLANNER_MESSAGES);

const plans = ref<PlanSummary[]>([]);
const { status, reload } = useAsyncLoad('the plans', async () => {
  plans.value = (await auth.authed(fetchPlans)).plans;
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
const busy = ref(false);
const dialogError = ref<string | null>(null);
const deleting = shallowRef<PlanSummary | null>(null);

function openNaming(plan: PlanSummary | null): void {
  dialogError.value = null;
  naming.value = { plan };
}

/** Runs an action; a 401 has already signed the student out (App.vue), any other failure is said. */
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

async function saveName(name: string): Promise<void> {
  const target = naming.value?.plan ?? null;
  if (target) {
    const done = await attempt('Renaming the plan', async () => {
      const renamed = await auth.authed((token) => renamePlan(token, target.id, name));
      plans.value = plans.value.map((plan) => (plan.id === renamed.id ? renamed : plan));
      toast.show(m.value.renamed(renamed.name));
    });
    if (done) naming.value = null;
    return;
  }
  if (!program.value) return;
  const { code, cohort } = program.value;
  await attempt('Creating a plan', async () => {
    const created = await auth.authed((token) => createPlan(token, { name, programCode: code, cohortYear: cohort }));
    toast.show(m.value.created(created.name));
    naming.value = null;
    await router.push({ name: 'plan', params: { id: created.id } });
  });
}

async function copy(plan: PlanSummary): Promise<void> {
  const name = m.value.copyName(plan.name).slice(0, 100);
  const done = await attempt('Copying the plan', async () => {
    const copied = await auth.authed((token) => duplicatePlan(token, plan.id, name));
    plans.value = [...plans.value, copied];
    toast.show(m.value.copied(copied.name));
  });
  if (!done && dialogError.value) toast.show(dialogError.value);
}

function askDelete(plan: PlanSummary): void {
  dialogError.value = null;
  deleting.value = plan;
}

/** Keep and Escape do nothing while the deletion is out: it would still go through. */
function closeDelete(): void {
  if (!busy.value) deleting.value = null;
}

async function confirmDelete(): Promise<void> {
  const plan = deleting.value;
  if (!plan) return;
  const done = await attempt('Deleting the plan', async () => {
    await auth.authed((token) => deletePlan(token, plan.id));
    plans.value = plans.value.filter((p) => p.id !== plan.id);
    toast.show(m.value.deleted(plan.name));
  });
  if (done) deleting.value = null;
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
        <button class="btn primary" type="button" :disabled="!program || status !== 'loaded'" data-test="new-plan" @click="openNaming(null)">
          <Icon name="plus" size="sm" />{{ m.newPlan }}
        </button>
      </div>
    </header>

    <div v-if="answers.status.value === 'failed'" class="callout warn" role="alert" data-test="program-failed">
      <Icon name="alert" />
      <div>
        <p>{{ m.programFailed }}</p>
        <button class="btn sm" type="button" @click="answers.reload">{{ m.retry }}</button>
      </div>
    </div>
    <p v-else-if="answers.status.value === 'loaded' && !program" class="callout warn" data-test="no-program">
      <Icon name="info" /><span>{{ m.noProgram }} <RouterLink class="link" :to="{ name: 'settings' }">{{ m.openSettings }}</RouterLink></span>
    </p>

    <p v-if="status === 'loading'" class="t3">{{ m.loading }}</p>
    <div v-else-if="status === 'failed'" class="callout bad" role="alert">
      <Icon name="alert" />
      <div>
        <p>{{ m.loadFailed }}</p>
        <button class="btn sm" type="button" @click="reload">{{ m.retry }}</button>
      </div>
    </div>
    <div v-else-if="plans.length === 0" class="card empty" role="status" data-test="empty">
      <b>{{ m.empty }}</b>
      <p class="small t2">{{ m.emptyHint }}</p>
    </div>
    <ul v-else class="plan-list">
      <li v-for="plan in plans" :key="plan.id" class="card plan-card" data-test="plan">
        <div class="plan-card-main">
          <RouterLink class="plan-name" :to="{ name: 'plan', params: { id: plan.id } }">{{ plan.name }}</RouterLink>
          <p class="small t3">{{ m.curriculum(plan.curriculum.code) }} · {{ m.updated(formatDateTime(plan.updatedAt, locale.lang)) }}</p>
        </div>
        <div class="plan-card-acts" role="group" :aria-label="m.actionsFor(plan.name)">
          <button class="btn sm" type="button" data-test="rename" @click="openNaming(plan)"><Icon name="edit" size="sm" />{{ m.rename }}</button>
          <button class="btn sm" type="button" data-test="copy" :disabled="busy" @click="copy(plan)"><Icon name="copy" size="sm" />{{ m.copy }}</button>
          <button class="btn sm ghost" type="button" data-test="delete" @click="askDelete(plan)"><Icon name="trash" size="sm" />{{ m.delete }}</button>
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

    <ModalDialog :open="deleting !== null" role="alertdialog" labelledby="delete-plan-title" describedby="delete-plan-body" @close="closeDelete">
      <span class="ic" aria-hidden="true"><Icon name="trash" /></span>
      <h2 id="delete-plan-title">{{ m.deleteTitle(deleting?.name ?? '') }}</h2>
      <p id="delete-plan-body" class="t2">{{ m.deleteBody }}</p>
      <p v-if="dialogError" class="callout bad small" role="alert"><Icon name="alert" size="sm" /><span>{{ dialogError }}</span></p>
      <div class="acts">
        <button class="btn" type="button" autofocus :disabled="busy" @click="closeDelete">{{ m.keep }}</button>
        <button class="btn danger" type="button" data-test="confirm-delete" :disabled="busy" @click="confirmDelete">
          <Icon name="trash" size="sm" />{{ busy ? m.deleting : m.delete }}
        </button>
      </div>
    </ModalDialog>
  </div>
</template>

<style>
.plans-page .empty { text-align: center; display: grid; gap: 4px; }
.plan-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.plan-card { display: flex; align-items: center; justify-content: space-between; gap: 12px 20px; flex-wrap: wrap; }
.plan-card-main { min-width: 0; display: grid; gap: 4px; }
.plan-name { font-weight: 700; font-size: 16.5px; color: var(--ink); text-decoration: none; overflow-wrap: anywhere; }
.plan-name:hover { text-decoration: underline; }
.plan-card-acts { display: flex; gap: 8px; flex-wrap: wrap; }
</style>
