<script setup lang="ts">
import { ref, watch } from 'vue';
import ModalDialog from '../components/ModalDialog.vue';
import type { CurriculumCourse } from '../curriculum/api.js';
import { useMessages } from '../locale.js';
import { SHELL_MESSAGES } from '../shell/messages.js';
import { TERM_NUMBERS } from '../terms.js';
import FieldErrors from './FieldErrors.vue';
import { ADMIN_MESSAGES } from './messages.js';
import type { ProblemView } from './problem.js';
import ProblemNote from './ProblemNote.vue';

// The offering terms of one course in one cohort (ADR 0011, amended 9 November 2026): term numbers 1 to 3. The
// form opens on what is recorded, so a course with nothing recorded opens with nothing ticked, and saving it
// unticked records nothing. An offering list is never empty: no term ticked means "not recorded" again.
const props = defineProps<{ open: boolean; course: CurriculumCourse | null; busy: boolean; problem: ProblemView<'terms'> | null }>();
const emit = defineEmits<{ close: []; save: [terms: number[]]; reload: [] }>();
const m = useMessages(ADMIN_MESSAGES);
const shell = useMessages(SHELL_MESSAGES);

const ticked = ref<number[]>([]);
watch(
  () => props.open,
  (open) => {
    if (open) ticked.value = [...(props.course?.offeringTerms ?? [])];
  },
  { immediate: true },
);
</script>

<template>
  <ModalDialog :open="open" labelledby="terms-title" describedby="terms-lead" :busy="busy" :busy-text="shell.working" data-test="terms-dialog" @close="emit('close')">
    <h2 id="terms-title">{{ course ? m.curriculum.termsTitle(course.code) : '' }}</h2>
    <p id="terms-lead" class="t2 small">{{ m.curriculum.termsLead }}</p>
    <form class="admin-form" novalidate @submit.prevent="emit('save', TERM_NUMBERS.filter((term) => ticked.includes(term)))">
      <fieldset class="field admin-choices" :aria-describedby="['terms-hint', problem?.fields.terms && 'terms-error'].filter(Boolean).join(' ')">
        <legend>{{ m.curriculum.termsLegend }}</legend>
        <label v-for="term in TERM_NUMBERS" :key="term" class="check">
          <input v-model="ticked" type="checkbox" :value="term" :data-test="`term-${term}`" />{{ m.curriculum.term(term) }}
        </label>
        <p id="terms-hint" class="hint">{{ m.curriculum.termsHint }}</p>
        <FieldErrors id="terms-error" :errors="problem?.fields.terms" />
      </fieldset>
      <ProblemNote :problem="problem" @reload="emit('reload')" />
      <div class="acts">
        <button class="btn" type="button" :disabled="busy" data-test="dialog-cancel" @click="emit('close')">{{ m.cancel }}</button>
        <button class="btn primary" type="submit" :disabled="busy || problem?.reload" data-test="dialog-save">{{ busy ? m.saving : m.save }}</button>
      </div>
    </form>
  </ModalDialog>
</template>
