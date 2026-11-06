// The content model of one guide in one language (guides plan §2). The files in
// ./content/ are typed by hand against it, and the seed loads them (ADR 0010).

/** A guide ID: lower-case words joined by hyphens, such as `register-courses`. */
export const GUIDE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const GUIDE_ID_MAX = 64;

export const GUIDE_LANGS = ['vi', 'en'] as const;
export type GuideLang = (typeof GUIDE_LANGS)[number];

export const GUIDE_STATUSES = ['draft', 'published', 'withdrawn'] as const;
export type GuideStatus = (typeof GUIDE_STATUSES)[number];

// Guides plan §2, in the order the guides page lists them.
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

/** A link the guide shows: an https address, or an OmniCourse path such as `/guides/pay-tuition`. */
export interface GuideLink {
  label: string;
  url: string;
}

/** A regulation clause the guide relies on. */
export interface GuideCitation {
  document: string;
  clause: string;
  url: string;
}

/** Where a note comes from: a regulation clause, or the team's experience (guides plan §2 Notes). */
export type GuideNoteSource = ({ kind: 'regulation' } & GuideCitation) | { kind: 'team' };

export interface GuideFile {
  /** Stable short name, such as `register-courses`. Never changes once published. */
  id: string;
  lang: GuideLang;
  /** Only published texts are shown. Drafts are never loaded. */
  status: GuideStatus;
  /** Goes up by one with every published change. */
  version: number;
  /** What changed in this version. */
  changeNote: string;
  /** The day (YYYY-MM-DD) a team member last followed the guide on the real portal, and who. */
  lastChecked: { on: string; by: string } | null;
  group: GuideGroup;
  title: string;
  /** Words a student might search for, in this language. */
  keywords: string[];
  /** What the task is for and who needs to do it, in one or two sentences. */
  summary: string;
  /** When the task is done; term dates are linked, never typed. */
  when: { text: string; announcement?: GuideLink };
  /** All programs, or the programs and cohorts listed. */
  appliesTo: string;
  /** The portal, its direct (deep) link and the account it needs. */
  portal: { name: string; url: string; account: string };
  prepare?: { text: string; link?: GuideLink }[];
  /** Numbered steps; quote the portal's labels as they appear on screen. */
  steps: { text: string; link?: GuideLink }[];
  notes?: { text: string; source: GuideNoteSource }[];
  citations?: GuideCitation[];
  /** Another way to do the task, only when the school publishes one. */
  ifPortalDown?: string;
  related?: GuideLink[];
  /** G01 only: the board of every portal the other guides use. */
  portals?: { name: string; url: string; account: string; purpose: string }[];
}

/** One text of one guide, as the seed and its messages name it: `register-courses.vi`. */
export const textKey = (text: { id: string; lang: string }): string => `${text.id}.${text.lang}`;

// The fields stored in their own guide_texts columns (guide-text.entity.ts).
const COLUMN_FIELDS = ['id', 'lang', 'status', 'version', 'changeNote', 'lastChecked', 'group', 'title', 'keywords'] as const;

/** What a guide page shows besides the fields stored in their own columns: the `content` column. */
export type GuideContent = Omit<GuideFile, (typeof COLUMN_FIELDS)[number]>;

export function contentOf(file: GuideFile): GuideContent {
  const columns: readonly string[] = COLUMN_FIELDS;
  return Object.fromEntries(Object.entries(file).filter(([field]) => !columns.includes(field))) as GuideContent;
}
