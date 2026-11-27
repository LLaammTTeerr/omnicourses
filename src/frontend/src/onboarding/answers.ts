import { computed, reactive, ref, shallowRef, type Ref } from 'vue';
import { byField, failureKind, type HttpError } from '../api.js';
import { useAsyncLoad } from '../async-load.js';
import { fetchPrograms, type Program } from '../curriculum/api.js';
import { useLocale } from '../locale.js';
import { goalTerms, parseTermKey, sameTerm, termKey, type Term } from '../terms.js';
import { NO_INTERNSHIP, OFFERED_COHORTS, type Onboarding } from './api.js';
import { useOnboarding } from './store.js';

interface GoalDraft {
  graduation: string;
  credits: string;
  internship: string;
}

export function goalDraft(answers: Onboarding): GoalDraft {
  const internship = answers.internshipTerm;
  return {
    graduation: answers.targetGraduationTerm ? termKey(answers.targetGraduationTerm) : '',
    credits: answers.creditsPerTerm === null ? '' : String(answers.creditsPerTerm),
    internship: internship === null ? '' : internship === NO_INTERNSHIP ? NO_INTERNSHIP : termKey(internship),
  };
}

const CREDITS_COLUMN_INT32_MAX = 2_147_483_647;

export type CreditsProblem = 'whole' | 'tooLarge';

export function creditsProblem(text: string): CreditsProblem | null {
  const typed = text.trim();
  if (typed === '') return null;
  if (!/^\d+$/.test(typed) || Number(typed) < 1) return 'whole';
  return Number(typed) > CREDITS_COLUMN_INT32_MAX ? 'tooLarge' : null;
}

export function goalAnswers(draft: GoalDraft): Pick<Onboarding, 'targetGraduationTerm' | 'creditsPerTerm' | 'internshipTerm'> {
  const credits = draft.credits.trim();
  return {
    targetGraduationTerm: parseTermKey(draft.graduation),
    creditsPerTerm: credits === '' ? null : Number(credits),
    internshipTerm: draft.internship === NO_INTERNSHIP ? NO_INTERNSHIP : parseTermKey(draft.internship),
  };
}

export function goalTermChoices(saved: (Term | null)[], now: Date = new Date()): Term[] {
  const terms = goalTerms(now);
  const old = saved.filter((term): term is Term => term !== null && !terms.some((t) => sameTerm(t, term)));
  return [...old, ...terms];
}

interface ProgramChoice {
  code: string;
  program: Program | null;
  cohorts: number[];
  offered: boolean;
}

export function programChoices(programs: readonly Program[]): ProgramChoice[] {
  const offered = Object.entries(OFFERED_COHORTS).map(([code, cohorts]): ProgramChoice => {
    const program = programs.find((p) => p.code === code) ?? null;
    return { code, program, cohorts: program ? cohorts.filter((c) => program.cohortYears.includes(c)) : [...cohorts], offered: true };
  });
  const others = programs.filter((p) => !Object.hasOwn(OFFERED_COHORTS, p.code)).map((program): ProgramChoice => ({ code: program.code, program, cohorts: [], offered: false }));
  return [...offered, ...others];
}

export function resumeStep(answers: Onboarding): number {
  if (answers.program === null) return 0;
  if (answers.cohort === null) return 1;
  return 2;
}

export const ANSWER_FIELDS = ['program', 'cohort', 'targetGraduationTerm', 'creditsPerTerm', 'internshipTerm', 'finished'] as const;
export type AnswerField = (typeof ANSWER_FIELDS)[number];

function useAnswerErrors() {
  const apiErrors = shallowRef<Partial<Record<AnswerField, string[]>>>({});
  const goalErrors = computed(() => ({
    graduation: apiErrors.value.targetGraduationTerm,
    credits: apiErrors.value.creditsPerTerm,
    internship: apiErrors.value.internshipTerm,
  }));
  const otherErrors = computed(() => [...(apiErrors.value.program ?? []), ...(apiErrors.value.cohort ?? []), ...(apiErrors.value.finished ?? [])]);
  return { apiErrors, goalErrors, otherErrors };
}

function useProgramChoices(program: Ref<string | null>) {
  const locale = useLocale();
  const programs = useAsyncLoad('the programs', fetchPrograms);
  const choices = computed(() => programChoices(programs.data.value?.programs ?? []));
  const cohorts = computed(() => choices.value.find((choice) => choice.code === program.value)?.cohorts ?? []);
  const programName = (choice: ProgramChoice) => (locale.lang === 'en' ? choice.program?.nameEn : null) ?? choice.program?.nameVi ?? choice.code;
  return { programs, choices, cohorts, programName };
}

export function useAnswerForm(onLoaded: (answers: Onboarding) => void = () => {}) {
  const onboarding = useOnboarding();
  const program = ref<string | null>(null);
  const cohort = ref<number | null>(null);
  const goal = reactive<GoalDraft>({ graduation: '', credits: '', internship: '' });
  const answersLoad = useAsyncLoad('the onboarding answers', async () => {
    const answers = await onboarding.load();
    program.value = answers.program;
    cohort.value = answers.cohort;
    Object.assign(goal, goalDraft(answers));
    onLoaded(answers);
  });
  const { programs, choices, cohorts, programName } = useProgramChoices(program);
  const status = computed<'loading' | 'loaded' | 'failed'>(() => {
    if (answersLoad.status.value === 'loading' || programs.status.value === 'loading') return 'loading';
    if (answersLoad.status.value === 'failed') return 'failed';
    return 'loaded';
  });
  async function reload(): Promise<void> {
    const tasks: Promise<void>[] = [];
    if (answersLoad.status.value !== 'loaded') tasks.push(answersLoad.reload());
    if (programs.status.value !== 'loaded') tasks.push(programs.reload());
    await Promise.all(tasks.length ? tasks : [answersLoad.reload(), programs.reload()]);
  }
  const saving = ref(false);
  const saveFailed = ref(false);
  const errors = useAnswerErrors();

  async function save(finished: boolean): Promise<boolean> {
    saving.value = true;
    saveFailed.value = false;
    errors.apiErrors.value = {};
    try {
      await onboarding.save({ program: program.value, cohort: cohort.value, ...goalAnswers(goal), finished });
      return true;
    } catch (e) {
      const kind = failureKind(e);
      if (kind === 'invalid') errors.apiErrors.value = byField((e as HttpError).details, ANSWER_FIELDS).fields;
      else if (kind !== 'unauthorized') {
        console.error('Saving the onboarding answers failed:', e);
        saveFailed.value = true;
      }
      return false;
    } finally {
      saving.value = false;
    }
  }

  return { status, reload, program, cohort, goal, choices, cohorts, programName, saving, saveFailed, ...errors, save };
}
