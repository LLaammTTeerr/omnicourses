import { defineStore } from 'pinia';
import { ref, watchEffect } from 'vue';
import { readStored, writeStored } from '../storage.js';

// Light and dark themes (UI prototypes). index.html applies the saved theme before the first paint, with the same
// key and default; this store owns it afterwards.

export type Theme = 'light' | 'dark';

// Kept in students' browsers: a new key forgets every saved choice. index.html repeats it.
export const THEME_STORAGE_KEY = 'omnicourse.theme';

function initialTheme(): Theme {
  const saved = readStored(THEME_STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  // No choice yet: follow the system.
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const useTheme = defineStore('theme', () => {
  const theme = ref<Theme>(initialTheme());

  function set(next: Theme): void {
    theme.value = next;
    writeStored(THEME_STORAGE_KEY, next);
  }

  function toggle(): void {
    set(theme.value === 'dark' ? 'light' : 'dark');
  }

  watchEffect(() => {
    document.documentElement.dataset.theme = theme.value;
  });

  return { theme, set, toggle };
});
