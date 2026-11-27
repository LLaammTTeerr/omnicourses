import type { Lang } from './locale.js';

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

const groupOf = (id: GroupId): Group => GROUPS.find((group) => group.id === id)!;

export const groupGlyph = (id: GroupId): string => groupOf(id).glyph;

export const groupShort = (id: GroupId, lang: Lang): string => groupOf(id).short[lang];

export const groupClass = (id: GroupId): string => `g-${id}`;
