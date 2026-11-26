<script setup lang="ts">
import { ref, watch } from 'vue';
import ModalDialog from '../components/ModalDialog.vue';
import type { CurriculumCourse } from '../curriculum/api.js';
import { useMessages } from '../locale.js';
import { SHELL_MESSAGES } from '../shell/messages.js';
import FieldErrors from './FieldErrors.vue';
import type { PrerequisiteChoice } from './forms.js';
import { ADMIN_MESSAGES } from './messages.js';
import type { ProblemView } from './problem.js';
import ProblemNote from './ProblemNote.vue';

const STATES = ['not_recorded', 'none', 'list'] as const;

const props = defineProps<{ open: boolean; course: CurriculumCourse | null; busy: boolean; problem: ProblemView<'prerequisites'> | null }>();
const emit = defineEmits<{ close: []; save: [choice: PrerequisiteChoice]; reload: [] }>();
const m = useMessages(ADMIN_MESSAGES);
const shell = useMessages(SHELL_MESSAGES);

const state = ref<(typeof STATES)[number]>('not_recorded');
const text = ref('');
const needCodes = ref(false);
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    const recorded = props.course?.prerequisites ?? null;
    state.value = recorded === null ? 'not_recorded' : recorded.length === 0 ? 'none' : 'list';
    text.value = recorded?.join(', ') ?? '';
    needCodes.value = false;
  },
  { immediate: true },
);

const label = (value: (typeof STATES)[number]) => ({ not_recorded: m.value.curriculum.stateNotRecorded, none: m.value.curriculum.stateNone, list: m.value.curriculum.stateList })[value];

function save(): void {
  if (state.value !== 'list') return emit('save', { state: state.value });
  const codes = text.value.split(/[\s,;]+/).filter(Boolean);
  needCodes.value = codes.length === 0;
  if (!needCodes.value) emit('save', { state: 'list', codes });
}
</script>

<template>
  <ModalDialog :open="open" labelledby="prerequisites-title" describedby="prerequisites-lead" :busy="busy" :busy-text="shell.working" data-test="prerequisites-dialog" @close="emit('close')">
    <h2 id="prerequisites-title">{{ course ? m.curriculum.prerequisitesTitle(course.code) : '' }}</h2>
    <p id="prerequisites-lead" class="t2 small">{{ m.curriculum.prerequisitesLead }}</p>
    <form class="admin-form" novalidate @submit.prevent="save">
      <fieldset class="field admin-choices">
        <legend>{{ m.curriculum.prerequisitesLegend }}</legend>
        <label v-for="option in STATES" :key="option" class="check">
          <input v-model="state" type="radio" name="prerequisite-state" :value="option" :data-test="`prerequisite-state-${option}`" />{{ label(option) }}
        </label>
      </fieldset>
      <div v-if="state === 'list'" class="field">
        <label for="prerequisite-codes">{{ m.curriculum.prerequisiteCodes }}</label>
        <input
          id="prerequisite-codes"
          v-model="text"
          class="input mono"
          autocomplete="off"
          spellcheck="false"
          placeholder="CS161, MTH251"
          data-test="prerequisite-codes"
          :aria-invalid="needCodes || problem?.fields.prerequisites ? 'true' : undefined"
          :aria-describedby="['prerequisite-codes-hint', needCodes && 'prerequisite-codes-needed', problem?.fields.prerequisites && 'prerequisite-codes-error'].filter(Boolean).join(' ')"
        />
        <p id="prerequisite-codes-hint" class="hint">{{ m.curriculum.prerequisiteCodesHint }}</p>
        <p v-if="needCodes" id="prerequisite-codes-needed" class="field-error" role="alert" data-test="prerequisite-codes-needed">{{ m.curriculum.prerequisiteCodesNeeded }}</p>
        <FieldErrors id="prerequisite-codes-error" :errors="problem?.fields.prerequisites" />
      </div>
      <ProblemNote :problem="problem" @reload="emit('reload')" />
      <div class="acts">
        <button class="btn" type="button" :disabled="busy" data-test="dialog-cancel" @click="emit('close')">{{ m.cancel }}</button>
        <button class="btn primary" type="submit" :disabled="busy || problem?.reload" data-test="dialog-save">{{ busy ? m.saving : m.save }}</button>
      </div>
    </form>
  </ModalDialog>
</template>
