import { defineStore } from 'pinia';
import { computed, ref, watchEffect, type ComputedRef } from 'vue';

// The screen language (Vision §6 Usability: Vietnamese and English). Each view keeps its
// own { vi, en } strings and reads them with useMessages.

export const LANGS = ['vi', 'en'] as const;
export type Lang = (typeof LANGS)[number];

const STORAGE_KEY = 'omnicourse.lang';

function storedLang(): Lang {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'en' || value === 'vi' ? value : 'vi';
  } catch {
    // Storage blocked (private mode, site data off): start in Vietnamese.
    return 'vi';
  }
}

export const useLocale = defineStore('locale', () => {
  const lang = ref<Lang>(storedLang());

  function set(next: Lang): void {
    lang.value = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered after a reload, but the switch still works.
    }
  }

  watchEffect(() => {
    document.documentElement.lang = lang.value;
  });

  return { lang, set };
});

/** This view's strings in the screen language. */
export function useMessages<T>(messages: Record<Lang, T>): ComputedRef<T> {
  const locale = useLocale();
  return computed(() => messages[locale.lang]);
}

/** A YYYY-MM-DD date as each language writes it: 13/11/2026, 13 Nov 2026. */
export function formatDate(isoDate: string, lang: Lang): string {
  const options: Intl.DateTimeFormatOptions =
    lang === 'vi' ? { day: '2-digit', month: '2-digit', year: 'numeric' } : { day: 'numeric', month: 'short', year: 'numeric' };
  // A calendar date, not an instant: format it in UTC so no time zone moves it.
  return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-GB', { ...options, timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`));
}
