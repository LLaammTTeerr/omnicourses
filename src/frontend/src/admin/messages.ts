import type { Lang } from '../locale.js';
import { SHARED_MESSAGES, type SharedMessages } from './messages/shared.js';
import { CURRICULUM_MESSAGES, type CurriculumMessages } from './messages/curriculum.js';
import { CATALOG_MESSAGES, type CatalogMessages } from './messages/catalog.js';
import { ACCESS_MESSAGES, type AccessMessages } from './messages/access.js';
import { PROGRAMS_MESSAGES, type ProgramMessages } from './messages/programs.js';
import { IMPORT_MESSAGES, type ImportMessages } from './messages/import.js';
import { CALENDAR_MESSAGES, type CalendarAdminMessages } from './messages/calendar.js';

export interface AdminMessages extends SharedMessages {
  curriculum: CurriculumMessages;
  catalog: CatalogMessages;
  access: AccessMessages;
  programs: ProgramMessages;
  import: ImportMessages;
  calendar: CalendarAdminMessages;
}

export const ADMIN_MESSAGES: Record<Lang, AdminMessages> = {
  vi: {
    ...SHARED_MESSAGES.vi,
    curriculum: CURRICULUM_MESSAGES.vi,
    catalog: CATALOG_MESSAGES.vi,
    access: ACCESS_MESSAGES.vi,
    programs: PROGRAMS_MESSAGES.vi,
    import: IMPORT_MESSAGES.vi,
    calendar: CALENDAR_MESSAGES.vi,
  },
  en: {
    ...SHARED_MESSAGES.en,
    curriculum: CURRICULUM_MESSAGES.en,
    catalog: CATALOG_MESSAGES.en,
    access: ACCESS_MESSAGES.en,
    programs: PROGRAMS_MESSAGES.en,
    import: IMPORT_MESSAGES.en,
    calendar: CALENDAR_MESSAGES.en,
  },
};

export type AdminText = AdminMessages;
