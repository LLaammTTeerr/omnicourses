<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

const props = defineProps<{ open: boolean; labelledby: string; describedby?: string; role?: 'dialog' | 'alertdialog'; busy?: boolean; busyText?: string }>();
const emit = defineEmits<{ close: [] }>();
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
      <p v-if="busyText" class="small t2" :class="{ 'sr-only': !busy }" role="status">{{ busy ? busyText : '' }}</p>
    </template>
  </dialog>
</template>
