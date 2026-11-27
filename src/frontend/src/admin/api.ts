import { segment } from '../api.js';
import { requestAsUser } from '../auth/store.js';
import { CALENDAR_EVENT_KINDS, type AcademicCalendar, type CalendarEvent, type CalendarEventKind, type CalendarProgram } from '../calendar/api.js';
import type { Course, RequirementGroupKind, TrainingType } from '../curriculum/api.js';
import type { GlobalPermission, PermissionKind, UserGrants } from './grants.js';

export { CALENDAR_EVENT_KINDS, type AcademicCalendar, type CalendarEvent, type CalendarEventKind, type CalendarProgram };

export interface AdminCurriculum {
  id: string;
  code: string;
  cohortYear: number;
}

export interface AdminProgram {
  id: string;
  code: string;
  nameVi: string;
  curricula: AdminCurriculum[];
}

export interface AdminProgramList {
  programs: AdminProgram[];
}

export interface CohortRef {
  programId: string;
  curriculumId: string;
}

export interface CreateProgramBody {
  code: string;
  nameVi: string;
  nameEn?: string | null;
  faculty?: string | null;
}

export interface UpdateProgramBody {
  nameVi?: string;
  nameEn?: string | null;
  faculty?: string | null;
}

export interface ProgramDetails {
  id: string;
  code: string;
  nameVi: string;
  nameEn: string | null;
  faculty: string | null;
  trainingType: TrainingType | null;
  updatedAt: string;
}

export interface CreateCohortBody {
  cohortYear: number;
  code: string;
  nameVi: string;
  nameEn?: string | null;
  language?: string | null;
}

export interface UpdateCohortBody {
  nameVi?: string;
  nameEn?: string | null;
  language?: string | null;
}

export interface CohortDetails {
  id: string;
  programId: string;
  cohortYear: number;
  code: string;
  nameVi: string;
  nameEn: string | null;
  language: string | null;
  totalCreditsMin: number | null;
  updatedAt: string;
}

export interface CohortList {
  cohorts: CohortDetails[];
}

export interface CreateGroupBody {
  name: string;
  kind: RequirementGroupKind;
  officialNotes?: string | null;
}

export interface UpdateGroupBody {
  name?: string;
  kind?: RequirementGroupKind;
  officialNotes?: string | null;
}

export interface AdminGroup {
  id: string;
  curriculumId: string;
  name: string;
  kind: RequirementGroupKind;
  officialNotes: string | null;
  creditsTotal: number | null;
  creditsTotalMin: number | null;
  updatedAt: string;
}

export interface SetPrerequisitesBody {
  prerequisites: string[];
}

export interface Prerequisites {
  courseCode: string;
  prerequisites: string[] | null;
}

export interface SetOfferingTermsBody {
  terms: number[];
}

export interface OfferingTerms {
  courseCode: string;
  terms: number[] | null;
}

export interface CreateCourseBody {
  code: string;
  nameVi: string;
  nameEn?: string | null;
  credits: number;
  theoryPeriods?: number | null;
  labPeriods?: number | null;
  exercisePeriods?: number | null;
  projectPeriods?: number | null;
}

export interface UpdateCourseBody {
  nameVi?: string;
  nameEn?: string | null;
  credits?: number;
  theoryPeriods?: number | null;
  labPeriods?: number | null;
  exercisePeriods?: number | null;
  projectPeriods?: number | null;
  confirmImpact?: string;
}

export type Entered<T> = { [K in keyof T]: T[K] | string | null };

export interface AccessProgram {
  id: string;
  code: string;
  nameVi: string;
}

export interface AccessProgramList {
  programs: AccessProgram[];
}

export const IMPORT_FILE_TYPES = ['catalog_courses', 'group_links'] as const;
export type ImportFileType = (typeof IMPORT_FILE_TYPES)[number];

export const IMPORT_HEADERS: Record<ImportFileType, readonly string[]> = {
  catalog_courses: ['code', 'name_vi', 'name_en', 'credits', 'theory_periods', 'lab_periods', 'exercise_periods', 'project_periods'],
  group_links: ['requirement_group_name', 'course_code'],
};

export const BYTES_PER_KIB = 1024;
export const BYTES_PER_MIB = 1024 * BYTES_PER_KIB;

export const IMPORT_MAX_BYTES = BYTES_PER_MIB;
export const IMPORT_MAX_RECORDS = 1000;
export const SIGNED_OUT_BODY_MAX_KIB = 100;

export interface ImportPreviewBody {
  csv: string;
}

export interface ImportConfirmBody {
  csv: string;
  reviewVersion: string;
}

export interface ImportRowError {
  record: number;
  field: string | null;
  message: string;
}

export interface ImportSummary {
  inserts: number;
  updates: number;
  noOps: number;
}

export interface CatalogImportRow extends Course {
  record: number;
  action: 'insert' | 'update' | 'no_op';
  changedFields: (keyof Course)[];
  current: Course | null;
  affectedCurricula: AffectedCurriculum[];
}

export interface GroupLinkImportRow {
  record: number;
  action: 'insert' | 'no_op';
  requirementGroupName: string;
  requirementGroupId: string;
  courseCode: string;
}

interface ImportPreviewBase {
  errors: ImportRowError[];
  summary: ImportSummary;
  reviewVersion: string | null;
}

export interface CatalogImportPreview extends ImportPreviewBase {
  fileType: 'catalog_courses';
  rows: CatalogImportRow[];
  affectedCurricula: AffectedCurriculum[];
}

export interface GroupLinkImportPreview extends ImportPreviewBase {
  fileType: 'group_links';
  programId: string;
  curriculumId: string;
  rows: GroupLinkImportRow[];
}

export type ImportPreview = CatalogImportPreview | GroupLinkImportPreview;

export interface ImportResult {
  fileType: ImportFileType;
  summary: ImportSummary;
}

export interface AdminErrorBody {
  statusCode: number;
  code: string;
  message: string | string[];
}

export interface PermissionRequiredBody extends AdminErrorBody {
  permission: PermissionKind;
}

export interface PrerequisiteCycleBody extends AdminErrorBody {
  cycle: string[];
}

export interface ReferencedItemBody extends AdminErrorBody {
  references: string[];
}

export interface AffectedCurriculum {
  curriculumId: string;
  curriculumCode: string;
  programCode: string;
  cohortYear: number;
}

export interface ImportRejectedBody extends AdminErrorBody {
  errors?: ImportRowError[];
}

export interface ImpactConfirmationBody extends AdminErrorBody {
  affectedCurricula: AffectedCurriculum[];
  reviewVersion: string;
}

export type CalendarTerm = 1 | 2 | 3;

export interface CreateCalendarEventBody {
  academicYear: number;
  term?: CalendarTerm | null;
  kind: CalendarEventKind;
  startsOn: string;
  endsOn?: string;
  title: string;
  titleEn?: string | null;
  sourceUrl?: string | null;
  notes?: string | null;
}

export interface UpdateCalendarEventBody {
  academicYear?: number;
  term?: CalendarTerm | null;
  kind?: CalendarEventKind;
  startsOn?: string;
  endsOn?: string;
  title?: string;
  titleEn?: string | null;
  sourceUrl?: string | null;
  notes?: string | null;
}

const cohortPath = (cohort: CohortRef) => `/admin/programs/${segment(cohort.programId)}/cohorts/${segment(cohort.curriculumId)}`;
const groupPath = (cohort: CohortRef, groupId: string) => `${cohortPath(cohort)}/requirement-groups/${segment(groupId)}`;
const rulePath = (cohort: CohortRef, courseCode: string) => `${cohortPath(cohort)}/courses/${segment(courseCode)}`;
const userPath = (userId: string) => `/admin/access/users/${segment(userId)}`;
const calendarEventsPath = (programId: string) => `/admin/programs/${segment(programId)}/calendar-events`;

export const fetchAdminPrograms = () => requestAsUser<AdminProgramList>('GET', '/admin/programs');

export const createProgram = (body: Entered<CreateProgramBody>) => requestAsUser<ProgramDetails>('POST', '/admin/programs', { body });
export const updateProgram = (programId: string, body: Entered<UpdateProgramBody>) =>
  requestAsUser<ProgramDetails>('PATCH', `/admin/programs/${segment(programId)}`, { body });
export const fetchCohorts = (programId: string) => requestAsUser<CohortList>('GET', `/admin/programs/${segment(programId)}/cohorts`);
export const createCohort = (programId: string, body: Entered<CreateCohortBody>) =>
  requestAsUser<CohortDetails>('POST', `/admin/programs/${segment(programId)}/cohorts`, { body });
export const fetchCohort = (cohort: CohortRef) => requestAsUser<CohortDetails>('GET', cohortPath(cohort));
export const updateCohort = (cohort: CohortRef, body: Entered<UpdateCohortBody>) => requestAsUser<CohortDetails>('PATCH', cohortPath(cohort), { body });

export const createGroup = (cohort: CohortRef, body: Entered<CreateGroupBody>) =>
  requestAsUser<AdminGroup>('POST', `${cohortPath(cohort)}/requirement-groups`, { body });
export const updateGroup = (cohort: CohortRef, groupId: string, body: Entered<UpdateGroupBody>) =>
  requestAsUser<AdminGroup>('PATCH', groupPath(cohort, groupId), { body });
export const deleteGroup = (cohort: CohortRef, groupId: string) => requestAsUser<void>('DELETE', groupPath(cohort, groupId));

export const linkCourse = (cohort: CohortRef, groupId: string, courseCode: string) =>
  requestAsUser<void>('PUT', `${groupPath(cohort, groupId)}/courses/${segment(courseCode)}`);
export const unlinkCourse = (cohort: CohortRef, groupId: string, courseCode: string) =>
  requestAsUser<void>('DELETE', `${groupPath(cohort, groupId)}/courses/${segment(courseCode)}`);

export const setPrerequisites = (cohort: CohortRef, courseCode: string, prerequisites: string[]) =>
  requestAsUser<Prerequisites>('PUT', `${rulePath(cohort, courseCode)}/prerequisites`, { body: { prerequisites } satisfies SetPrerequisitesBody });
export const clearPrerequisites = (cohort: CohortRef, courseCode: string) =>
  requestAsUser<Prerequisites>('DELETE', `${rulePath(cohort, courseCode)}/prerequisites`);

export const setOfferingTerms = (cohort: CohortRef, courseCode: string, terms: number[]) =>
  requestAsUser<OfferingTerms>('PUT', `${rulePath(cohort, courseCode)}/offering-terms`, { body: { terms } satisfies SetOfferingTermsBody });
export const clearOfferingTerms = (cohort: CohortRef, courseCode: string) =>
  requestAsUser<OfferingTerms>('DELETE', `${rulePath(cohort, courseCode)}/offering-terms`);

export const createCourse = (body: Entered<CreateCourseBody>) => requestAsUser<Course>('POST', '/admin/catalog/courses', { body });
export const updateCourse = (courseCode: string, body: Entered<UpdateCourseBody>) =>
  requestAsUser<Course>('PATCH', `/admin/catalog/courses/${segment(courseCode)}`, { body });
export const deleteCourse = (courseCode: string) => requestAsUser<void>('DELETE', `/admin/catalog/courses/${segment(courseCode)}`);

export const fetchAccessPrograms = () => requestAsUser<AccessProgramList>('GET', '/admin/access/programs');
export const fetchUserGrants = (userId: string) => requestAsUser<UserGrants>('GET', `${userPath(userId)}/grants`);
export const grantProgram = (userId: string, programId: string) =>
  requestAsUser<UserGrants>('PUT', `${userPath(userId)}/programs/${segment(programId)}`);
export const revokeProgram = (userId: string, programId: string) =>
  requestAsUser<UserGrants>('DELETE', `${userPath(userId)}/programs/${segment(programId)}`);
export const grantGlobal = (userId: string, permission: GlobalPermission) =>
  requestAsUser<UserGrants>('PUT', `${userPath(userId)}/global/${segment(permission)}`);
export const revokeGlobal = (userId: string, permission: GlobalPermission) =>
  requestAsUser<UserGrants>('DELETE', `${userPath(userId)}/global/${segment(permission)}`);

export const previewCatalogImport = (csv: string) =>
  requestAsUser<CatalogImportPreview>('POST', '/admin/catalog/imports/preview', { body: { csv } satisfies ImportPreviewBody });
export const confirmCatalogImport = (csv: string, reviewVersion: string) =>
  requestAsUser<ImportResult>('POST', '/admin/catalog/imports/confirm', { body: { csv, reviewVersion } satisfies ImportConfirmBody });
export const previewLinkImport = (cohort: CohortRef, csv: string) =>
  requestAsUser<GroupLinkImportPreview>('POST', `${cohortPath(cohort)}/imports/preview`, { body: { csv } satisfies ImportPreviewBody });
export const confirmLinkImport = (cohort: CohortRef, csv: string, reviewVersion: string) =>
  requestAsUser<ImportResult>('POST', `${cohortPath(cohort)}/imports/confirm`, { body: { csv, reviewVersion } satisfies ImportConfirmBody });

export const fetchProgramCalendar = (programCode: string) =>
  requestAsUser<AcademicCalendar>('GET', `/academic-calendar?program=${encodeURIComponent(programCode)}`);
export const createCalendarEvent = (programId: string, body: Entered<CreateCalendarEventBody>) =>
  requestAsUser<CalendarEvent>('POST', calendarEventsPath(programId), { body });
export const updateCalendarEvent = (programId: string, eventId: string, body: Entered<UpdateCalendarEventBody>) =>
  requestAsUser<CalendarEvent>('PATCH', `${calendarEventsPath(programId)}/${segment(eventId)}`, { body });
export const deleteCalendarEvent = (programId: string, eventId: string) =>
  requestAsUser<void>('DELETE', `${calendarEventsPath(programId)}/${segment(eventId)}`);
