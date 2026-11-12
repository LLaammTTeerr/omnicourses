<script setup lang="ts">
import { computed, reactive, ref, shallowRef } from 'vue';
import { HttpError, statusOf } from '../api.js';
import { useAsyncLoad } from '../async-load.js';
import { useAuth } from '../auth/store.js';
import SelectMenu from '../components/SelectMenu.vue';
import { fetchPrograms } from '../curriculum/api.js';
import { useLocale, useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import { useToast } from '../shell/toast.js';
import { creditsProblem, errorsByField, goalAnswers, goalDraft, programChoices, type AnswerField, type GoalDraft } from './answers.js';
import GoalFields from './GoalFields.vue';
import { STUDY_MESSAGES } from './study-messages.js';
import { useOnboarding } from './store.js';

// Settings: the onboarding answers, changed later (UC-01 A9). The same object is saved, finished stays as it is.
// An unfinished onboarding is finished in the wizard, which this links to.
const auth = useAuth();
const onboarding = useOnboarding();
const locale = useLocale();
const toast = useToast();
const m = useMessages(STUDY_MESSAGES);

const program = ref<string | null>(null);
const cohort = ref<number | null>(null);
const goal = reactive<GoalDraft>({ graduation: '', credits: '', internship: '' });
const { status, reload } = useAsyncLoad('the onboarding answers', async () => {
  const answers = await onboarding.load();
  program.value = answers.program;
  cohort.value = answers.cohort;
  Object.assign(goal, goalDraft(answers));
  return answers;
});
const programs = useAsyncLoad('the programs', () => auth.authed(fetchPrograms));
const choices = computed(() => programChoices(programs.data.value?.programs ?? []).filter((choice) => choice.offered));
const cohorts = computed(() => choices.value.find((choice) => choice.code === program.value)?.cohorts ?? []);
const programName = (choice: (typeof choices.value)[number]) => (locale.lang === 'en' ? choice.program?.nameEn : null) ?? choice.program?.nameVi ?? choice.code;

function pickProgram(code: string): void {
  program.value = code;
  if (cohort.value === null || !cohorts.value.includes(cohort.value)) cohort.value = cohorts.value[0] ?? null;
}

const saving = ref(false);
const saveFailed = ref(false);
const apiErrors = shallowRef<Partial<Record<AnswerField, string[]>>>({});
const goalErrors = computed(() => ({
  graduation: apiErrors.value.targetGraduationTerm,
  credits: apiErrors.value.creditsPerTerm,
  internship: apiErrors.value.internshipTerm,
}));
const otherErrors = computed(() => [...(apiErrors.value.program ?? []), ...(apiErrors.value.cohort ?? []), ...(apiErrors.value.finished ?? [])]);

async function save(): Promise<void> {
  if (creditsProblem(goal.credits)) return;
  saving.value = true;
  saveFailed.value = false;
  apiErrors.value = {};
  try {
    await onboarding.save({ program: program.value, cohort: cohort.value, ...goalAnswers(goal), finished: onboarding.finished });
    toast.show(m.value.saved);
  } catch (e) {
    if (statusOf(e) === 400 && e instanceof HttpError) apiErrors.value = errorsByField(e.details);
    else if (statusOf(e) !== 401) {
      console.error('Saving the onboarding answers failed:', e);
      saveFailed.value = true;
    }
  } finally {
    saving.value = false;
  }
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
