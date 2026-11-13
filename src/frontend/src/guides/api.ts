import { getJson, HttpError } from '../api.js';
import type {
  GuideDto,
  GuideItemDto,
  GuideLinkDto,
  GuideListDto,
  GuideListItemDto,
  GuideListTextDto,
  GuideNoteDto,
  GuideNoteSourceDto,
  GuidePortalDto,
  GuideTextDto,
  GuideTextsDto,
} from '../api-schema/types.gen.js';

// The guide DTOs of the API (ADR 0010), generated from the contract (ADR 0018), and the one place the client is
// stricter than the contract: a note's source.

export type GuideGroup = GuideDto['group'];
/** Guides plan §2, in the order the guides page lists them; api.spec.ts checks that it has every group of the contract. */
export const GUIDE_GROUPS = [
  'accounts-and-portals',
  'registration',
  'timetable-and-exams',
  'tuition-and-fees',
  'records-and-certificates',
  'scholarships',
  'internship-and-thesis',
  'graduation',
] as const satisfies readonly GuideGroup[];

// The languages a guide can be published in, which are not the screen languages (locale.ts).
export type GuideLang = keyof GuideTextsDto;
/** In the order a missing text falls back; api.spec.ts checks that it has every language of the contract. */
export const GUIDE_LANGS = ['vi', 'en'] as const satisfies readonly GuideLang[];
/** Only the languages the guide is published in (UC-10 A8). */
export type GuideTexts<T> = Partial<Record<GuideLang, T>>;

/** `url`: an https address, or an OmniCourse path starting with /. */
export type GuideLink = GuideLinkDto;
export type GuidePortal = GuidePortalDto;
export type GuideListText = GuideListTextDto;
export type GuideListItem = GuideListItemDto;
export type GuideItem = GuideItemDto;

/**
 * Narrower than GuideNoteSourceDto on purpose: the contract has one flat object with optional fields, but the
 * backend's guide validation requires the document, clause and url of a regulation, and a team note has none.
 */
export type GuideNoteSource = { kind: 'regulation'; document: string; clause: string; url: string } | { kind: 'team' };
export type GuideNote = Omit<GuideNoteDto, 'source'> & { source: GuideNoteSource };
export type GuideText = Omit<GuideTextDto, 'notes'> & { notes: GuideNote[] };
export type Guide = Omit<GuideDto, 'texts'> & { texts: GuideTexts<GuideText> };

/** Every published guide (ADR 0010: no sign-in, so no token is sent). */
export async function fetchGuides(): Promise<GuideListItem[]> {
  return (await getJson<GuideListDto>('/guides')).guides;
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
