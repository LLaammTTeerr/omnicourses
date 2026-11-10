import { GROUP_IDS, type GroupId } from '../groups.js';
import type { Lang } from '../locale.js';
import type { RequirementGroup } from './api.js';

// How the explorer shows curriculum data: colours, order and search. Presentation only. None of it decides what a
// student must take or has passed; that is the rule engine's (AGENTS.md hard rule 1).

/** A course's name in the language on screen; in Vietnamese when it has no English name. */
export const courseName = (course: { nameVi: string; nameEn: string | null }, lang: Lang): string => (lang === 'en' && course.nameEn) || course.nameVi;

/** Lower case without Vietnamese diacritics, so "hoc may" finds "Học máy" (as the prototype searches). */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
}

/** True when every word of the query appears in the text, ignoring case and diacritics. */
export function matches(query: string, ...texts: (string | null)[]): boolean {
  const haystack = fold(texts.filter(Boolean).join(' '));
  return fold(query).split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}

// The API gives a group only its printed heading and kind, so the colour comes from the heading's subject. The first
// rule that matches wins; an unknown heading falls back on its kind.
const COLOUR_RULES: [RegExp, GroupId | ((group: RequirementGroup) => GroupId)][] = [
  [/non computer science/, 'gen'],
  [/tot nghiep|graduation|thesis|khoa luan/, 'thesis'],
  [/physics|vat ly/, 'phys'],
  [/math|toan/, 'math'],
  [/english|tieng anh/, 'eng'],
  [/chinh tri|politic|phap luat/, 'pol'],
  [/computer science|tin hoc|cong nghe thong tin/, (group) => (group.kind === 'elective' ? 'elec' : 'core')],
];

/** The design colour and glyph of a requirement group (groups.ts), from its printed heading. */
export function groupColour(group: RequirementGroup): GroupId {
  const name = fold(group.name);
  for (const [pattern, colour] of COLOUR_RULES) {
    if (pattern.test(name)) return typeof colour === 'function' ? colour(group) : colour;
  }
  return group.kind === 'elective' ? 'elec' : 'core';
}

/** Groups in the design's order of colours, compulsory before elective, then by heading. */
export function orderGroups(groups: readonly RequirementGroup[]): RequirementGroup[] {
  const rank = (group: RequirementGroup) => GROUP_IDS.indexOf(groupColour(group));
  return [...groups].sort((a, b) => rank(a) - rank(b) || (a.kind === b.kind ? 0 : a.kind === 'compulsory' ? -1 : 1) || a.name.localeCompare(b.name, 'vi'));
}
