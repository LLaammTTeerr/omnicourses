<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { statusOf } from '../api.js';
import { useAuth } from '../auth/store.js';
import { useMessages } from '../locale.js';
import { useOnboarding } from '../onboarding/store.js';
import { usePageTitle } from '../page-title.js';
import Icon from '../shell/Icon.vue';
import { createPlan, fetchPlans } from './api.js';
import { readLastPlan } from './last-plan.js';
import { PLANNER_MESSAGES } from './messages.js';

// The planner's front door (/plans): it opens a plan straight away. The one the student had open last, else their
// first; a student with none gets a "Default plan" on their program and cohort. Without a program, or when the plans
// cannot be read, the plans list says what to do. The list itself lives at /plans/all.
const auth = useAuth();
const onboarding = useOnboarding();
const router = useRouter();
const m = useMessages(PLANNER_MESSAGES);
const failed = ref(false);

async function open(): Promise<void> {
  failed.value = false;
  try {
    const { plans } = await auth.authed(fetchPlans);
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
    if (statusOf(e) === 401) return;
    console.error('Opening the planner failed:', e);
    failed.value = true;
  }
}
onMounted(open);

usePageTitle(() => m.value.title);
</script>

<template>
  <div class="page">
    <div v-if="failed" class="callout bad" role="alert" data-test="entry-failed">
      <Icon name="alert" />
      <div>
        <p>{{ m.loadFailed }}</p>
        <button class="btn sm" type="button" @click="open">{{ m.retry }}</button>
        <RouterLink class="btn sm ghost" :to="{ name: 'plan-list' }">{{ m.backToList }}</RouterLink>
      </div>
    </div>
    <p v-else class="t3" role="status">{{ m.opening }}</p>
  </div>
</template>
