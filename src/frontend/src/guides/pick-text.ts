import type { Lang } from '../locale.js';

export interface PickedText<T> {
  text: T;
  /** The language of `text`. */
  lang: Lang;
  /** True when the guide lacks the screen language and shows its other one (UC-10 A8). */
  fallback: boolean;
}

/** The text in the screen language, or else the one language the guide has. */
export function pickText<T>(texts: Partial<Record<Lang, T>>, lang: Lang): PickedText<T> | null {
  const own = texts[lang];
  if (own !== undefined) return { text: own, lang, fallback: false };
  const other: Lang = lang === 'vi' ? 'en' : 'vi';
  const theirs = texts[other];
  return theirs !== undefined ? { text: theirs, lang: other, fallback: true } : null;
}
