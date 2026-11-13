<script setup lang="ts">
import { computed } from 'vue';
import SelectMenu from '../components/SelectMenu.vue';
import { isOffered, programName as nameOfProgram, usePrograms, type ProgramChoice } from '../curriculum/programs.js';
import { useLocale, useMessages } from '../locale.js';
import { COMMON_MESSAGES } from '../messages.js';
import Icon from '../shell/Icon.vue';
import { useToast } from '../shell/toast.js';
import { creditsProblem } from './answers.js';
import { useOnboardingForm } from './form.js';
import GoalFields from './GoalFields.vue';
import { STUDY_MESSAGES } from './study-messages.js';
import { useOnboarding } from './store.js';

// Settings: the onboarding answers, changed later (UC-01 A9). The same object is saved, finished stays as it is.
// An unfinished onboarding is finished in the wizard, which this links to.
const onboarding = useOnboarding();
const locale = useLocale();
const toast = useToast();
const m = useMessages(STUDY_MESSAGES);
const common = useMessages(COMMON_MESSAGES);

const { program, cohort, goal, status, reload, saving, saveFailed, otherErrors, goalErrors, save: saveAnswers } = useOnboardingForm();
const { choices: allChoices } = usePrograms();
const choices = computed(() => allChoices.value.filter((choice) => choice.offered));
const cohorts = computed(() => choices.value.find((choice) => choice.code === program.value)?.cohorts ?? []);
const programName = (choice: ProgramChoice) => nameOfProgram(choice, locale.lang);

/** A cohort belongs to its program: the select has no empty choice, so the program's first cohort is picked. */
function pickProgram(code: string): void {
  if (!isOffered(code)) return; // the select lists only offered programs
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
    <p v-if="status === 'loading'" class="srow t3">{{ common.loading }}</p>
    <div v-else-if="status === 'failed'" class="srow">
      <p class="callout bad" role="alert"><Icon name="alert" /><span>{{ m.loadFailed }}</span></p>
      <button class="btn sm" type="button" @click="reload">{{ common.retry }}</button>
    </div>
    <div v-else-if="!onboarding.finished" class="srow">
      <div class="txt"><b>{{ m.unfinished }}</b><p>{{ m.unfinishedNote }}</p></div>
      <RouterLink class="btn primary" :to="{ name: 'onboarding' }" data-test="finish-onboarding">{{ m.continue }}</RouterLink>
    </div>
    <form v-else class="study-form" novalidate data-test="study-form" @submit.prevent="save">
      <p class="small t2">{{ m.note }}</p>
      <div class="study-program">
        <label class="field">
          <span>{{ m.program }}</span>
          <SelectMenu :model-value="program" :options="choices.map((choice) => ({ value: choice.code, label: programName(choice) }))" @update:model-value="pickProgram" />
        </label>
        <label class="field">
          <span>{{ m.cohort }}</span>
          <SelectMenu v-model="cohort" :options="cohorts.map((year) => ({ value: year, label: m.cohortOption(year) }))" />
        </label>
      </div>
      <GoalFields v-model:graduation="goal.graduation" v-model:credits="goal.credits" v-model:internship="goal.internship" id-prefix="study" :errors="goalErrors" />
      <div v-if="otherErrors.length" class="callout bad" role="alert"><Icon name="alert" /><div><p v-for="error in otherErrors" :key="error">{{ error }}</p></div></div>
      <p v-if="saveFailed" class="callout bad" role="alert" data-test="study-save-failed"><Icon name="alert" /><span>{{ m.saveFailed }}</span></p>
      <div><button class="btn primary" type="submit" :disabled="saving">{{ saving ? m.saving : m.save }}</button></div>
    </form>
  </section>
</template>

<style>
.study-form { display: grid; gap: 18px; padding: 4px 22px 22px; }
.study-program { display: flex; flex-wrap: wrap; gap: 14px; }
.study-program .field { flex: 1 1 200px; max-width: 320px; }
@media (max-width: 620px) {
  .study-form { padding: 4px 16px 18px; }
}
</style>
