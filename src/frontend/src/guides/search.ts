import type { GuideListItem } from './api.js';

/** Text as search compares it: no diacritics, đ as d, lower case, single spaces (UC-10 step 3). */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .toLowerCase()
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when the query appears in the title or a keyword of any language the guide has. An empty query matches every guide. */
export function matches(item: GuideListItem, query: string): boolean {
  const q = fold(query);
  if (!q) return true;
  return Object.values(item.texts).some((text) => text !== undefined && [text.title, ...text.keywords].some((s) => fold(s).includes(q)));
}
