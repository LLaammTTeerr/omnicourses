<script setup lang="ts">
import ModalDialog from '../components/ModalDialog.vue';
import { useMessages } from '../locale.js';
import Icon from '../shell/Icon.vue';
import { ADMIN_MESSAGES } from './messages.js';
import type { ProblemView } from './problem.js';
import ProblemNote from './ProblemNote.vue';

defineProps<{ open: boolean; title: string; body: string; confirm: string; busy: boolean; problem: ProblemView | null }>();
const emit = defineEmits<{ close: []; confirm: []; reload: [] }>();
const m = useMessages(ADMIN_MESSAGES);
</script>

<template>
  <ModalDialog :open="open" role="alertdialog" labelledby="admin-confirm-title" describedby="admin-confirm-body" :busy="busy" data-test="confirm-dialog" @close="emit('close')">
    <span class="ic" aria-hidden="true"><Icon name="trash" /></span>
    <h2 id="admin-confirm-title">{{ title }}</h2>
    <p id="admin-confirm-body" class="t2">{{ body }}</p>
    <ProblemNote :problem="problem" @reload="emit('reload')" />
    <div class="acts">
      <button class="btn" type="button" autofocus :disabled="busy" data-test="confirm-no" @click="emit('close')">{{ m.cancel }}</button>
      <button class="btn danger" type="button" :disabled="busy || problem?.reload" data-test="confirm-yes" @click="emit('confirm')">{{ confirm }}</button>
    </div>
  </ModalDialog>
</template>
