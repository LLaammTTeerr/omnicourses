import { defineStore } from 'pinia';
import { computed, ref, watchEffect, type ComputedRef } from 'vue';
import { readStored, writeStored } from './storage.js';

// The screen language (Vision §6 Usability: Vietnamese and English).

interface Language {
  /** BCP 47 tag for Intl. */
  tag: string;
  /** The language's own name, for the switch button. */
  name: string;
  /** The language the switch button offers. */
  other: Lang;
  date: Intl.DateTimeFormatOptions;
}

export type Lang = 'vi' | 'en';

export const LANGUAGES: Record<Lang, Language> = {
  vi: { tag: 'vi-VN', name: 'Tiếng Việt', other: 'en', date: { day: '2-digit', month: '2-digit', year: 'numeric' } },
  en: { tag: 'en-GB', name: 'English', other: 'vi', date: { day: 'numeric', month: 'short', year: 'numeric' } },
};

// Kept in students' browsers: a new key forgets every saved choice.
const LANG_STORAGE_KEY = 'omnicourse.lang';

function isLang(value: string | null): value is Lang {
  return value !== null && Object.hasOwn(LANGUAGES, value);
}

/** The language chosen last on this browser; Vietnamese at first, or when storage is blocked. */
function storedLang(): Lang {
  const value = readStored(LANG_STORAGE_KEY);
  return isLang(value) ? value : 'vi';
}

export const useLocale = defineStore('locale', () => {
  const lang = ref<Lang>(storedLang());

  function set(next: Lang): void {
    lang.value = next;
    writeStored(LANG_STORAGE_KEY, next);
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

/** An instant (ISO date-time) as each language writes it, in the browser's time zone: 13/11/2026 14:05, 13 Nov 2026, 14:05. */
export function formatDateTime(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(LANGUAGES[lang].tag, { ...LANGUAGES[lang].date, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

/** A YYYY-MM-DD date as each language writes it: 13/11/2026, 13 Nov 2026. */
export function formatDate(isoDate: string, lang: Lang): string {
  // A calendar date, not an instant: format it in UTC so no time zone moves it.
  return new Intl.DateTimeFormat(LANGUAGES[lang].tag, { ...LANGUAGES[lang].date, timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`));
}

/** A name in the language on screen: the English one in English when there is one, else the Vietnamese one. */
export const localName = (named: { nameVi: string; nameEn: string | null }, lang: Lang): string => (lang === 'en' && named.nameEn) || named.nameVi;

/** The name in the language not on screen, if there is one: a course's other name, shown under the first. */
export const otherName = (named: { nameVi: string; nameEn: string | null }, lang: Lang): string | null => (lang === 'en' ? named.nameVi : named.nameEn);

const numberFormats = new Map<string, Intl.NumberFormat>();

/** A number as the language writes it, to `maxDigits` decimals at most: 7,5 or 7.5. */
export function formatNumber(value: number, lang: Lang, maxDigits: number): string {
  const key = `${lang} ${maxDigits}`;
  let format = numberFormats.get(key);
  if (!format) numberFormats.set(key, (format = new Intl.NumberFormat(LANGUAGES[lang].tag, { maximumFractionDigits: maxDigits })));
  return format.format(value);
}
