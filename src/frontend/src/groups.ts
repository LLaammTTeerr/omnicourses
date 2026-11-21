import type { Lang } from './locale.js';
import { fold } from './text-search.js';

// The eight requirement groups of the design (UI prototypes, README "Design direction"). Each has a colour token
// in styles.css (`.g-<id>` sets --c, --on, --c-soft and --c-ink) and a glyph, so colour is never the only cue.
// Every screen that colours by group imports it from here.

export const GROUP_IDS = ['core', 'math', 'phys', 'eng', 'pol', 'gen', 'elec', 'thesis'] as const;
export type GroupId = (typeof GROUP_IDS)[number];

export interface Group {
  id: GroupId;
  glyph: string;
  name: Record<Lang, string>;
  short: Record<Lang, string>;
}

export const GROUPS: readonly Group[] = [
  { id: 'core', glyph: '</>', name: { vi: 'Tin học cốt lõi', en: 'Core computing' }, short: { vi: 'Cốt lõi', en: 'Core' } },
  { id: 'math', glyph: '∑', name: { vi: 'Toán', en: 'Mathematics' }, short: { vi: 'Toán', en: 'Maths' } },
  { id: 'phys', glyph: 'ℏ', name: { vi: 'Vật lý', en: 'Physics' }, short: { vi: 'Vật lý', en: 'Physics' } },
  { id: 'eng', glyph: 'Aa', name: { vi: 'Tiếng Anh', en: 'English' }, short: { vi: 'Anh văn', en: 'English' } },
  { id: 'pol', glyph: '§', name: { vi: 'Lý luận chính trị và pháp luật', en: 'Politics and law' }, short: { vi: 'Chính trị', en: 'Politics' } },
  { id: 'gen', glyph: '&', name: { vi: 'Đại cương và kỹ năng', en: 'General education and skills' }, short: { vi: 'Kỹ năng', en: 'Skills' } },
  { id: 'elec', glyph: '★', name: { vi: 'Tự chọn chuyên ngành', en: 'Major electives' }, short: { vi: 'Tự chọn', en: 'Electives' } },
  { id: 'thesis', glyph: '∎', name: { vi: 'Khóa luận tốt nghiệp', en: 'Graduation thesis' }, short: { vi: 'Khóa luận', en: 'Thesis' } },
];

/** The class that sets a group's colour tokens. */
export const groupClass = (id: GroupId): string => `g-${id}`;

/** A group of the design by id: its glyph, name and short name. */
export const groupOf = (id: GroupId): Group => GROUPS.find((g) => g.id === id)!;

// The API gives a requirement group only its printed heading and kind, so the colour comes from the heading's
// subject. The first rule that matches wins; an unknown heading falls back on its kind.
/** What the colour depends on: a curriculum group, a degree audit group and a plan's coverage group all have it. */
export interface Heading {
  name: string;
  kind: 'compulsory' | 'elective';
}

const COLOUR_RULES: [RegExp, GroupId | ((group: Heading) => GroupId)][] = [
  [/non computer science/, 'gen'],
  [/tot nghiep|graduation|thesis|khoa luan/, 'thesis'],
  [/physics|vat ly/, 'phys'],
  [/math|toan/, 'math'],
  [/english|tieng anh/, 'eng'],
  [/chinh tri|politic|phap luat/, 'pol'],
  [/computer science|tin hoc|cong nghe thong tin/, (group) => (group.kind === 'elective' ? 'elec' : 'core')],
];

/** The design colour and glyph of a requirement group, from its printed heading. Presentation only. */
export function groupColour(group: Heading): GroupId {
  const name = fold(group.name);
  for (const [pattern, colour] of COLOUR_RULES) {
    if (pattern.test(name)) return typeof colour === 'function' ? colour(group) : colour;
  }
  return group.kind === 'elective' ? 'elec' : 'core';
}

/** Groups in the design's order of colours, compulsory before elective, then by heading. */
export function orderGroups<T extends Heading>(groups: readonly T[]): T[] {
  const rank = (group: T) => GROUP_IDS.indexOf(groupColour(group));
  return [...groups].sort((a, b) => rank(a) - rank(b) || (a.kind === b.kind ? 0 : a.kind === 'compulsory' ? -1 : 1) || a.name.localeCompare(b.name, 'vi'));
}
