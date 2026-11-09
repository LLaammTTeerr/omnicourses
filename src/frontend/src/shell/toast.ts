import { defineStore } from 'pinia';
import { ref } from 'vue';

// One short message at the bottom of the screen, read out by screen readers (ToastHost.vue is the live region).

export const TOAST_MS = 6000;

export const useToast = defineStore('toast', () => {
  const message = ref('');
  let timer: ReturnType<typeof setTimeout> | undefined;

  function show(text: string): void {
    message.value = text;
    clearTimeout(timer);
    timer = setTimeout(() => (message.value = ''), TOAST_MS);
  }

  return { message, show };
});
