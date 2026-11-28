import type { GuideListItem } from './api.js';

function fold(text: string): string {
  return text
    .normalize('NFD')
    .toLowerCase()
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matches(item: GuideListItem, query: string): boolean {
  const q = fold(query);
  if (!q) return true;
  return Object.values(item.texts).some((text) => text !== undefined && [text.title, ...text.keywords].some((s) => fold(s).includes(q)));
}
