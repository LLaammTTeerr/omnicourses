import { computed, reactive, ref, shallowRef, type Ref } from 'vue';
import { byField, failureKind, type HttpError } from '../api.js';
import { useAsyncLoad } from '../async-load.js';
import { fetchPrograms, type Program } from '../curriculum/api.js';
import { useLocale } from '../locale.js';
import { goalTerms, parseTermKey, sameTerm, termKey, type Term } from '../terms.js';
import { NO_INTERNSHIP, OFFERED_COHORTS, type Onboarding } from './api.js';
import { useOnboarding } from './store.js';

// The onboarding answers as a form edits them: every select holds a string, "" meaning not answered. Shared by the
// wizard and the settings section, which save the same object (UC-01 A9).

/** The goal fields of the form: a term key ("2026-1") or "", the credits as typed, and a term key, "none" or "". */
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

// The column the API stores credits in is a 32-bit integer.
const MAX_STORED_CREDITS = 2_147_483_647;

export type CreditsProblem = 'whole' | 'tooLarge';

/** Credits per term: empty means not set; otherwise a whole number of 1 or more, with no upper limit (UC-01 §7). */
export function creditsProblem(text: string): CreditsProblem | null {
  const typed = text.trim();
  if (typed === '') return null;
  if (!/^\d+$/.test(typed) || Number(typed) < 1) return 'whole';
  return Number(typed) > MAX_STORED_CREDITS ? 'tooLarge' : null;
}

/** The goal answers to send. Call only once creditsProblem is null. */
export function goalAnswers(draft: GoalDraft): Pick<Onboarding, 'targetGraduationTerm' | 'creditsPerTerm' | 'internshipTerm'> {
  const credits = draft.credits.trim();
  return {
    targetGraduationTerm: parseTermKey(draft.graduation),
    creditsPerTerm: credits === '' ? null : Number(credits),
    internshipTerm: draft.internship === NO_INTERNSHIP ? NO_INTERNSHIP : parseTermKey(draft.internship),
  };
}

/** The terms a goal may name, plus a saved one the window has since passed, so the select still shows it. */
export function goalTermChoices(saved: (Term | null)[], now: Date = new Date()): Term[] {
  const terms = goalTerms(now);
  const old = saved.filter((term): term is Term => term !== null && !terms.some((t) => sameTerm(t, term)));
  return [...old, ...terms];
}

interface ProgramChoice {
  code: string;
  program: Program | null;
  /** The cohorts both offered in this release and with a curriculum. */
  cohorts: number[];
  /** Offered in this release (B1 §6 item 1); the others are listed but cannot be picked (UC-01 A7). */
  offered: boolean;
}

/** Every program the API lists, the offered ones first; an offered program the list lacks still appears. */
export function programChoices(programs: readonly Program[]): ProgramChoice[] {
  const offered = Object.entries(OFFERED_COHORTS).map(([code, cohorts]): ProgramChoice => {
    const program = programs.find((p) => p.code === code) ?? null;
    return { code, program, cohorts: program ? cohorts.filter((c) => program.cohortYears.includes(c)) : [...cohorts], offered: true };
  });
  const others = programs.filter((p) => !Object.hasOwn(OFFERED_COHORTS, p.code)).map((program): ProgramChoice => ({ code: program.code, program, cohorts: [], offered: false }));
  return [...offered, ...others];
}

/** The step onboarding resumes at (UC-01 A8): the program, the cohort, then the goal, which is optional. */
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
  // The names of the programs. Without them the offered codes still show, so onboarding never waits on this list.
  const programs = useAsyncLoad('the programs', fetchPrograms);
  const choices = computed(() => programChoices(programs.data.value?.programs ?? []));
  const cohorts = computed(() => choices.value.find((choice) => choice.code === program.value)?.cohorts ?? []);
  const programName = (choice: ProgramChoice) => (locale.lang === 'en' ? choice.program?.nameEn : null) ?? choice.program?.nameVi ?? choice.code;
  return { choices, cohorts, programName };
}

export function useAnswerForm(onLoaded: (answers: Onboarding) => void = () => {}) {
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
  });
  const { choices, cohorts, programName } = useProgramChoices(program);
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
      // The API's 400 messages by the answer they name ("creditsPerTerm must be …"), so each shows under its field.
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
