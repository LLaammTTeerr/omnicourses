<script setup lang="ts">
import ModalDialog from '../components/ModalDialog.vue';
import { REQUIREMENT_GROUP_KINDS, type RequirementGroup } from '../curriculum/api.js';
import { useMessages } from '../locale.js';
import { SHELL_MESSAGES } from '../shell/messages.js';
import FieldErrors from './FieldErrors.vue';
import { groupValues, useValuesOnOpen, type GROUP_FIELDS, type GroupValues } from './forms.js';
import { ADMIN_MESSAGES } from './messages.js';
import { fieldDescription, fieldInvalid, type ProblemView } from './problem.js';
import ProblemNote from './ProblemNote.vue';

const props = defineProps<{ open: boolean; group: RequirementGroup | null; busy: boolean; problem: ProblemView<(typeof GROUP_FIELDS)[number]> | null }>();
const emit = defineEmits<{ close: []; save: [values: GroupValues]; reload: [] }>();
const m = useMessages(ADMIN_MESSAGES);
const shell = useMessages(SHELL_MESSAGES);

const values = useValuesOnOpen(() => props.open, () => groupValues(props.group));
</script>

<template>
  <ModalDialog :open="open" labelledby="group-dialog-title" :busy="busy" :busy-text="shell.working" data-test="group-dialog" @close="emit('close')">
    <h2 id="group-dialog-title">{{ group ? m.curriculum.groupEdit(group.name) : m.curriculum.groupNew }}</h2>
    <form class="admin-form" novalidate @submit.prevent="emit('save', { ...values })">
      <div class="field">
        <label for="group-name">{{ m.curriculum.groupName }}</label>
        <input
          id="group-name"
          v-model="values.name"
          class="input"
          autocomplete="off"
          autofocus
          data-test="group-name"
          :aria-invalid="fieldInvalid(problem, 'name')"
          :aria-describedby="fieldDescription(problem, 'group', 'name', 'group-name-hint')"
        />
        <p id="group-name-hint" class="hint">{{ m.curriculum.groupNameHint }}</p>
        <FieldErrors id="group-name-error" :errors="problem?.fields.name" />
      </div>
      <fieldset class="field admin-choices" :aria-describedby="fieldDescription(problem, 'group', 'kind', 'group-kind-hint')">
        <legend>{{ m.curriculum.groupKind }}</legend>
        <label v-for="option in REQUIREMENT_GROUP_KINDS" :key="option" class="check">
          <input v-model="values.kind" type="radio" name="group-kind" :value="option" :data-test="`group-kind-${option}`" />{{ m.curriculum.kinds[option] }}
        </label>
        <p id="group-kind-hint" class="hint">{{ m.curriculum.groupKindHint }}</p>
        <FieldErrors id="group-kind-error" :errors="problem?.fields.kind" />
      </fieldset>
      <div class="field">
        <label for="group-notes">{{ m.curriculum.groupNotes }}</label>
        <textarea
          id="group-notes"
          v-model="values.officialNotes"
          class="input"
          rows="3"
          data-test="group-notes"
          :aria-invalid="fieldInvalid(problem, 'officialNotes')"
          :aria-describedby="['group-notes-hint', problem?.fields.officialNotes && 'group-notes-error'].filter(Boolean).join(' ')"
        ></textarea>
        <p id="group-notes-hint" class="hint">{{ m.curriculum.groupNotesHint }}</p>
        <FieldErrors id="group-notes-error" :errors="problem?.fields.officialNotes" />
      </div>
      <p class="hint" data-test="group-totals">{{ m.curriculum.totalsReadOnly }}</p>
      <ProblemNote :problem="problem" @reload="emit('reload')" />
      <div class="acts">
        <button class="btn" type="button" :disabled="busy" data-test="dialog-cancel" @click="emit('close')">{{ m.cancel }}</button>
        <button class="btn primary" type="submit" :disabled="busy || problem?.reload" data-test="dialog-save">{{ busy ? m.saving : m.save }}</button>
      </div>
    </form>
  </ModalDialog>
</template>
