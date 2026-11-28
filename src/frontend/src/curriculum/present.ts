import { GROUP_IDS, type GroupId } from '../groups.js';
import type { Lang } from '../locale.js';
import type { RequirementGroup } from './api.js';

export const courseName = (course: { nameVi: string; nameEn: string | null }, lang: Lang): string => (lang === 'en' && course.nameEn) || course.nameVi;

export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
}

export function matches(query: string, ...texts: (string | null)[]): boolean {
  const haystack = fold(texts.filter(Boolean).join(' '));
  return fold(query).split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}

type Heading = Pick<RequirementGroup, 'name' | 'kind'>;

const COLOUR_RULES: [RegExp, GroupId | ((group: Heading) => GroupId)][] = [
  [/non computer science/, 'gen'],
  [/tot nghiep|graduation|thesis|khoa luan/, 'thesis'],
  [/physics|vat ly/, 'phys'],
  [/math|toan/, 'math'],
  [/english|tieng anh/, 'eng'],
  [/chinh tri|politic|phap luat/, 'pol'],
  [/computer science|tin hoc|cong nghe thong tin/, (group) => (group.kind === 'elective' ? 'elec' : 'core')],
];

export function groupColour(group: Heading): GroupId {
  const name = fold(group.name);
  for (const [pattern, colour] of COLOUR_RULES) {
    if (pattern.test(name)) return typeof colour === 'function' ? colour(group) : colour;
  }
  return group.kind === 'elective' ? 'elec' : 'core';
}

export function orderGroups<T extends Heading>(groups: readonly T[]): T[] {
  const rank = (group: T) => GROUP_IDS.indexOf(groupColour(group));
  return [...groups].sort((a, b) => rank(a) - rank(b) || (a.kind === b.kind ? 0 : a.kind === 'compulsory' ? -1 : 1) || a.name.localeCompare(b.name, 'vi'));
}
