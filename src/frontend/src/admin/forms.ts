import { reactive, watch } from 'vue';
import type { Course, CurriculumCourse, Curriculum, RequirementGroup, RequirementGroupKind } from '../curriculum/api.js';
import type {
  AffectedCurriculum,
  CohortDetails,
  CreateCohortBody,
  CreateCourseBody,
  CreateGroupBody,
  CreateProgramBody,
  Entered,
  UpdateCohortBody,
  UpdateCourseBody,
  UpdateGroupBody,
  UpdateProgramBody,
} from './api.js';

// What the administration forms hand to the API, and how a change is found again in reloaded data. Nothing here
// judges a value: a form sends what was typed, and the API's refusal names the field (UC-11 A3). The few steps
// below that reshape a value (trim, upper case, blank to null) are the ones the API itself applies when it stores
// it (ADR 0011), repeated only to recognise the stored value after a write whose answer was lost (UC-11 A7).

// ---- Requirement groups ----------------------------------------------------------------------------------------

export interface GroupValues {
  name: string;
  /** '' while no kind is chosen. */
  kind: RequirementGroupKind | '';
  officialNotes: string;
}
export const GROUP_FIELDS = ['name', 'kind', 'officialNotes'] as const;

/** A blank text is stored as null. */
export const blankToNull = (text: string): string | null => text.trim() || null;

/** A code as the API stores it. */
export const storedCode = (typed: string): string => typed.trim().toUpperCase();

export function useValuesOnOpen<V extends object>(open: () => boolean, initial: () => V): V {
  const values = reactive(initial()) as V;
  watch(open, (opened) => {
    if (opened) Object.assign(values, initial());
  });
  return values;
}

interface TextFields<F extends string> {
  required: readonly F[];
  optional: readonly F[];
}

function sentText<F extends string>(values: Record<F, string>, { required, optional }: TextFields<F>): Record<F, string | null> {
  const sent = [...required.map((field) => [field, values[field]]), ...optional.map((field) => [field, blankToNull(values[field])])];
  return Object.fromEntries(sent) as Record<F, string | null>;
}

function textChanges<F extends string>(saved: Record<F, string | null>, values: Record<F, string>, { required, optional }: TextFields<F>): Partial<Record<F, string | null>> {
  const body: Partial<Record<F, string | null>> = {};
  for (const field of required) if (values[field].trim() !== saved[field]) body[field] = values[field];
  for (const field of optional) if (blankToNull(values[field]) !== saved[field]) body[field] = blankToNull(values[field]);
  return body;
}

const textMatches = <F extends string>(saved: Record<F, string | null>, values: Record<F, string>, { required, optional }: TextFields<F>): boolean =>
  required.every((field) => saved[field] === values[field].trim()) && optional.every((field) => saved[field] === blankToNull(values[field]));

const GROUP_TEXT: TextFields<'name' | 'officialNotes'> = { required: ['name'], optional: ['officialNotes'] };

export const groupValues = (saved: RequirementGroup | null): GroupValues => ({
  name: saved?.name ?? '',
  kind: saved?.kind ?? '',
  officialNotes: saved?.officialNotes ?? '',
});

export const newGroupBody = (entered: GroupValues): Entered<CreateGroupBody> => ({ ...sentText(entered, GROUP_TEXT), kind: entered.kind || null }) as Entered<CreateGroupBody>;

/** Only the fields that differ from the saved group; empty when nothing changed. */
export function groupChanges(saved: Pick<RequirementGroup, 'name' | 'kind' | 'officialNotes'>, entered: GroupValues): Entered<UpdateGroupBody> {
  const body: Entered<UpdateGroupBody> = textChanges(saved, entered, GROUP_TEXT);
  if (entered.kind !== saved.kind) body.kind = entered.kind || null;
  return body;
}

/** The saved group reads as the form was filled in. */
export const groupMatches = (saved: Pick<RequirementGroup, 'name' | 'kind' | 'officialNotes'>, entered: GroupValues): boolean =>
  textMatches(saved, entered, GROUP_TEXT) && saved.kind === entered.kind;

// ---- Courses of a curriculum -----------------------------------------------------------------------------------

export const LINK_FIELDS = ['courseCode'] as const;

/** `not_recorded` clears the list (null); `none` records an empty one; they are different facts (ADR 0011). */
export type PrerequisiteChoice = { state: 'not_recorded' } | { state: 'none' } | { state: 'list'; codes: string[] };
export const PREREQUISITE_FIELDS = ['prerequisites'] as const;
export const TERM_FIELDS = ['terms'] as const;

/** The course as the curriculum lists it, from any of its groups; null when no group links it. */
export function courseIn(curriculum: Curriculum, code: string): CurriculumCourse | null {
  for (const group of curriculum.requirementGroups) {
    const found = group.courses.find((course) => course.code === code);
    if (found) return found;
  }
  return null;
}

export const groupHas = (curriculum: Curriculum, groupId: string, code: string): boolean =>
  curriculum.requirementGroups.some((group) => group.id === groupId && group.courses.some((course) => course.code === code));

/** The prerequisite list the API stores for a choice: null, or the codes in code order. */
export const storedPrerequisites = (choice: PrerequisiteChoice): string[] | null =>
  choice.state === 'not_recorded' ? null : choice.state === 'none' ? [] : choice.codes.map(storedCode).sort();

/** Two recorded lists are the same; null (not recorded) equals only null. */
export function sameList<T>(a: readonly T[] | null | undefined, b: readonly T[] | null): boolean {
  if (a == null || b === null) return (a ?? null) === b;
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

// ---- Catalog courses -------------------------------------------------------------------------------------------

const PERIODS = ['theoryPeriods', 'labPeriods', 'exercisePeriods', 'projectPeriods'] as const;
export const COURSE_FIELDS = ['code', 'nameVi', 'nameEn', 'credits', ...PERIODS] as const;
export type CourseField = (typeof COURSE_FIELDS)[number];
/** The fields a correction may change: every one but the code (ADR 0011). */
export const EDITABLE_COURSE_FIELDS = COURSE_FIELDS.filter((field): field is Exclude<CourseField, 'code'> => field !== 'code');
/** The course form as typed: every box is text. */
export type CourseValues = Record<CourseField, string>;

/**
 * A number box as typed: the number when it reads as one, null when empty, and otherwise the text itself, so the
 * API refuses it and names the field. A typing mistake must never turn into null, which would clear the value.
 */
export function enteredNumber(text: string): number | string | null {
  const typed = text.trim();
  if (!typed) return null;
  return /^[+-]?\d+(\.\d+)?$/.test(typed) ? Number(typed) : typed;
}

export const courseValues = (course: Course | null): CourseValues => ({
  code: course?.code ?? '',
  nameVi: course?.nameVi ?? '',
  nameEn: course?.nameEn ?? '',
  credits: course ? String(course.credits) : '',
  theoryPeriods: course?.theoryPeriods?.toString() ?? '',
  labPeriods: course?.labPeriods?.toString() ?? '',
  exercisePeriods: course?.exercisePeriods?.toString() ?? '',
  projectPeriods: course?.projectPeriods?.toString() ?? '',
});

/** A new course: an empty period box is left out, and the API then stores 0. */
export function newCourseBody(values: CourseValues): Entered<CreateCourseBody> {
  const body: Entered<CreateCourseBody> = { code: values.code, nameVi: values.nameVi, nameEn: blankToNull(values.nameEn), credits: enteredNumber(values.credits) };
  for (const field of PERIODS) {
    const entered = enteredNumber(values[field]);
    if (entered !== null) body[field] = entered;
  }
  return body;
}

/** A course field as the form would send it. */
const entered = (field: Exclude<CourseField, 'code'>, values: CourseValues): number | string | null =>
  field === 'nameVi' ? values.nameVi.trim() : field === 'nameEn' ? blankToNull(values.nameEn) : enteredNumber(values[field]);

/** Only the fields that differ from the saved course; empty when nothing changed. An emptied period box sends null. */
export function courseChanges(saved: Course, values: CourseValues): Entered<UpdateCourseBody> {
  const body: Entered<UpdateCourseBody> = {};
  for (const field of EDITABLE_COURSE_FIELDS) {
    const value = entered(field, values);
    if (value !== saved[field]) (body as Record<string, unknown>)[field] = field === 'nameVi' ? values.nameVi : value;
  }
  return body;
}

/**
 * The API's answer to a correction of a course that curricula link (409 impact_confirmation_required or
 * impact_changed): what the catalog maintainer reviews before anything is saved (UC-11 A8).
 */
export interface ImpactReview {
  /** The change exactly as it was sent. The confirmation sends the same fields again: the API's reviewVersion covers these values. */
  body: Entered<UpdateCourseBody>;
  affected: AffectedCurriculum[];
  reviewVersion: string;
  /** The API refused an earlier confirmation, because the values or the links had changed since it. */
  changed: boolean;
}

/** The saved course has every value of `body` (the fields of a create or a correction, without confirmImpact). */
export function courseHas(saved: Course, body: Entered<UpdateCourseBody> | Entered<CreateCourseBody>): boolean {
  return EDITABLE_COURSE_FIELDS.every((field) => {
    if (!Object.hasOwn(body, field)) return true;
    const want = (body as Record<string, unknown>)[field];
    return saved[field] === (typeof want === 'string' ? want.trim() : want);
  });
}

// ---- Programs and cohorts (UC-11 A1, A2) -----------------------------------------------------------------------
// No box for the training type or a credit total: the API accepts neither (ADR 0011, "Programs and cohorts as built").

export const PROGRAM_FIELDS = ['code', 'nameVi', 'nameEn', 'faculty'] as const;
export type ProgramField = (typeof PROGRAM_FIELDS)[number];
export type ProgramValues = Record<ProgramField, string>;
/** A program's details as saved; the code never changes. */
export type SavedProgram = { code: string; nameVi: string; nameEn: string | null; faculty: string | null };
const PROGRAM_TEXT: TextFields<'nameVi' | 'nameEn' | 'faculty'> = { required: ['nameVi'], optional: ['nameEn', 'faculty'] };

export const programValues = (saved: SavedProgram | null): ProgramValues => ({
  code: saved?.code ?? '',
  nameVi: saved?.nameVi ?? '',
  nameEn: saved?.nameEn ?? '',
  faculty: saved?.faculty ?? '',
});

export const newProgramBody = (values: ProgramValues): Entered<CreateProgramBody> => ({ code: values.code, ...sentText(values, PROGRAM_TEXT) }) as Entered<CreateProgramBody>;

/** Only the fields that differ from the saved program; empty when nothing changed. */
export const programChanges = (saved: SavedProgram, values: ProgramValues): Entered<UpdateProgramBody> => textChanges(saved, values, PROGRAM_TEXT);

/** The saved program reads as the form was filled in (a create also matches its code). */
export const programMatches = (saved: SavedProgram, values: ProgramValues, withCode = false): boolean =>
  (!withCode || saved.code === storedCode(values.code)) && textMatches(saved, values, PROGRAM_TEXT);

export const COHORT_FIELDS = ['cohortYear', 'code', 'nameVi', 'nameEn', 'language'] as const;
export type CohortField = (typeof COHORT_FIELDS)[number];
export type CohortValues = Record<CohortField, string>;
const COHORT_TEXT: TextFields<'nameVi' | 'nameEn' | 'language'> = { required: ['nameVi'], optional: ['nameEn', 'language'] };

export const cohortValues = (saved: CohortDetails | null): CohortValues => ({
  cohortYear: saved ? String(saved.cohortYear) : '',
  code: saved?.code ?? '',
  nameVi: saved?.nameVi ?? '',
  nameEn: saved?.nameEn ?? '',
  language: saved?.language ?? '',
});

export const newCohortBody = (values: CohortValues): Entered<CreateCohortBody> =>
  ({ cohortYear: enteredNumber(values.cohortYear), code: values.code, ...sentText(values, COHORT_TEXT) }) as Entered<CreateCohortBody>;

/** Only the fields that differ from the saved cohort; the year and the code never change. */
export const cohortChanges = (saved: CohortDetails, values: CohortValues): Entered<UpdateCohortBody> => textChanges(saved, values, COHORT_TEXT);

/** The saved cohort reads as the form was filled in (a create also matches its year and code). */
export const cohortMatches = (saved: CohortDetails, values: CohortValues, withIdentity = false): boolean =>
  (!withIdentity || (String(saved.cohortYear) === values.cohortYear.trim() && saved.code === storedCode(values.code))) && textMatches(saved, values, COHORT_TEXT);
