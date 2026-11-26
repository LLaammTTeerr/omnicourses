import { defineStore } from 'pinia';
import { ref } from 'vue';

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
