export const GUIDE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const GUIDE_ID_MAX = 64;

export const GUIDE_LANGS = ['vi', 'en'] as const;
export type GuideLang = (typeof GUIDE_LANGS)[number];

export const GUIDE_STATUSES = ['draft', 'published', 'withdrawn'] as const;
export type GuideStatus = (typeof GUIDE_STATUSES)[number];

export const GUIDE_GROUPS = [
  'accounts-and-portals',
  'registration',
  'timetable-and-exams',
  'tuition-and-fees',
  'records-and-certificates',
  'scholarships',
  'internship-and-thesis',
  'graduation',
] as const;
export type GuideGroup = (typeof GUIDE_GROUPS)[number];

export interface GuideLink {
  label: string;
  url: string;
}

export interface GuideCitation {
  document: string;
  clause: string;
  url: string;
}

type GuideNoteSource = ({ kind: 'regulation' } & GuideCitation) | { kind: 'team' };

export interface GuideFile {
  id: string;
  lang: GuideLang;
  status: GuideStatus;
  version: number;
  changeNote: string;
  lastChecked: { on: string; by: string } | null;
  group: GuideGroup;
  title: string;
  keywords: string[];
  summary: string;
  when: { text: string; announcement?: GuideLink };
  appliesTo: string;
  portal: { name: string; url: string; account: string };
  prepare?: { text: string; link?: GuideLink }[];
  steps: { text: string; link?: GuideLink }[];
  notes?: { text: string; source: GuideNoteSource }[];
  citations?: GuideCitation[];
  ifPortalDown?: string;
  related?: GuideLink[];
  portals?: { name: string; url: string; account: string; purpose: string }[];
}

export const textKey = (text: { id: string; lang: string }): string => `${text.id}.${text.lang}`;

const COLUMN_FIELDS = ['id', 'lang', 'status', 'version', 'changeNote', 'lastChecked', 'group', 'title', 'keywords'] as const;

export type GuideContent = Omit<GuideFile, (typeof COLUMN_FIELDS)[number]>;

export function contentOf(file: GuideFile): GuideContent {
  const columns: readonly string[] = COLUMN_FIELDS;
  return Object.fromEntries(Object.entries(file).filter(([field]) => !columns.includes(field))) as GuideContent;
}
