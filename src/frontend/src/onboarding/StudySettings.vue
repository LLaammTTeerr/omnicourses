<script setup lang="ts">
import { computed } from 'vue';
import SelectMenu from '../components/SelectMenu.vue';
import { useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import { useToast } from '../shell/toast.js';
import { creditsProblem, useAnswerForm } from './answers.js';
import GoalFields from './GoalFields.vue';
import { STUDY_MESSAGES } from './messages.js';
import { useOnboarding } from './store.js';

const onboarding = useOnboarding();
const toast = useToast();
const m = useMessages(STUDY_MESSAGES);

const { status, reload, program, cohort, goal, choices: allChoices, cohorts, programName, saving, saveFailed, goalErrors, otherErrors, save: saveAnswers } = useAnswerForm();
const choices = computed(() => allChoices.value.filter((choice) => choice.offered));

function pickProgram(code: string): void {
  program.value = code;
  if (cohort.value === null || !cohorts.value.includes(cohort.value)) cohort.value = cohorts.value[0] ?? null;
}

async function save(): Promise<void> {
  if (creditsProblem(goal.credits)) return;
  if (await saveAnswers(onboarding.finished)) toast.show(m.value.saved);
}
</script>

<template>
  <section id="study" class="card flush" aria-labelledby="study-title">
    <div class="card-head"><h2 id="study-title">{{ m.title }}</h2></div>
    <p v-if="status === 'loading'" class="srow t3">{{ m.loading }}</p>
    <div v-else-if="status === 'failed'" class="srow">
      <p class="callout bad" role="alert"><Icon name="alert" /><span>{{ m.loadFailed }}</span></p>
      <button class="btn sm" type="button" @click="reload">{{ m.retry }}</button>
    </div>
    <div v-else-if="!onboarding.finished" class="srow">
      <div class="txt"><b>{{ m.unfinished }}</b><p>{{ m.unfinishedNote }}</p></div>
      <RouterLink class="btn primary" :to="{ name: 'onboarding' }" data-test="finish-onboarding">{{ m.continue }}</RouterLink>
    </div>
    <form v-else class="study-form" novalidate data-test="study-form" @submit.prevent="save">
      <p class="small t2">{{ m.note }}</p>
      <div class="study-program">
        <div class="field">
          <span class="label">{{ m.program }}</span>
          <SelectMenu :model-value="program" :aria-label="m.program" :options="choices.map((choice) => ({ value: choice.code, label: programName(choice) }))" @update:model-value="pickProgram" />
        </div>
        <div class="field">
          <span class="label">{{ m.cohort }}</span>
          <SelectMenu v-model="cohort" :aria-label="m.cohort" :options="cohorts.map((year) => ({ value: year, label: m.cohortOption(year) }))" />
        </div>
      </div>
      <GoalFields v-model:graduation="goal.graduation" v-model:credits="goal.credits" v-model:internship="goal.internship" id-prefix="study" :errors="goalErrors" />
      <div v-if="otherErrors.length" class="callout bad" role="alert"><Icon name="alert" /><div><p v-for="error in otherErrors" :key="error">{{ error }}</p></div></div>
      <p v-if="saveFailed" class="callout bad" role="alert" data-test="study-save-failed"><Icon name="alert" /><span>{{ m.saveFailed }}</span></p>
      <div><button class="btn primary" type="submit" :disabled="saving">{{ saving ? m.saving : m.save }}</button></div>
    </form>
  </section>
</template>

<style scoped>
.srow { display: flex; justify-content: space-between; align-items: center; gap: 12px 16px; padding: 16px 22px; border-top: 1px solid var(--line); flex-wrap: wrap; }
.card-head + .srow { border-top: 0; }
.srow .txt { min-width: 0; flex: 1 1 260px; }
.srow .txt b { display: block; font-size: 14.5px; }
.srow .txt p { font-size: 13.5px; color: var(--ink-2); }
.study-form { display: grid; gap: 18px; padding: 4px 22px 22px; }
.study-program { display: flex; flex-wrap: wrap; gap: 14px; }
.study-program .field { flex: 1 1 200px; max-width: 320px; }
@media (max-width: 620px) {
  .srow { padding: 14px 16px; }
  .study-form { padding: 4px 16px 18px; }
}
</style>
