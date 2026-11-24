<script setup lang="ts">
import { ref, watch } from 'vue';
import ModalDialog from '../components/ModalDialog.vue';
import { REQUIREMENT_GROUP_KINDS, type RequirementGroup, type RequirementGroupKind } from '../curriculum/api.js';
import { useMessages } from '../locale.js';
import { SHELL_MESSAGES } from '../shell/messages.js';
import FieldErrors from './FieldErrors.vue';
import type { GROUP_FIELDS, GroupValues } from './forms.js';
import { ADMIN_MESSAGES } from './messages.js';
import type { ProblemView } from './problem.js';
import ProblemNote from './ProblemNote.vue';

// A requirement group's name, kind and notes, to create one or edit one (ADR 0011). The form checks nothing: it
// hands over what was typed, and the API's refusals show under the fields they name. Credit totals are shown only,
// since the API does not take them yet. Cancel discards the draft and sends nothing (UC-11 A6).
const props = defineProps<{ open: boolean; group: RequirementGroup | null; busy: boolean; problem: ProblemView<(typeof GROUP_FIELDS)[number]> | null }>();
const emit = defineEmits<{ close: []; save: [values: GroupValues]; reload: [] }>();
const m = useMessages(ADMIN_MESSAGES);
const shell = useMessages(SHELL_MESSAGES);

const name = ref('');
const kind = ref<RequirementGroupKind | ''>('');
const notes = ref('');
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    name.value = props.group?.name ?? '';
    kind.value = props.group?.kind ?? '';
    notes.value = props.group?.officialNotes ?? '';
  },
  { immediate: true },
);

const described = (...ids: (string | false | undefined)[]) => ids.filter(Boolean).join(' ') || undefined;
</script>

<template>
  <ModalDialog :open="open" labelledby="group-dialog-title" :busy="busy" :busy-text="shell.working" data-test="group-dialog" @close="emit('close')">
    <h2 id="group-dialog-title">{{ group ? m.curriculum.groupEdit(group.name) : m.curriculum.groupNew }}</h2>
    <form class="admin-form" novalidate @submit.prevent="emit('save', { name, kind, officialNotes: notes })">
      <div class="field">
        <label for="group-name">{{ m.curriculum.groupName }}</label>
        <input
          id="group-name"
          v-model="name"
          class="input"
          autocomplete="off"
          autofocus
          data-test="group-name"
          :aria-invalid="problem?.fields.name ? 'true' : undefined"
          :aria-describedby="described('group-name-hint', problem?.fields.name && 'group-name-error')"
        />
        <p id="group-name-hint" class="hint">{{ m.curriculum.groupNameHint }}</p>
        <FieldErrors id="group-name-error" :errors="problem?.fields.name" />
      </div>
      <fieldset class="field admin-choices" :aria-describedby="described('group-kind-hint', problem?.fields.kind && 'group-kind-error')">
        <legend>{{ m.curriculum.groupKind }}</legend>
        <label v-for="option in REQUIREMENT_GROUP_KINDS" :key="option" class="check">
          <input v-model="kind" type="radio" name="group-kind" :value="option" :data-test="`group-kind-${option}`" />{{ m.curriculum.kinds[option] }}
        </label>
        <p id="group-kind-hint" class="hint">{{ m.curriculum.groupKindHint }}</p>
        <FieldErrors id="group-kind-error" :errors="problem?.fields.kind" />
      </fieldset>
      <div class="field">
        <label for="group-notes">{{ m.curriculum.groupNotes }}</label>
        <textarea
          id="group-notes"
          v-model="notes"
          class="input"
          rows="3"
          data-test="group-notes"
          :aria-invalid="problem?.fields.officialNotes ? 'true' : undefined"
          :aria-describedby="described('group-notes-hint', problem?.fields.officialNotes && 'group-notes-error')"
        ></textarea>
        <p id="group-notes-hint" class="hint">{{ m.curriculum.groupNotesHint }}</p>
        <FieldErrors id="group-notes-error" :errors="problem?.fields.officialNotes" />
      </div>
      <p class="hint" data-test="group-totals">{{ m.curriculum.totalsReadOnly }}</p>
      <ProblemNote :problem="problem" @reload="emit('reload')" />
      <div class="acts">
        <button class="btn" type="button" :disabled="busy" data-test="dialog-cancel" @click="emit('close')">{{ m.cancel }}</button>
        <button class="btn primary" type="submit" :disabled="busy" data-test="dialog-save">{{ busy ? m.saving : m.save }}</button>
      </div>
    </form>
  </ModalDialog>
</template>
