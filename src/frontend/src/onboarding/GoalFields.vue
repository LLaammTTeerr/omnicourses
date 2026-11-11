<script setup lang="ts">
import { computed } from 'vue';
import SelectMenu from '../components/SelectMenu.vue';
import { useLocale, useMessages } from '../locale.js';
import { parseTermKey, termKey, termName } from '../terms.js';
import { NO_INTERNSHIP } from './api.js';
import { creditsProblem, goalTermChoices } from './answers.js';
import { GOAL_MESSAGES } from './messages.js';

// The default planning goal (UC-01 step 8): every field optional. The wizard shows it in two steps, settings in one.
// `errors` are the API's messages for a field, shown under it; the credits check runs as the student types.
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
</script>

<template>
  <div class="goal-fields">
    <label v-if="shows('graduation')" class="field">
      <span>{{ m.graduation }}</span>
      <SelectMenu
        :id="id('graduation')"
        v-model="graduation"
        class="goal-select"
        :options="[{ value: '', label: m.notSure }, ...termOptions]"
        :aria-invalid="errorsOf('graduation').length > 0 || undefined"
        :aria-describedby="`${id('graduation')}-hint ${id('graduation')}-error`"
      />
      <small :id="`${id('graduation')}-hint`" class="hint">{{ m.graduationHint }}</small>
      <small v-if="errorsOf('graduation').length" :id="`${id('graduation')}-error`" class="field-error" role="alert">{{ errorsOf('graduation').join(' ') }}</small>
    </label>

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
          :aria-describedby="`${id('credits')}-hint ${id('credits')}-error`"
        />
        <span class="t3">{{ m.creditsUnit }}</span>
      </div>
      <small :id="`${id('credits')}-hint`" class="hint">{{ m.creditsHint }}</small>
      <small v-if="creditsErrors.length" :id="`${id('credits')}-error`" class="field-error" role="alert" data-test="credits-error">{{ creditsErrors.join(' ') }}</small>
    </div>

    <label v-if="shows('internship')" class="field">
      <span>{{ m.internship }}</span>
      <SelectMenu
        :id="id('internship')"
        v-model="internship"
        class="goal-select"
        :options="[{ value: '', label: m.notAnswered }, { value: NO_INTERNSHIP, label: m.noInternship }, ...termOptions]"
        :aria-invalid="errorsOf('internship').length > 0 || undefined"
        :aria-describedby="`${id('internship')}-hint ${id('internship')}-error`"
      />
      <small :id="`${id('internship')}-hint`" class="hint">{{ m.internshipHint }}</small>
      <small v-if="errorsOf('internship').length" :id="`${id('internship')}-error`" class="field-error" role="alert">{{ errorsOf('internship').join(' ') }}</small>
    </label>
  </div>
</template>

<style>
.goal-fields { display: grid; gap: 18px; }
.goal-fields .goal-select { max-width: 320px; }
.goal-fields .field > span, .goal-fields .field > label { font-weight: 650; font-size: 13.5px; }
.goal-fields .hint { font-weight: 400; }
.credits-row { display: flex; align-items: center; gap: 10px; }
.credits-row .input { width: 120px; }
</style>
