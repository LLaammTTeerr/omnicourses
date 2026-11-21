import { computed, reactive, ref, shallowRef } from 'vue';
import { HttpError, reportFailure, statusOf } from '../api.js';
import { useAsyncLoad } from '../async-load.js';
import type { Onboarding } from './api.js';
import { errorsByField, goalAnswers, goalDraft, type AnswerField, type GoalDraft } from './answers.js';
import { useOnboarding } from './store.js';

/**
 * The onboarding answers as a form (UC-01): loaded from the student's saved answers, saved whole (PUT replaces every
 * answer), and the API's 400 messages by the answer they name. The wizard and the settings section share it; each
 * decides what picking a program does to the cohort, as its own steps need.
 */
export function useOnboardingForm(onLoaded: (answers: Onboarding) => void = () => {}) {
  const onboarding = useOnboarding();
  const program = ref<string | null>(null);
  const cohort = ref<number | null>(null);
  const goal = reactive<GoalDraft>({ graduation: '', credits: '', internship: '' });

  const { status, reload } = useAsyncLoad('the onboarding answers', async () => {
    const answers = await onboarding.load();
    program.value = answers.program;
    cohort.value = answers.cohort;
    Object.assign(goal, goalDraft(answers));
    onLoaded(answers);
    return answers;
  });

  const saving = ref(false);
  const saveFailed = ref(false);
  const apiErrors = shallowRef<Partial<Record<AnswerField, string[]>>>({});
  /** Refusals that name no field the form shows beside its input. */
  const otherErrors = computed(() => [...(apiErrors.value.program ?? []), ...(apiErrors.value.cohort ?? []), ...(apiErrors.value.finished ?? [])]);
  const goalErrors = computed(() => ({
    graduation: apiErrors.value.targetGraduationTerm,
    credits: apiErrors.value.creditsPerTerm,
    internship: apiErrors.value.internshipTerm,
  }));

  /** Saves every answer; false when the API refused one (shown by field) or the save failed. */
  async function save(finished: boolean): Promise<boolean> {
    saving.value = true;
    saveFailed.value = false;
    apiErrors.value = {};
    try {
      await onboarding.save({ program: program.value, cohort: cohort.value, ...goalAnswers(goal), finished });
      return true;
    } catch (e) {
      if (statusOf(e) === 400 && e instanceof HttpError) apiErrors.value = errorsByField(e.details);
      else saveFailed.value = reportFailure('Saving the onboarding answers', e);
      return false;
    } finally {
      saving.value = false;
    }
  }

  return { program, cohort, goal, status, reload, saving, saveFailed, apiErrors, otherErrors, goalErrors, save };
}
