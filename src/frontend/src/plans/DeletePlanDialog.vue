<script setup lang="ts">
import ModalDialog from '../components/ModalDialog.vue';
import { useMessages } from '../locale.js';
import { COMMON_MESSAGES } from '../messages.js';
import Icon from '../shell/Icon.vue';
import { PLANNER_MESSAGES } from './messages.js';

// Asks before a plan is deleted, from the plans list or the tabs above the editor. The name sits on its own lines
// under the question, at most three of them, so a long name (or one with no spaces) wraps instead of widening the
// dialog; the whole name is in its tooltip. Busy: Keep is disabled and Escape refused, as the deletion still goes through.
defineProps<{ open: boolean; name: string; busy: boolean; error: string | null }>();
const emit = defineEmits<{ close: []; confirm: [] }>();
const m = useMessages(PLANNER_MESSAGES);
const common = useMessages(COMMON_MESSAGES);
</script>

<template>
  <ModalDialog
    :open="open"
    role="alertdialog"
    labelledby="delete-plan-title"
    describedby="delete-plan-body"
    :busy="busy"
    :busy-text="common.working"
    @close="emit('close')"
  >
    <span class="ic" aria-hidden="true"><Icon name="trash" /></span>
    <h2 id="delete-plan-title">{{ m.deletePlanTitle }}</h2>
    <p class="plan-quote" :title="name" data-test="delete-name">{{ name }}</p>
    <p id="delete-plan-body" class="t2">{{ m.deleteBody }}</p>
    <p v-if="error" class="callout bad small" role="alert"><Icon name="alert" size="sm" /><span>{{ error }}</span></p>
    <div class="acts">
      <button class="btn" type="button" autofocus :disabled="busy" @click="emit('close')">{{ m.keep }}</button>
      <button class="btn danger" type="button" data-test="confirm-delete" :disabled="busy" @click="emit('confirm')">
        <Icon name="trash" size="sm" />{{ busy ? m.deleting : m.delete }}
      </button>
    </div>
  </ModalDialog>
</template>

<style>
.plan-quote {
  padding: 10px 12px; border-radius: 10px; background: var(--surface-2); font-weight: 650; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden;
}
</style>
