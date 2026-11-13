<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { afterSignIn } from '../auth/redirect.js';
import LoadState from '../components/LoadState.vue';
import { programName as nameOfProgram, usePrograms, type ProgramChoice } from '../curriculum/programs.js';
import { groupClass } from '../groups.js';
import { useLocale, useMessages } from '../locale.js';
import { usePageTitle } from '../page-title.js';
import BrandLink from '../shell/BrandLink.vue';
import Icon from '../shell/Icon.vue';
import LangButton from '../shell/LangButton.vue';
import ThemeButton from '../shell/ThemeButton.vue';
import { useToast } from '../shell/toast.js';
import { creditsProblem, resumeStep, type AnswerField } from './answers.js';
import { useOnboardingForm } from './form.js';
import GoalFields from './GoalFields.vue';
import { ONBOARDING_MESSAGES } from './messages.js';

// Onboarding (UC-01 steps 6–9, UI prototypes: onboarding.html): program, cohort, then the default planning goal.
// Every step saves the whole object with finished false, so a student who leaves resumes at the first unanswered
// step (A8); Finish saves it with finished true. The program list comes from the curriculum API, and only the
// programs and cohorts the release offers can be picked (A7).
const locale = useLocale();
const route = useRoute();
const router = useRouter();
const toast = useToast();
const m = useMessages(ONBOARDING_MESSAGES);

const STEPS = 4;
const step = ref(0);
const { program, cohort, goal, status, reload, saving, saveFailed, apiErrors, otherErrors, goalErrors, save } = useOnboardingForm((answers) => {
  step.value = resumeStep(answers);
});
// The names of the programs. Without them the offered codes still show, so onboarding never waits on this list.
const { choices } = usePrograms();
const offered = computed(() => choices.value.filter((choice) => choice.offered));
const notOffered = computed(() => choices.value.filter((choice) => !choice.offered));
const cohorts = computed(() => choices.value.find((choice) => choice.code === program.value)?.cohorts ?? []);
const programName = (choice: ProgramChoice) => nameOfProgram(choice, locale.lang);

function pickProgram(code: string): void {
  program.value = code;
  // A cohort belongs to its program; the next step asks it again.
  if (cohort.value !== null && !cohorts.value.includes(cohort.value)) cohort.value = null;
  missing.value = null;
}

const missing = ref<'program' | 'cohort' | null>(null);

const heading = ref<HTMLElement | null>(null);
async function show(next: number): Promise<void> {
  step.value = next;
  await nextTick();
  heading.value?.focus();
}

async function onNext(): Promise<void> {
  if (step.value === 0 && program.value === null) return void (missing.value = 'program');
  if (step.value === 1 && cohort.value === null) return void (missing.value = 'cohort');
  missing.value = null;
  if (step.value === 0) return show(1);
  // The API takes a program only together with its cohort, so saving starts after the cohort.
  if (step.value === 3 && creditsProblem(goal.credits)) return;
  const last = step.value === STEPS - 1;
  if (!(await save(last))) return showRejected();
  if (!last) return show(step.value + 1);
  toast.show(m.value.finished);
  await router.replace(afterSignIn(route.query.redirect));
}

// The step that asks each answer: a refused answer is shown where the student can change it.
const STEP_OF: Record<AnswerField, number> = { program: 0, cohort: 1, finished: 0, targetGraduationTerm: 2, creditsPerTerm: 3, internshipTerm: 3 };
function showRejected(): Promise<void> | void {
  const steps = (Object.keys(apiErrors.value) as AnswerField[]).map((field) => STEP_OF[field]);
  if (steps.length && !steps.includes(step.value)) return show(Math.min(...steps));
}

const goalFields = computed(() => (step.value === 2 ? (['graduation'] as const) : (['credits', 'internship'] as const)));
const question = computed(() => [m.value.programQuestion, m.value.cohortQuestion, m.value.graduationQuestion, m.value.loadQuestion][step.value]);

usePageTitle(() => m.value.title);
</script>

<template>
  <main id="main" class="wizard" tabindex="-1">
    <div class="wizard-top">
      <BrandLink :to="{ name: 'home' }" />
      <ol class="dots" :aria-label="m.steps">
        <li v-for="n in STEPS" :key="n" :class="{ on: n - 1 === step, done: n - 1 < step }">
          <span class="sr-only">{{ m.stepNames[n - 1] }}</span>
        </li>
      </ol>
      <div class="wizard-tools">
        <ThemeButton icon-only class="btn sm ghost icon-only" />
        <LangButton short class="btn sm ghost" />
        <RouterLink class="btn sm ghost" :to="{ name: 'home' }" data-test="later">{{ m.later }}</RouterLink>
      </div>
    </div>

    <LoadState v-if="status !== 'loaded'" :status="status" :loading="m.loading" :failed="m.loadFailed" :retry="m.retry" @retry="reload" />

    <form v-else class="stack wizard-step" novalidate @submit.prevent="onNext">
      <div>
        <p class="eyebrow" data-test="eyebrow">{{ m.step(step + 1, STEPS, m.stepNames[step]!) }}</p>
        <h1 id="question" ref="heading" class="q" tabindex="-1">{{ question }}</h1>
      </div>

      <template v-if="step === 0">
        <div class="options" role="group" aria-labelledby="question" :aria-describedby="missing === 'program' ? 'missing' : undefined">
          <button
            v-for="choice in offered"
            :key="choice.code"
            type="button"
            :class="['opt', groupClass('core')]"
            :aria-pressed="program === choice.code"
            :data-test="`program-${choice.code}`"
            @click="pickProgram(choice.code)"
          >
            <span class="glyph" aria-hidden="true">&lt;/&gt;</span>
            <b>{{ programName(choice) }}</b>
            <small>{{ choice.code }}</small>
          </button>
        </div>
        <!-- A7: the other programs are named, so a student who does not see theirs knows why. -->
        <details v-if="notOffered.length" class="not-offered" data-test="not-offered">
          <summary>{{ m.otherPrograms(notOffered.length) }}</summary>
          <ul>
            <li v-for="choice in notOffered" :key="choice.code">{{ programName(choice) }} <span class="t3">· {{ choice.code }}</span></li>
          </ul>
        </details>
        <p class="small t3">{{ m.programNote }}</p>
      </template>

      <template v-else-if="step === 1">
        <div class="options" role="group" aria-labelledby="question" :aria-describedby="missing === 'cohort' ? 'missing' : undefined">
          <button
            v-for="year in cohorts"
            :key="year"
            type="button"
            class="opt"
            :aria-pressed="cohort === year"
            :data-test="`cohort-${year}`"
            @click="(cohort = year), (missing = null)"
          >
            <b>{{ m.cohortOption(year) }}</b>
            <small>{{ m.cohortSub(program ?? '', year) }}</small>
          </button>
        </div>
        <p class="small t3">{{ m.cohortNote }}</p>
      </template>

      <template v-else>
        <div class="card">
          <GoalFields
            v-model:graduation="goal.graduation"
            v-model:credits="goal.credits"
            v-model:internship="goal.internship"
            id-prefix="onboarding"
            :fields="[...goalFields]"
            :errors="goalErrors"
          />
        </div>
        <p v-if="step === 2" class="small t3">{{ m.graduationNote }}</p>
      </template>

      <p v-if="missing" id="missing" class="callout bad" role="alert"><Icon name="alert" /><span>{{ missing === 'program' ? m.pickProgram : m.pickCohort }}</span></p>
      <div v-if="otherErrors.length" class="callout bad" role="alert" data-test="rejected">
        <Icon name="alert" />
        <div><p>{{ m.rejected }}</p><p v-for="error in otherErrors" :key="error" class="small">{{ error }}</p></div>
      </div>
      <p v-if="saveFailed" class="callout bad" role="alert" data-test="save-failed"><Icon name="alert" /><span>{{ m.saveFailed }}</span></p>

      <div class="wizard-nav">
        <button v-if="step > 0" class="btn" type="button" @click="show(step - 1)"><Icon name="left" size="sm" />{{ m.back }}</button>
        <span v-else />
        <button class="btn primary" type="submit" :disabled="saving">
          {{ saving ? m.saving : step === STEPS - 1 ? m.finish : m.next }}<Icon name="right" size="sm" />
        </button>
      </div>
    </form>
  </main>
</template>

<style>
.wizard { max-width: 860px; margin: 0 auto; display: grid; gap: 26px; padding: 24px 16px 96px; align-content: start; min-height: 100vh; }
.wizard:focus { outline: none; }
.wizard-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.wizard-tools { display: flex; gap: 6px; align-items: center; }
.dots { display: flex; gap: 8px; align-items: center; list-style: none; margin: 0; padding: 0; }
.dots li { height: 6px; width: 6px; border-radius: 999px; background: var(--surface-3); transition: width 0.25s, background 0.25s; }
.dots li.on { width: 24px; background: var(--info); }
.dots li.done { background: var(--acc); }
.eyebrow { font-size: 13px; font-weight: 650; color: var(--ink-3); margin-bottom: 8px; }
.q { font: 700 clamp(28px, 4vw, 42px) / 1.08 var(--display); letter-spacing: -0.03em; }
.q:focus { outline: none; }
.options { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.opt {
  position: relative; text-align: left; padding: 18px; border-radius: 14px; background: var(--surface); color: var(--ink);
  border: 1px solid var(--edge); box-shadow: var(--shadow-sm); cursor: pointer; display: grid; gap: 8px; font: inherit;
}
.opt:hover:not([disabled]) { border-color: var(--edge-strong); }
.opt[aria-pressed='true'] { background: var(--hi); border-color: var(--info); box-shadow: 0 0 0 1px var(--info); }
/* The tick says "chosen" as well as the colour. */
.opt[aria-pressed='true']::after {
  content: '✓'; position: absolute; top: 12px; right: 14px; width: 22px; height: 22px; border-radius: 50%;
  background: var(--info); color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 13px;
}
.opt small { color: var(--ink-2); font-size: 13px; }
.not-offered { font-size: 14px; color: var(--ink-2); }
.not-offered summary { cursor: pointer; font-weight: 600; }
.not-offered ul { margin: 8px 0 0; padding-left: 1.2em; display: grid; gap: 4px; }
.wizard-nav { display: flex; justify-content: space-between; gap: 12px; }
.wizard-nav .btn.primary { min-width: 140px; justify-content: center; }
@media (max-width: 420px) {
  .wizard-top .brand-name { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
}
</style>
