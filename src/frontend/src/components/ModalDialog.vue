<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useMessages } from '../locale.js';
import { SHELL_MESSAGES } from '../shell/messages.js';

const props = withDefaults(defineProps<{ open: boolean; labelledby: string; describedby?: string; role?: 'dialog' | 'alertdialog'; busy?: boolean; busyText?: string }>(), { busy: undefined });
const emit = defineEmits<{ close: [] }>();
const shell = useMessages(SHELL_MESSAGES);
const busyLabel = computed(() => props.busyText ?? shell.value.working);
const dialog = ref<HTMLDialogElement>();

function sync(open: boolean): void {
  const el = dialog.value;
  if (!el || open === el.open) return;
  if (open) (typeof el.showModal === 'function' ? el.showModal() : el.setAttribute('open', ''));
  else if (typeof el.close === 'function') el.close();
  else el.removeAttribute('open');
}

watch(() => props.open, sync, { flush: 'post' });
onMounted(() => sync(props.open));

function cancel(event: Event): void {
  event.preventDefault();
  if (event.cancelable && !props.busy) emit('close');
}

function closed(): void {
  const el = dialog.value;
  if (!props.open || !el || el.open) return;
  if (!props.busy) {
    emit('close');
    return;
  }
  try {
    sync(true);
  } catch (e) {
    emit('close');
    throw e;
  }
}
</script>

<template>
  <dialog
    ref="dialog"
    class="modal"
    :role="role"
    :aria-labelledby="labelledby"
    :aria-describedby="describedby"
    :closedby="busy ? 'none' : undefined"
    @close="closed"
    @cancel="cancel"
  >
    <template v-if="open">
      <slot />
      <p v-if="busy !== undefined" class="small t2" :class="{ 'sr-only': !busy }" role="status">{{ busy ? busyLabel : '' }}</p>
    </template>
  </dialog>
</template>

<style scoped>
.modal:focus {
  outline: none;
}
</style>
