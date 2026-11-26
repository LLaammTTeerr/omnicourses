import type { Lang } from '../locale.js';
import { GUIDE_LANGS, type GuideLang, type GuideTexts } from './api.js';

interface PickedText<T> {
  text: T;
  lang: GuideLang;
  fallback: boolean;
}

export function pickText<T>(texts: GuideTexts<T>, screen: Lang): PickedText<T> | null {
  for (const lang of [screen, ...GUIDE_LANGS]) {
    const text = texts[lang];
    if (text !== undefined) return { text, lang, fallback: lang !== screen };
  }
  return null;
}
