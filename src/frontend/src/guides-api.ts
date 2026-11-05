import { API_URL } from './api.js';
import type { Lang } from './locale.js';

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
  texts: Partial<Record<Lang, GuideListText>>;
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
  texts: Partial<Record<Lang, GuideText>>;
}

export class GuideNotFoundError extends Error {
  constructor(id: string) {
    super(`No guide ${id}`);
    this.name = 'GuideNotFoundError';
  }
}

/** Every published guide (ADR 0010: no sign-in, so no token is sent). */
export async function fetchGuides(): Promise<GuideListItem[]> {
  const res = await fetch(`${API_URL}/guides`);
  if (!res.ok) throw new Error(`GET /guides failed: ${res.status}`);
  return ((await res.json()) as { guides: GuideListItem[] }).guides;
}

export async function fetchGuide(id: string): Promise<Guide> {
  const res = await fetch(`${API_URL}/guides/${encodeURIComponent(id)}`);
  if (res.status === 404) throw new GuideNotFoundError(id);
  if (!res.ok) throw new Error(`GET /guides/${id} failed: ${res.status}`);
  return (await res.json()) as Guide;
}
