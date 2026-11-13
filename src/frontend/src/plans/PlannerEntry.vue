<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { reportFailure } from '../api.js';
import { useAuth } from '../auth/store.js';
import LoadState from '../components/LoadState.vue';
import { useMessages } from '../locale.js';
import { useOnboarding } from '../onboarding/store.js';
import { usePageTitle } from '../page-title.js';
import { createPlan } from './api.js';
import { readLastPlan } from './last-plan.js';
import { PLANNER_MESSAGES } from './messages.js';
import { useLoadPlans } from './plan-actions.js';

// The planner's front door (/plans): it opens a plan straight away. The one the student had open last, else their
// first; a student with none gets a "Default plan" on their program and cohort. Without a program, or when the plans
// cannot be read, the plans list says what to do. The list itself lives at /plans/all.
const auth = useAuth();
const onboarding = useOnboarding();
const router = useRouter();
const m = useMessages(PLANNER_MESSAGES);
const failed = ref(false);
const loadPlans = useLoadPlans();

async function open(): Promise<void> {
  failed.value = false;
  try {
    const plans = await loadPlans();
    const last = readLastPlan();
    const pick = plans.find((p) => p.id === last) ?? plans[0];
    if (pick) {
      await router.replace({ name: 'plan', params: { id: pick.id } });
      return;
    }
    const answers = await onboarding.load().catch(() => null);
    if (!answers?.program || !answers.cohort) {
      await router.replace({ name: 'plan-list' });
      return;
    }
    const made = await auth.authed((token) => createPlan(token, { name: m.value.defaultPlanName, programCode: answers.program!, cohortYear: answers.cohort! }));
    await router.replace({ name: 'plan', params: { id: made.id } });
  } catch (e) {
    failed.value = reportFailure('Opening the planner', e);
  }
}
onMounted(open);

usePageTitle(() => m.value.title);
</script>

<template>
  <div class="page">
    <LoadState v-if="failed" status="failed" :failed="m.loadFailed" data-test="entry-failed" @retry="open">
      <template #actions><RouterLink class="btn sm ghost" :to="{ name: 'plan-list' }">{{ m.backToList }}</RouterLink></template>
    </LoadState>
    <p v-else class="t3" role="status">{{ m.opening }}</p>
  </div>
</template>
