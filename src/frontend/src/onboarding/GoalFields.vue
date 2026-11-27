<script setup lang="ts">
import { computed } from 'vue';
import SelectMenu from '../components/SelectMenu.vue';
import { useLocale, useMessages } from '../locale.js';
import { parseTermKey, termKey, termName } from '../terms.js';
import { NO_INTERNSHIP } from './api.js';
import { creditsProblem, goalTermChoices } from './answers.js';
import { GOAL_MESSAGES } from './messages.js';

type Field = 'graduation' | 'credits' | 'internship';

const props = withDefaults(defineProps<{ fields?: Field[]; idPrefix: string; errors?: Partial<Record<Field, string[]>> }>(), {
  fields: () => ['graduation', 'credits', 'internship'],
  errors: () => ({}),
});
const graduation = defineModel<string>('graduation', { required: true });
const credits = defineModel<string>('credits', { required: true });
const internship = defineModel<string>('internship', { required: true });

const locale = useLocale();
const m = useMessages(GOAL_MESSAGES);
const terms = computed(() => goalTermChoices([parseTermKey(graduation.value), parseTermKey(internship.value)]));
const termOptions = computed(() => terms.value.map((term) => ({ value: termKey(term), label: termName(term, locale.lang) })));
const creditsCheck = computed(() => creditsProblem(credits.value));
const shows = (field: Field) => props.fields.includes(field);
const id = (field: Field) => `${props.idPrefix}-${field}`;
const errorsOf = (field: Field) => props.errors[field] ?? [];
const creditsErrors = computed(() => (creditsCheck.value ? [m.value.creditsProblems[creditsCheck.value]] : errorsOf('credits')));
const describedBy = (field: Field, hasError: boolean) => (hasError ? `${id(field)}-hint ${id(field)}-error` : `${id(field)}-hint`);
</script>

<template>
  <div class="goal-fields">
    <div v-if="shows('graduation')" class="field">
      <span class="label">{{ m.graduation }}</span>
      <SelectMenu
        :id="id('graduation')"
        v-model="graduation"
        class="goal-select"
        :aria-label="m.graduation"
        :options="[{ value: '', label: m.notSure }, ...termOptions]"
        :aria-invalid="errorsOf('graduation').length > 0 || undefined"
        :aria-describedby="describedBy('graduation', errorsOf('graduation').length > 0)"
      />
      <small :id="`${id('graduation')}-hint`" class="hint">{{ m.graduationHint }}</small>
      <small v-if="errorsOf('graduation').length" :id="`${id('graduation')}-error`" class="field-error" role="alert">{{ errorsOf('graduation').join(' ') }}</small>
    </div>

    <div v-if="shows('credits')" class="field">
      <label :for="id('credits')">{{ m.credits }}</label>
      <div class="credits-row">
        <input
          :id="id('credits')"
          v-model="credits"
          class="input"
          inputmode="numeric"
          autocomplete="off"
          :aria-invalid="creditsErrors.length > 0 || undefined"
          :aria-describedby="describedBy('credits', creditsErrors.length > 0)"
        />
        <span class="t3">{{ m.creditsUnit }}</span>
      </div>
      <small :id="`${id('credits')}-hint`" class="hint">{{ m.creditsHint }}</small>
      <small v-if="creditsErrors.length" :id="`${id('credits')}-error`" class="field-error" role="alert" data-test="credits-error">{{ creditsErrors.join(' ') }}</small>
    </div>

    <div v-if="shows('internship')" class="field">
      <span class="label">{{ m.internship }}</span>
      <SelectMenu
        :id="id('internship')"
        v-model="internship"
        class="goal-select"
        :aria-label="m.internship"
        :options="[{ value: '', label: m.notAnswered }, { value: NO_INTERNSHIP, label: m.noInternship }, ...termOptions]"
        :aria-invalid="errorsOf('internship').length > 0 || undefined"
        :aria-describedby="describedBy('internship', errorsOf('internship').length > 0)"
      />
      <small :id="`${id('internship')}-hint`" class="hint">{{ m.internshipHint }}</small>
      <small v-if="errorsOf('internship').length" :id="`${id('internship')}-error`" class="field-error" role="alert">{{ errorsOf('internship').join(' ') }}</small>
    </div>
  </div>
</template>

<style scoped>
.goal-fields { display: grid; gap: 18px; }
.goal-fields .goal-select { max-width: 320px; }
.goal-fields .field > span, .goal-fields .field > label { font-weight: 650; font-size: 13.5px; }
.goal-fields .hint { font-weight: 400; }
.credits-row { display: flex; align-items: center; gap: 10px; }
.credits-row .input { width: 120px; }
</style>
