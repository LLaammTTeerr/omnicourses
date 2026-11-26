import { defineStore } from 'pinia';
import { computed, ref, watchEffect, type ComputedRef } from 'vue';

interface Language {
  tag: string;
  name: string;
  other: Lang;
  date: Intl.DateTimeFormatOptions;
}

export type Lang = 'vi' | 'en';

export const LANGUAGES: Record<Lang, Language> = {
  vi: { tag: 'vi-VN', name: 'Tiếng Việt', other: 'en', date: { day: '2-digit', month: '2-digit', year: 'numeric' } },
  en: { tag: 'en-GB', name: 'English', other: 'vi', date: { day: 'numeric', month: 'short', year: 'numeric' } },
};

export const LANG_STORAGE_KEY = 'omnicourse.lang';

function isLang(value: string | null): value is Lang {
  return value !== null && Object.hasOwn(LANGUAGES, value);
}

function storedLang(): Lang {
  try {
    const value = localStorage.getItem(LANG_STORAGE_KEY);
    return isLang(value) ? value : 'vi';
  } catch {
    return 'vi';
  }
}

export const useLocale = defineStore('locale', () => {
  const lang = ref<Lang>(storedLang());

  function set(next: Lang): void {
    lang.value = next;
    try {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {}
  }

  watchEffect(() => {
    document.documentElement.lang = lang.value;
  });

  return { lang, set };
});

export function useMessages<T>(messages: Record<Lang, T>): ComputedRef<T> {
  const locale = useLocale();
  return computed(() => messages[locale.lang]);
}

export function formatDateTime(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(LANGUAGES[lang].tag, { ...LANGUAGES[lang].date, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

export function formatDate(isoDate: string, lang: Lang): string {
  return new Intl.DateTimeFormat(LANGUAGES[lang].tag, { ...LANGUAGES[lang].date, timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`));
}
