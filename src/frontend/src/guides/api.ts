import { getJson, HttpError } from '../api.js';

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

// The languages a guide can be published in. The screen languages are locale.ts's.
export const GUIDE_LANGS = ['vi', 'en'] as const;
export type GuideLang = (typeof GUIDE_LANGS)[number];
/** Only the languages the guide is published in (UC-10 A8). */
export type GuideTexts<T> = Partial<Record<GuideLang, T>>;

export interface GuideLink {
  label: string;
  /** An https address, or an OmniCourse path starting with /. */
  url: string;
}

export interface GuidePortal {
  name: string;
  url: string;
  account: string;
}

export interface GuideListText {
  title: string;
  keywords: string[];
  portal: GuidePortal;
  version: number;
  lastCheckedOn: string;
  outOfDate: boolean;
}

export interface GuideListItem {
  id: string;
  group: GuideGroup;
  texts: GuideTexts<GuideListText>;
}

export type GuideNoteSource = { kind: 'regulation'; document: string; clause: string; url: string } | { kind: 'team' };

export interface GuideText extends GuideListText {
  changeNote: string;
  lastCheckedBy: string;
  summary: string;
  when: { text: string; announcement?: GuideLink };
  appliesTo: string;
  prepare: { text: string; link?: GuideLink }[];
  steps: { text: string; link?: GuideLink }[];
  notes: { text: string; source: GuideNoteSource }[];
  citations: { document: string; clause: string; url: string }[];
  ifPortalDown: string | null;
  related: GuideLink[];
  portals: (GuidePortal & { purpose: string })[];
}

export interface Guide {
  id: string;
  group: GuideGroup;
  texts: GuideTexts<GuideText>;
}

/** Every published guide (ADR 0010: no sign-in, so no token is sent). */
export async function fetchGuides(): Promise<GuideListItem[]> {
  return (await getJson<{ guides: GuideListItem[] }>('/guides')).guides;
}

/** The published guide with this id, or null when there is none. */
export async function fetchGuide(id: string): Promise<Guide | null> {
  try {
    return await getJson<Guide>(`/guides/${encodeURIComponent(id)}`);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return null;
    throw e;
  }
}
