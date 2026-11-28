import { formatSpan, type Lang } from '../locale.js';
import type { CalendarEventKind } from './api.js';

interface Titled {
  title: string;
  titleEn: string | null;
}

interface Spanned {
  startsOn: string;
  endsOn: string;
}

export const EVENT_KIND_GROUP: Record<CalendarEventKind, string> = {
  term_start: 'g-core',
  term_end: 'g-core',
  registration: 'g-elec',
  add_drop: 'g-elec',
  exam_period: 'g-pol',
  holiday: 'g-gen',
  other: 'g-thesis',
};

export const eventTitle = (event: Titled, lang: Lang): string => (lang === 'en' && event.titleEn ? event.titleEn : event.title);

export const otherEventTitle = (event: Titled, lang: Lang): string | null => (lang === 'en' ? (event.titleEn ? event.title : null) : event.titleEn);

export const spanIn = (event: Spanned, format: (iso: string) => string): string => formatSpan(event.startsOn, event.endsOn, format);
