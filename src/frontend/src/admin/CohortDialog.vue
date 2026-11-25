<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import ModalDialog from '../components/ModalDialog.vue';
import { useMessages } from '../locale.js';
import { SHELL_MESSAGES } from '../shell/messages.js';
import type { CohortDetails } from './api.js';
import FieldErrors from './FieldErrors.vue';
import { cohortValues, type CohortField, type CohortValues } from './forms.js';
import { ADMIN_MESSAGES } from './messages.js';
import type { ProblemView } from './problem.js';
import ProblemNote from './ProblemNote.vue';

// A cohort of one program (UC-11 A1, "Thêm khóa" in admin.html), to add one or to edit one. A new cohort is a new,
// empty curriculum: no group is copied, and no other cohort changes. The year and the code cannot change once
// created, and there is no box for the credit total: the API accepts none (ADR 0011). The form checks nothing.
const props = defineProps<{ open: boolean; programCode: string; cohort: CohortDetails | null; busy: boolean; problem: ProblemView<CohortField> | null }>();
const emit = defineEmits<{ close: []; save: [values: CohortValues]; reload: [] }>();
const m = useMessages(ADMIN_MESSAGES);
const shell = useMessages(SHELL_MESSAGES);
const text = computed(() => m.value.programs);

const values = reactive<CohortValues>(cohortValues(null));
watch(
  () => props.open,
  (open) => {
    if (open) Object.assign(values, cohortValues(props.cohort));
  },
  { immediate: true },
);

const TEXT_FIELDS = ['nameVi', 'nameEn', 'language'] as const;
const hintOf: Partial<Record<CohortField, string>> = { cohortYear: 'cohort-cohortYear-hint', code: 'cohort-code-hint', nameEn: 'cohort-nameEn-hint', language: 'cohort-language-hint' };
const described = (field: CohortField) =>
  [props.cohort && (field === 'cohortYear' || field === 'code') ? 'cohort-identity-hint' : hintOf[field], props.problem?.fields[field] && `cohort-${field}-error`].filter(Boolean).join(' ') ||
  undefined;
const invalid = (field: CohortField) => (props.problem?.fields[field] ? 'true' : undefined);
</script>

<template>
  <ModalDialog :open="open" labelledby="cohort-dialog-title" :busy="busy" :busy-text="shell.working" data-test="cohort-dialog" @close="emit('close')">
    <h2 id="cohort-dialog-title">{{ cohort ? text.cohortEdit(programCode, cohort.cohortYear) : text.cohortNew(programCode) }}</h2>
    <form class="admin-form" novalidate @submit.prevent="emit('save', { ...values })">
      <div class="cohort-identity">
        <div class="field">
          <label for="cohort-cohortYear">{{ text.cohortFields.cohortYear }}</label>
          <input
            id="cohort-cohortYear"
            v-model="values.cohortYear"
            class="input"
            inputmode="numeric"
            autocomplete="off"
            :readonly="cohort !== null"
            :autofocus="cohort === null"
            data-test="cohort-cohortYear"
            :aria-invalid="invalid('cohortYear')"
            :aria-describedby="described('cohortYear')"
          />
          <p v-if="!cohort" id="cohort-cohortYear-hint" class="hint">{{ text.cohortYearHint }}</p>
          <FieldErrors id="cohort-cohortYear-error" :errors="problem?.fields.cohortYear" />
        </div>
        <div class="field">
          <label for="cohort-code">{{ text.cohortFields.code }}</label>
          <input
            id="cohort-code"
            v-model="values.code"
            class="input mono"
            autocomplete="off"
            spellcheck="false"
            :readonly="cohort !== null"
            data-test="cohort-code"
            :aria-invalid="invalid('code')"
            :aria-describedby="described('code')"
          />
          <p v-if="!cohort" id="cohort-code-hint" class="hint">{{ text.cohortCodeHint }}</p>
          <FieldErrors id="cohort-code-error" :errors="problem?.fields.code" />
        </div>
      </div>
      <p v-if="cohort" id="cohort-identity-hint" class="hint">{{ text.identityFixed }}</p>
      <div v-for="field in TEXT_FIELDS" :key="field" class="field">
        <label :for="`cohort-${field}`">{{ text.cohortFields[field] }}</label>
        <input
          :id="`cohort-${field}`"
          v-model="values[field]"
          class="input"
          autocomplete="off"
          :lang="field === 'nameEn' ? 'en' : undefined"
          :autofocus="cohort !== null && field === 'nameVi'"
          :data-test="`cohort-${field}`"
          :aria-invalid="invalid(field)"
          :aria-describedby="described(field)"
        />
        <p v-if="field === 'nameEn'" id="cohort-nameEn-hint" class="hint">{{ text.blankHint }}</p>
        <p v-if="field === 'language'" id="cohort-language-hint" class="hint">{{ text.languageHint }}</p>
        <FieldErrors :id="`cohort-${field}-error`" :errors="problem?.fields[field]" />
      </div>
      <p class="hint" data-test="cohort-not-here">{{ text.cohortNotHere }}</p>
      <ProblemNote :problem="problem" @reload="emit('reload')" />
      <div class="acts">
        <button class="btn" type="button" :disabled="busy" data-test="dialog-cancel" @click="emit('close')">{{ m.cancel }}</button>
        <button class="btn primary" type="submit" :disabled="busy || problem?.reload" data-test="dialog-save">{{ busy ? m.saving : m.save }}</button>
      </div>
    </form>
  </ModalDialog>
</template>

<style>
.cohort-identity { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; align-items: start; }
</style>
