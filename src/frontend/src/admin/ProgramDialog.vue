<script setup lang="ts">
import { computed } from 'vue';
import ModalDialog from '../components/ModalDialog.vue';
import { useMessages } from '../locale.js';
import FieldErrors from './FieldErrors.vue';
import { programValues, useValuesOnOpen, type ProgramField, type ProgramValues, type SavedProgram } from './forms.js';
import { ADMIN_MESSAGES } from './messages.js';
import { fieldDescription, fieldInvalid, type ProblemView } from './problem.js';
import ProblemNote from './ProblemNote.vue';

const props = defineProps<{ open: boolean; program: SavedProgram | null; busy: boolean; problem: ProblemView<ProgramField> | null }>();
const emit = defineEmits<{ close: []; save: [values: ProgramValues]; reload: [] }>();
const m = useMessages(ADMIN_MESSAGES);
const text = computed(() => m.value.programs);

const values = useValuesOnOpen(() => props.open, () => programValues(props.program));

const TEXT_FIELDS = ['nameVi', 'nameEn', 'faculty'] as const;
const hints: Partial<Record<ProgramField, 'blank'>> = { nameEn: 'blank', faculty: 'blank' };
const described = (field: ProgramField, hint?: string) => fieldDescription(props.problem, 'program', field, hint);
const invalid = (field: ProgramField) => fieldInvalid(props.problem, field);
</script>

<template>
  <ModalDialog :open="open" labelledby="program-dialog-title" :busy="busy" data-test="program-dialog" @close="emit('close')">
    <h2 id="program-dialog-title">{{ program ? text.programEdit(program.code) : text.programNew }}</h2>
    <form class="admin-form" novalidate @submit.prevent="emit('save', { ...values })">
      <div class="field">
        <label for="program-code">{{ text.fields.code }}</label>
        <input
          id="program-code"
          v-model="values.code"
          class="input mono"
          autocomplete="off"
          spellcheck="false"
          :readonly="program !== null"
          :autofocus="program === null"
          data-test="program-code"
          :aria-invalid="invalid('code')"
          :aria-describedby="described('code', 'program-code-hint')"
        />
        <p id="program-code-hint" class="hint">{{ program ? text.codeFixed : text.codeHint }}</p>
        <FieldErrors id="program-code-error" :errors="problem?.fields.code" />
      </div>
      <div v-for="field in TEXT_FIELDS" :key="field" class="field">
        <label :for="`program-${field}`">{{ text.fields[field] }}</label>
        <input
          :id="`program-${field}`"
          v-model="values[field]"
          class="input"
          autocomplete="off"
          :lang="field === 'nameEn' ? 'en' : undefined"
          :autofocus="program !== null && field === 'nameVi'"
          :data-test="`program-${field}`"
          :aria-invalid="invalid(field)"
          :aria-describedby="described(field, hints[field] ? `program-${field}-hint` : undefined)"
        />
        <p v-if="hints[field]" :id="`program-${field}-hint`" class="hint">{{ text.blankHint }}</p>
        <FieldErrors :id="`program-${field}-error`" :errors="problem?.fields[field]" />
      </div>
      <p class="hint" data-test="program-not-here">{{ text.programNotHere }}</p>
      <ProblemNote :problem="problem" @reload="emit('reload')" />
      <div class="acts">
        <button class="btn" type="button" :disabled="busy" data-test="dialog-cancel" @click="emit('close')">{{ m.cancel }}</button>
        <button class="btn primary" type="submit" :disabled="busy || problem?.reload" data-test="dialog-save">{{ busy ? m.saving : m.save }}</button>
      </div>
    </form>
  </ModalDialog>
</template>
