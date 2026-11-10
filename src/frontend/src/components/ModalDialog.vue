<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

// A modal on the native <dialog>: the browser traps focus inside, makes the page behind it inert, closes it on
// Escape and gives focus back to the button that opened it. The parent owns `open` and must accept `close`, which
// is emitted once per dismissal (Escape, the Android back gesture). While `busy` (a request is out and would still
// go through) Escape cannot dismiss it, and it says `busyText`, such as "Working…". The back gesture then falls
// through to history back, so a parent that passes `busy` also refuses to leave the route meanwhile.
const props = defineProps<{ open: boolean; labelledby: string; describedby?: string; role?: 'dialog' | 'alertdialog'; busy?: boolean; busyText?: string }>();
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

// Chrome lets a page prevent one `cancel` per user activation (HTML close watchers); a later Escape fires a cancel
// that cannot be prevented, then closes the dialog. Only a cancel the page can stop is reported here: the close
// that follows the other kind is reported by `closed`, so each Escape emits once.
function cancel(event: Event): void {
  event.preventDefault();
  if (event.cancelable && !props.busy) emit('close');
}

// The <dialog> closed. While busy, `closedby="none"` stops Escape in a browser that supports it; in one that does
// not, the dialog is shown again at once, without telling the parent.
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
    :closedby="busy ? 'none' : undefined"
    @close="closed"
    @cancel="cancel"
  >
    <template v-if="open">
      <slot />
      <!-- In the page from the start, so the text is announced when it appears. -->
      <p v-if="busyText" class="small t2" :class="{ 'sr-only': !busy }" role="status">{{ busy ? busyText : '' }}</p>
    </template>
  </dialog>
</template>
