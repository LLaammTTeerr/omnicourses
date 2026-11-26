import { HttpError, request, segment } from '../api.js';

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

export const GUIDE_LANGS = ['vi', 'en'] as const;
export type GuideLang = (typeof GUIDE_LANGS)[number];
export type GuideTexts<T> = Partial<Record<GuideLang, T>>;

export interface GuideLink {
  label: string;
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

export interface GuideItem {
  text: string;
  link?: GuideLink;
}

export type GuideNoteSource = { kind: 'regulation'; document: string; clause: string; url: string } | { kind: 'team' };

export interface GuideText extends GuideListText {
  changeNote: string;
  lastCheckedBy: string;
  summary: string;
  when: { text: string; announcement?: GuideLink };
  appliesTo: string;
  prepare: GuideItem[];
  steps: GuideItem[];
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

export async function fetchGuides(): Promise<GuideListItem[]> {
  return (await request<{ guides: GuideListItem[] }>('GET', '/guides')).guides;
}

export async function fetchGuide(id: string): Promise<Guide | null> {
  try {
    return await request<Guide>('GET', `/guides/${segment(id)}`);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return null;
    throw e;
  }
}
