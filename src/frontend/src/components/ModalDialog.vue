<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useMessages } from '../locale.js';
import { SHELL_MESSAGES } from '../shell/messages.js';

// A modal on the native <dialog>: the browser traps focus inside, makes the page behind it inert, closes it on
// Escape and gives focus back to the button that opened it. The parent owns `open` and must accept `close`, which
// is emitted once per dismissal (Escape, the Android back gesture). While `busy` (a request is out and would still
// go through) the dialog cannot be dismissed and says it is working.
const props = defineProps<{ open: boolean; labelledby: string; describedby?: string; role?: 'dialog' | 'alertdialog'; busy?: boolean }>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>();
const m = useMessages(SHELL_MESSAGES);

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

// Chrome lets a page prevent one `cancel` per user activation (HTML close watchers); a later Escape fires a cancel
// that cannot be prevented, then closes the dialog. Only a cancel the page can stop is reported here: the close
// that follows the other kind is reported by `closed`, so each Escape emits once.
function cancel(event: Event): void {
  event.preventDefault();
  if (event.cancelable && !props.busy) emit('close');
}

// The <dialog> closed. While busy, `closedby="none"` stops Escape and the back gesture where the browser supports
// it; where it does not, the dialog is shown again at once, without telling the parent.
function closed(): void {
  const el = dialog.value;
  // The parent closed it, or this event was queued before a reopen: nothing was dismissed.
  if (!props.open || !el || el.open) return;
  if (!props.busy) {
    emit('close');
    return;
  }
  try {
    sync(true);
  } catch (e) {
    // Cannot be shown (detached): let the parent know it is closed, and report the error through Vue.
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
    :aria-busy="busy ? 'true' : undefined"
    :closedby="busy ? 'none' : undefined"
    @close="closed"
    @cancel="cancel"
  >
    <template v-if="open">
      <slot />
      <!-- Always in the page while open, so the text is announced when it appears. -->
      <p class="modal-status small t2" role="status">{{ busy ? m.working : '' }}</p>
    </template>
  </dialog>
</template>
