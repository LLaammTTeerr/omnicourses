import { defineStore } from 'pinia';
import { ref, watchEffect } from 'vue';

// Light and dark themes (UI prototypes). index.html applies the saved theme before the first paint, with the same
// key and default; this store owns it afterwards.

export type Theme = 'light' | 'dark';

// Kept in students' browsers: a new key forgets every saved choice. index.html repeats it.
export const THEME_STORAGE_KEY = 'omnicourse.theme';

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  // No choice yet: follow the system.
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const useTheme = defineStore('theme', () => {
  const theme = ref<Theme>(initialTheme());

  function set(next: Theme): void {
    theme.value = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
  }

  function toggle(): void {
    set(theme.value === 'dark' ? 'light' : 'dark');
  }

  watchEffect(() => {
    document.documentElement.dataset.theme = theme.value;
  });

  return { theme, set, toggle };
});
