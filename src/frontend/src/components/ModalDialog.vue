<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';

// A modal on the native <dialog>: the browser traps focus inside, makes the page behind it inert, closes it on
// Escape and gives focus back to the button that opened it. The parent owns `open`; Escape or `close` emits it.
const props = defineProps<{ open: boolean; labelledby: string; describedby?: string; role?: 'dialog' | 'alertdialog' }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>();

function sync(open: boolean): void {
  const el = dialog.value;
  if (!el || open === el.open) return;
  // jsdom (unit tests) has no showModal: the attribute alone shows the content there.
  if (open) (typeof el.showModal === 'function' ? el.showModal() : el.setAttribute('open', ''));
  else if (typeof el.close === 'function') el.close();
  else el.removeAttribute('open');
}

// After the render, so showModal finds the content and focuses its first control (or the one with autofocus).
watch(() => props.open, sync, { flush: 'post' });
onMounted(() => sync(props.open));

// The browser closed the dialog (Escape) and the parent was told. A parent that keeps `open` true (a request still
// out) gets the dialog shown again: Chrome lets a page prevent only one Escape per user activation, so `cancel`
// alone cannot hold it open, and `open` would no longer change for the watch above to show it.
function closed(): void {
  if (!props.open) return;
  emit('close');
  void nextTick(() => sync(props.open));
}
</script>

<template>
  <dialog
    ref="dialog"
    class="modal"
    :role="role"
    :aria-labelledby="labelledby"
    :aria-describedby="describedby"
    @close="closed"
    @cancel.prevent="emit('close')"
  >
    <slot v-if="open" />
  </dialog>
</template>
