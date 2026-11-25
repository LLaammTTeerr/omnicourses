import { request } from '../api.js';
import type { Course, RequirementGroupKind } from '../curriculum/api.js';
import { segment } from '../path-segment.js';

// The F12 administration DTOs of the API (ADR 0011), written by hand; api.spec.ts checks them, and every address
// called here, against src/backend/openapi.json. The API decides every permission and every value: these calls
// send what the administrator entered and return what the API answers.

export const GLOBAL_PERMISSIONS = ['catalog_maintainer', 'access_manager'] as const;
export type GlobalPermission = (typeof GLOBAL_PERMISSIONS)[number];
/** The three independent grants (ADR 0011): none implies another. A 403 names the one the caller lacks. */
export const PERMISSION_KINDS = ['program_admin', ...GLOBAL_PERMISSIONS] as const;
export type PermissionKind = (typeof PERMISSION_KINDS)[number];

// ---- Grants ----------------------------------------------------------------------------------------------------

export interface ProgramGrant {
  programId: string;
  programCode: string;
  grantedAt: string;
  /** Who granted it; null for the bootstrap or a purged account. */
  grantedBy: string | null;
}

export interface GlobalGrant {
  permission: GlobalPermission;
  grantedAt: string;
  grantedBy: string | null;
}

export interface UserGrants {
  userId: string;
  /** By program code. */
  programs: ProgramGrant[];
  /** By permission. */
  permissions: GlobalGrant[];
}

// ---- Programs the caller administers ---------------------------------------------------------------------------

export interface AdminCurriculum {
  id: string;
  code: string;
  cohortYear: number;
}

export interface AdminProgram {
  id: string;
  code: string;
  nameVi: string;
  /** Its cohorts, oldest first. */
  curricula: AdminCurriculum[];
}

export interface AdminProgramList {
  programs: AdminProgram[];
}

/** The program and cohort a curriculum write names in its address; the API checks that they belong together. */
export interface CohortRef {
  programId: string;
  curriculumId: string;
}

// ---- Programs and cohorts (UC-11 A1, A2) ----------------------------------------------------------------------

/** A new program. The training type is not accepted by the API (ADR 0011, "Programs and cohorts as built"). */
export interface CreateProgramBody {
  code: string;
  nameVi: string;
  nameEn?: string | null;
  faculty?: string | null;
}

/** Only the fields to change. The code and the training type cannot change here: the API refuses them. */
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
  /** Read-only: no administration route sets it. */
  trainingType: string | null;
  updatedAt: string;
}

/** A new cohort: one curriculum of the program, created empty. No credit total is accepted. */
export interface CreateCohortBody {
  cohortYear: number;
  code: string;
  nameVi: string;
  nameEn?: string | null;
  language?: string | null;
}

/** Only the fields to change. The program, the year, the code and the credit total cannot change here. */
export interface UpdateCohortBody {
  nameVi?: string;
  nameEn?: string | null;
  language?: string | null;
}

export interface CohortDetails {
  /** The curriculum ID. */
  id: string;
  programId: string;
  cohortYear: number;
  code: string;
  nameVi: string;
  nameEn: string | null;
  language: string | null;
  /** Read-only: null for a cohort created here. */
  totalCreditsMin: number | null;
  updatedAt: string;
}

export interface CohortList {
  /** Oldest first. */
  cohorts: CohortDetails[];
}

// ---- Requirement groups ----------------------------------------------------------------------------------------

export interface CreateGroupBody {
  name: string;
  kind: RequirementGroupKind;
  officialNotes?: string | null;
}

/** Only the fields to change. Credit totals are not editable (ADR 0011): the API refuses them. */
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

// ---- Prerequisites and offering terms --------------------------------------------------------------------------

export interface SetPrerequisitesBody {
  /** Every course that must be passed first; [] records "none". */
  prerequisites: string[];
}

export interface Prerequisites {
  courseCode: string;
  /** null once cleared: not recorded. */
  prerequisites: string[] | null;
}

export interface SetOfferingTermsBody {
  /** Term numbers 1, 2 or 3; at least one. */
  terms: number[];
}

export interface OfferingTerms {
  courseCode: string;
  /** null once cleared: not recorded. */
  terms: number[] | null;
}

// ---- Catalog courses -------------------------------------------------------------------------------------------

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

/** Only the fields to change; the code never changes (ADR 0011). */
export interface UpdateCourseBody {
  nameVi?: string;
  nameEn?: string | null;
  credits?: number;
  theoryPeriods?: number | null;
  labPeriods?: number | null;
  exercisePeriods?: number | null;
  projectPeriods?: number | null;
  /** The reviewVersion of a 409 impact_confirmation_required answer: confirms the change for the curricula it listed. */
  confirmImpact?: string;
}

/**
 * A request body as the administrator typed it. A value the form could not read as a number stays the text they
 * typed, so the API refuses it and names the field; the screen never guesses or drops a value.
 */
export type Entered<T> = { [K in keyof T]: T[K] | string | null };

// ---- Access management -----------------------------------------------------------------------------------------

export interface AccessProgram {
  id: string;
  code: string;
  nameVi: string;
}

export interface AccessProgramList {
  programs: AccessProgram[];
}

// ---- CSV import (UC-11 A9) -------------------------------------------------------------------------------------

export const IMPORT_FILE_TYPES = ['catalog_courses', 'group_links'] as const;
export type ImportFileType = (typeof IMPORT_FILE_TYPES)[number];

/** The exact first line of each file type (ADR 0011, "CSV contract and UC-11 handoff"). */
export const IMPORT_HEADERS: Record<ImportFileType, readonly string[]> = {
  catalog_courses: ['code', 'name_vi', 'name_en', 'credits', 'theory_periods', 'lab_periods', 'exercise_periods', 'project_periods'],
  group_links: ['requirement_group_name', 'course_code'],
};

/** The input limits of the API; it checks them itself, and decides. */
export const IMPORT_MAX_BYTES = 1024 * 1024;
export const IMPORT_MAX_RECORDS = 1000;

export interface ImportPreviewBody {
  /** The whole file as text. */
  csv: string;
}

export interface ImportConfirmBody {
  /** The same file that was previewed. */
  csv: string;
  reviewVersion: string;
}

/** Where a file is wrong: by record (the header is record 1), never by line. */
export interface ImportRowError {
  record: number;
  /** The CSV column, or null for the whole record. */
  field: string | null;
  /** English text from the API. */
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
  /** For an update: the fields whose saved value differs. */
  changedFields: (keyof Course)[];
  /** For an update: the course as saved now. */
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
  /** null while the file has an error: such a file cannot be confirmed. */
  reviewVersion: string | null;
}

export interface CatalogImportPreview extends ImportPreviewBase {
  fileType: 'catalog_courses';
  rows: CatalogImportRow[];
  /** Every curriculum that will read new values. */
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

// ---- Error bodies ----------------------------------------------------------------------------------------------

/** Every F12 error: the screen words its message from `code`; `message` is English text for a developer. */
export interface AdminErrorBody {
  statusCode: number;
  code: string;
  message: string | string[];
}

export interface PermissionRequiredBody extends AdminErrorBody {
  permission: PermissionKind;
}

export interface PrerequisiteCycleBody extends AdminErrorBody {
  /** From the edited course back to it: each code requires the next. */
  cycle: string[];
}

export interface ReferencedItemBody extends AdminErrorBody {
  /** What still needs the item, in English words. */
  references: string[];
}

export interface AffectedCurriculum {
  curriculumId: string;
  curriculumCode: string;
  programCode: string;
  cohortYear: number;
}

/** A refused import file (400 validation_failed): where it is wrong. Absent for a malformed request body. */
export interface ImportRejectedBody extends AdminErrorBody {
  errors?: ImportRowError[];
}

export interface ImpactConfirmationBody extends AdminErrorBody {
  affectedCurricula: AffectedCurriculum[];
  reviewVersion: string;
}

// ---- Calls -----------------------------------------------------------------------------------------------------

const cohortPath = (cohort: CohortRef) => `/admin/programs/${segment(cohort.programId)}/cohorts/${segment(cohort.curriculumId)}`;
const groupPath = (cohort: CohortRef, groupId: string) => `${cohortPath(cohort)}/requirement-groups/${segment(groupId)}`;
const rulePath = (cohort: CohortRef, courseCode: string) => `${cohortPath(cohort)}/courses/${segment(courseCode)}`;
const userPath = (userId: string) => `/admin/access/users/${segment(userId)}`;

/** The signed-in user's own grants; empty lists when they hold none. Open to any signed-in user. */
export const fetchOwnGrants = (token: string) => request<UserGrants>('GET', '/admin/grants', { token });

/** The programs the caller holds a program grant for, with their cohorts. */
export const fetchAdminPrograms = (token: string) => request<AdminProgramList>('GET', '/admin/programs', { token });

/** Needs the access-manager permission. 409 duplicate_code. The creator gets no grant on the new program. */
export const createProgram = (token: string, body: Entered<CreateProgramBody>) => request<ProgramDetails>('POST', '/admin/programs', { token, body });
export const updateProgram = (token: string, programId: string, body: Entered<UpdateProgramBody>) =>
  request<ProgramDetails>('PATCH', `/admin/programs/${segment(programId)}`, { token, body });
export const fetchCohorts = (token: string, programId: string) => request<CohortList>('GET', `/admin/programs/${segment(programId)}/cohorts`, { token });
/** 409 duplicate_cohort (a cohort of this year) or duplicate_code (a curriculum with this code). */
export const createCohort = (token: string, programId: string, body: Entered<CreateCohortBody>) =>
  request<CohortDetails>('POST', `/admin/programs/${segment(programId)}/cohorts`, { token, body });
export const fetchCohort = (token: string, cohort: CohortRef) => request<CohortDetails>('GET', cohortPath(cohort), { token });
export const updateCohort = (token: string, cohort: CohortRef, body: Entered<UpdateCohortBody>) => request<CohortDetails>('PATCH', cohortPath(cohort), { token, body });

export const createGroup = (token: string, cohort: CohortRef, body: Entered<CreateGroupBody>) =>
  request<AdminGroup>('POST', `${cohortPath(cohort)}/requirement-groups`, { token, body });
export const updateGroup = (token: string, cohort: CohortRef, groupId: string, body: Entered<UpdateGroupBody>) =>
  request<AdminGroup>('PATCH', groupPath(cohort, groupId), { token, body });
/** 409 referenced_item while the group still links courses. */
export const deleteGroup = (token: string, cohort: CohortRef, groupId: string) => request<void>('DELETE', groupPath(cohort, groupId), { token });

/** Links a catalog course to the group; a course already in it stays. 404: the catalog has no such code. */
export const linkCourse = (token: string, cohort: CohortRef, groupId: string, courseCode: string) =>
  request<void>('PUT', `${groupPath(cohort, groupId)}/courses/${segment(courseCode)}`, { token });
/** 409 referenced_item when the course would leave the curriculum while a recorded rule names it. */
export const unlinkCourse = (token: string, cohort: CohortRef, groupId: string, courseCode: string) =>
  request<void>('DELETE', `${groupPath(cohort, groupId)}/courses/${segment(courseCode)}`, { token });

/** Replaces the course's list; [] records "none". 400 prerequisite_cycle names a cycle. */
export const setPrerequisites = (token: string, cohort: CohortRef, courseCode: string, prerequisites: string[]) =>
  request<Prerequisites>('PUT', `${rulePath(cohort, courseCode)}/prerequisites`, { token, body: { prerequisites } satisfies SetPrerequisitesBody });
/** Back to not recorded. */
export const clearPrerequisites = (token: string, cohort: CohortRef, courseCode: string) =>
  request<Prerequisites>('DELETE', `${rulePath(cohort, courseCode)}/prerequisites`, { token });

export const setOfferingTerms = (token: string, cohort: CohortRef, courseCode: string, terms: number[]) =>
  request<OfferingTerms>('PUT', `${rulePath(cohort, courseCode)}/offering-terms`, { token, body: { terms } satisfies SetOfferingTermsBody });
/** Back to not recorded. */
export const clearOfferingTerms = (token: string, cohort: CohortRef, courseCode: string) =>
  request<OfferingTerms>('DELETE', `${rulePath(cohort, courseCode)}/offering-terms`, { token });

/** 409 duplicate_code when the catalog has the code. */
export const createCourse = (token: string, body: Entered<CreateCourseBody>) => request<Course>('POST', '/admin/catalog/courses', { token, body });
/** 409 impact_confirmation_required or impact_changed when a curriculum links the course: review, then confirm. */
export const updateCourse = (token: string, courseCode: string, body: Entered<UpdateCourseBody>) =>
  request<Course>('PATCH', `/admin/catalog/courses/${segment(courseCode)}`, { token, body });
/** 409 referenced_item while a curriculum, rule, transcript or saved plan names the course. */
export const deleteCourse = (token: string, courseCode: string) => request<void>('DELETE', `/admin/catalog/courses/${segment(courseCode)}`, { token });

/** Every program, to choose a program grant from. */
export const fetchAccessPrograms = (token: string) => request<AccessProgramList>('GET', '/admin/access/programs', { token });
/** One user's grants, by exact user ID. 404: no account has it. */
export const fetchUserGrants = (token: string, userId: string) => request<UserGrants>('GET', `${userPath(userId)}/grants`, { token });
export const grantProgram = (token: string, userId: string, programId: string) =>
  request<UserGrants>('PUT', `${userPath(userId)}/programs/${segment(programId)}`, { token });
export const revokeProgram = (token: string, userId: string, programId: string) =>
  request<UserGrants>('DELETE', `${userPath(userId)}/programs/${segment(programId)}`, { token });
export const grantGlobal = (token: string, userId: string, permission: GlobalPermission) =>
  request<UserGrants>('PUT', `${userPath(userId)}/global/${segment(permission)}`, { token });
/** 409 last_access_manager when it would leave no active access manager. */
export const revokeGlobal = (token: string, userId: string, permission: GlobalPermission) =>
  request<UserGrants>('DELETE', `${userPath(userId)}/global/${segment(permission)}`, { token });

/** Writes nothing. A row error is in `errors`, not a failed request; 400 when no row can be read at all. */
export const previewCatalogImport = (token: string, csv: string) =>
  request<CatalogImportPreview>('POST', '/admin/catalog/imports/preview', { token, body: { csv } satisfies ImportPreviewBody });
/** Saves the whole file or nothing. 409 impact_changed: preview again. */
export const confirmCatalogImport = (token: string, csv: string, reviewVersion: string) =>
  request<ImportResult>('POST', '/admin/catalog/imports/confirm', { token, body: { csv, reviewVersion } satisfies ImportConfirmBody });
export const previewLinkImport = (token: string, cohort: CohortRef, csv: string) =>
  request<GroupLinkImportPreview>('POST', `${cohortPath(cohort)}/imports/preview`, { token, body: { csv } satisfies ImportPreviewBody });
export const confirmLinkImport = (token: string, cohort: CohortRef, csv: string, reviewVersion: string) =>
  request<ImportResult>('POST', `${cohortPath(cohort)}/imports/confirm`, { token, body: { csv, reviewVersion } satisfies ImportConfirmBody });
