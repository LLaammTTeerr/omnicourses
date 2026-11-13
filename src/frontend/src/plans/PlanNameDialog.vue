<script setup lang="ts">
import { ref, watch } from 'vue';
import ModalDialog from '../components/ModalDialog.vue';
import { useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import { SHELL_MESSAGES } from '../shell/messages.js';
import { PLAN_NAME_MAX_LENGTH } from './api.js';
import { PLANNER_MESSAGES } from './messages.js';

// Asks for a plan's name, to create or rename one. The API trims it and allows 1 to PLAN_NAME_MAX_LENGTH characters.
const MAX_NAME = PLAN_NAME_MAX_LENGTH;

const props = defineProps<{ open: boolean; title: string; body?: string; submit: string; initial: string; busy: boolean; error: string | null }>();
const emit = defineEmits<{ close: []; save: [name: string] }>();
const m = useMessages(PLANNER_MESSAGES);
const shell = useMessages(SHELL_MESSAGES);

const name = ref(props.initial);
const invalid = ref(false);
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    name.value = props.initial;
    invalid.value = false;
  },
);

function save(): void {
  const trimmed = name.value.trim();
  invalid.value = trimmed.length === 0 || trimmed.length > MAX_NAME;
  if (!invalid.value) emit('save', trimmed);
}
</script>

<template>
  <!-- Busy: Cancel is disabled and Escape is refused, since the request would still go through. -->
  <ModalDialog :open="open" labelledby="plan-name-title" :describedby="body ? 'plan-name-body' : undefined" :busy="busy" :busy-text="shell.working" @close="emit('close')">
    <h2 id="plan-name-title">{{ title }}</h2>
    <p v-if="body" id="plan-name-body" class="t2">{{ body }}</p>
    <form class="stack plan-name-form" novalidate @submit.prevent="save">
      <div class="field">
        <label for="plan-name">{{ m.nameLabel }}</label>
        <input
          id="plan-name"
          v-model="name"
          class="input"
          :maxlength="MAX_NAME"
          :placeholder="m.namePlaceholder"
          required
          autofocus
          :aria-invalid="invalid ? 'true' : undefined"
          :aria-describedby="invalid ? 'plan-name-error' : undefined"
        />
        <p v-if="invalid" id="plan-name-error" class="field-error">{{ m.nameRequired }}</p>
      </div>
      <p v-if="error" class="callout bad small" role="alert"><Icon name="alert" size="sm" /><span>{{ error }}</span></p>
      <div class="acts">
        <button class="btn" type="button" :disabled="busy" @click="emit('close')">{{ m.cancel }}</button>
        <button class="btn primary" type="submit" :disabled="busy">{{ submit }}</button>
      </div>
    </form>
  </ModalDialog>
</template>

<style>
.plan-name-form { gap: 14px; }
</style>
