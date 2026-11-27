<script setup lang="ts">
import { computed } from 'vue';
import ModalDialog from '../components/ModalDialog.vue';
import { useMessages } from '../locale.js';
import { SHELL_MESSAGES } from '../shell/messages.js';
import { TERM_NUMBERS } from '../terms.js';
import { CALENDAR_EVENT_KINDS, type CalendarEvent } from './api.js';
import FieldErrors from './FieldErrors.vue';
import { calendarEventValues, useValuesOnOpen, type CalendarEventField, type CalendarEventValues } from './forms.js';
import { ADMIN_MESSAGES } from './messages.js';
import { fieldDescription, fieldInvalid, type ProblemView } from './problem.js';
import ProblemNote from './ProblemNote.vue';

const props = defineProps<{ open: boolean; event: CalendarEvent | null; busy: boolean; problem: ProblemView<CalendarEventField> | null }>();
const emit = defineEmits<{ close: []; save: [values: CalendarEventValues]; reload: [] }>();
const m = useMessages(ADMIN_MESSAGES);
const shell = useMessages(SHELL_MESSAGES);
const text = computed(() => m.value.calendar);

const values = useValuesOnOpen(() => props.open, () => calendarEventValues(props.event));

const hintOf: Partial<Record<CalendarEventField, string>> = {
  academicYear: 'calendar-academicYear-hint',
  endsOn: 'calendar-endsOn-hint',
  title: 'calendar-title-hint',
  titleEn: 'calendar-titleEn-hint',
  sourceUrl: 'calendar-sourceUrl-hint',
  notes: 'calendar-notes-hint',
};
const described = (field: CalendarEventField) => fieldDescription(props.problem, 'calendar', field, hintOf[field]);
const invalid = (field: CalendarEventField) => fieldInvalid(props.problem, field);
</script>

<template>
  <ModalDialog :open="open" labelledby="calendar-event-dialog-title" :busy="busy" :busy-text="shell.working" data-test="calendar-event-dialog" @close="emit('close')">
    <h2 id="calendar-event-dialog-title">{{ event ? text.dialogEdit(event.title) : text.dialogNew }}</h2>
    <form class="admin-form" novalidate @submit.prevent="emit('save', { ...values })">
      <div class="field">
        <label for="calendar-title">{{ text.fields.title }}</label>
        <input
          id="calendar-title"
          v-model="values.title"
          class="input"
          autocomplete="off"
          autofocus
          data-test="event-title"
          :aria-invalid="invalid('title')"
          :aria-describedby="described('title')"
        />
        <p id="calendar-title-hint" class="hint">{{ text.titleHint }}</p>
        <FieldErrors id="calendar-title-error" :errors="problem?.fields.title" />
      </div>

      <div class="field">
        <label for="calendar-titleEn">{{ text.fields.titleEn }}</label>
        <input
          id="calendar-titleEn"
          v-model="values.titleEn"
          class="input"
          autocomplete="off"
          lang="en"
          data-test="event-titleEn"
          :aria-invalid="invalid('titleEn')"
          :aria-describedby="described('titleEn')"
        />
        <p id="calendar-titleEn-hint" class="hint">{{ text.titleEnHint }}</p>
        <FieldErrors id="calendar-titleEn-error" :errors="problem?.fields.titleEn" />
      </div>

      <div class="calendar-row">
        <div class="field">
          <label for="calendar-kind">{{ text.fields.kind }}</label>
          <select
            id="calendar-kind"
            v-model="values.kind"
            class="select"
            data-test="event-kind-input"
            :aria-invalid="invalid('kind')"
            :aria-describedby="described('kind')"
          >
            <option value="">{{ text.pickKind }}</option>
            <option v-for="option in CALENDAR_EVENT_KINDS" :key="option" :value="option">{{ text.kinds[option] }}</option>
          </select>
          <FieldErrors id="calendar-kind-error" :errors="problem?.fields.kind" />
        </div>

        <div class="field">
          <label for="calendar-term">{{ text.fields.term }}</label>
          <select
            id="calendar-term"
            v-model="values.term"
            class="select"
            data-test="event-term-input"
            :aria-invalid="invalid('term')"
            :aria-describedby="described('term')"
          >
            <option value="">{{ text.wholeYearOption }}</option>
            <option v-for="number in TERM_NUMBERS" :key="number" :value="String(number)">{{ text.termOption(number) }}</option>
          </select>
          <FieldErrors id="calendar-term-error" :errors="problem?.fields.term" />
        </div>
      </div>

      <div class="field">
        <label for="calendar-academicYear">{{ text.fields.academicYear }}</label>
        <input
          id="calendar-academicYear"
          v-model="values.academicYear"
          class="input mono"
          inputmode="numeric"
          autocomplete="off"
          data-test="event-academicYear"
          :aria-invalid="invalid('academicYear')"
          :aria-describedby="described('academicYear')"
        />
        <p id="calendar-academicYear-hint" class="hint">{{ text.academicYearHint }}</p>
        <FieldErrors id="calendar-academicYear-error" :errors="problem?.fields.academicYear" />
      </div>

      <div class="calendar-row">
        <div class="field">
          <label for="calendar-startsOn">{{ text.fields.startsOn }}</label>
          <input
            id="calendar-startsOn"
            v-model="values.startsOn"
            class="input mono"
            type="date"
            data-test="event-startsOn"
            :aria-invalid="invalid('startsOn')"
            :aria-describedby="described('startsOn')"
          />
          <FieldErrors id="calendar-startsOn-error" :errors="problem?.fields.startsOn" />
        </div>

        <div class="field">
          <label for="calendar-endsOn">{{ text.fields.endsOn }}</label>
          <input
            id="calendar-endsOn"
            v-model="values.endsOn"
            class="input mono"
            type="date"
            data-test="event-endsOn"
            :aria-invalid="invalid('endsOn')"
            :aria-describedby="described('endsOn')"
          />
          <p id="calendar-endsOn-hint" class="hint">{{ text.endsOnHint }}</p>
          <FieldErrors id="calendar-endsOn-error" :errors="problem?.fields.endsOn" />
        </div>
      </div>

      <div class="field">
        <label for="calendar-sourceUrl">{{ text.fields.sourceUrl }}</label>
        <input
          id="calendar-sourceUrl"
          v-model="values.sourceUrl"
          class="input mono"
          type="url"
          autocomplete="off"
          spellcheck="false"
          data-test="event-sourceUrl"
          :aria-invalid="invalid('sourceUrl')"
          :aria-describedby="described('sourceUrl')"
        />
        <p id="calendar-sourceUrl-hint" class="hint">{{ text.sourceUrlHint }}</p>
        <FieldErrors id="calendar-sourceUrl-error" :errors="problem?.fields.sourceUrl" />
      </div>

      <div class="field">
        <label for="calendar-notes">{{ text.fields.notes }}</label>
        <textarea
          id="calendar-notes"
          v-model="values.notes"
          class="input"
          rows="3"
          data-test="event-notes-input"
          :aria-invalid="invalid('notes')"
          :aria-describedby="described('notes')"
        ></textarea>
        <p id="calendar-notes-hint" class="hint">{{ text.notesHint }}</p>
        <FieldErrors id="calendar-notes-error" :errors="problem?.fields.notes" />
      </div>

      <ProblemNote :problem="problem" @reload="emit('reload')" />
      <div class="acts">
        <button class="btn" type="button" :disabled="busy" data-test="dialog-cancel" @click="emit('close')">{{ m.cancel }}</button>
        <button class="btn primary" type="submit" :disabled="busy || problem?.reload" data-test="dialog-save">{{ busy ? m.saving : m.save }}</button>
      </div>
    </form>
  </ModalDialog>
</template>

<style scoped>
.calendar-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; align-items: start; }
</style>
