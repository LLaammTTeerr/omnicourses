import { reactive, watch } from 'vue';
import type { Course, CurriculumCourse, Curriculum, RequirementGroup, RequirementGroupKind } from '../curriculum/api.js';
import type {
  AffectedCurriculum,
  CalendarEvent,
  CalendarEventKind,
  CalendarTerm,
  CohortDetails,
  CreateCalendarEventBody,
  CreateCohortBody,
  CreateCourseBody,
  CreateGroupBody,
  CreateProgramBody,
  Entered,
  UpdateCalendarEventBody,
  UpdateCohortBody,
  UpdateCourseBody,
  UpdateGroupBody,
  UpdateProgramBody,
} from './api.js';

export interface GroupValues {
  name: string;
  kind: RequirementGroupKind | '';
  officialNotes: string;
}
export const GROUP_FIELDS = ['name', 'kind', 'officialNotes'] as const;

export const blankToNull = (text: string): string | null => text.trim() || null;

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

export function groupChanges(saved: Pick<RequirementGroup, 'name' | 'kind' | 'officialNotes'>, entered: GroupValues): Entered<UpdateGroupBody> {
  const body: Entered<UpdateGroupBody> = textChanges(saved, entered, GROUP_TEXT);
  if (entered.kind !== saved.kind) body.kind = entered.kind || null;
  return body;
}

export const groupMatches = (saved: Pick<RequirementGroup, 'name' | 'kind' | 'officialNotes'>, entered: GroupValues): boolean =>
  textMatches(saved, entered, GROUP_TEXT) && saved.kind === entered.kind;

export const LINK_FIELDS = ['courseCode'] as const;

export type PrerequisiteChoice = { state: 'not_recorded' } | { state: 'none' } | { state: 'list'; codes: string[] };
export const PREREQUISITE_FIELDS = ['prerequisites'] as const;
export const TERM_FIELDS = ['terms'] as const;

export function courseIn(curriculum: Curriculum, code: string): CurriculumCourse | null {
  for (const group of curriculum.requirementGroups) {
    const found = group.courses.find((course) => course.code === code);
    if (found) return found;
  }
  return null;
}

export const groupHas = (curriculum: Curriculum, groupId: string, code: string): boolean =>
  curriculum.requirementGroups.some((group) => group.id === groupId && group.courses.some((course) => course.code === code));

export const storedPrerequisites = (choice: PrerequisiteChoice): string[] | null =>
  choice.state === 'not_recorded' ? null : choice.state === 'none' ? [] : choice.codes.map(storedCode).sort();

export function sameList<T>(a: readonly T[] | null | undefined, b: readonly T[] | null): boolean {
  if (a == null || b === null) return (a ?? null) === b;
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

const PERIODS = ['theoryPeriods', 'labPeriods', 'exercisePeriods', 'projectPeriods'] as const;
export const COURSE_FIELDS = ['code', 'nameVi', 'nameEn', 'credits', ...PERIODS] as const;
export type CourseField = (typeof COURSE_FIELDS)[number];
export const EDITABLE_COURSE_FIELDS = COURSE_FIELDS.filter((field): field is Exclude<CourseField, 'code'> => field !== 'code');
export type CourseValues = Record<CourseField, string>;

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

export function newCourseBody(values: CourseValues): Entered<CreateCourseBody> {
  const body: Entered<CreateCourseBody> = { code: values.code, nameVi: values.nameVi, nameEn: blankToNull(values.nameEn), credits: enteredNumber(values.credits) };
  for (const field of PERIODS) {
    const entered = enteredNumber(values[field]);
    if (entered !== null) body[field] = entered;
  }
  return body;
}

const entered = (field: Exclude<CourseField, 'code'>, values: CourseValues): number | string | null =>
  field === 'nameVi' ? values.nameVi.trim() : field === 'nameEn' ? blankToNull(values.nameEn) : enteredNumber(values[field]);

export function courseChanges(saved: Course, values: CourseValues): Entered<UpdateCourseBody> {
  const body: Entered<UpdateCourseBody> = {};
  for (const field of EDITABLE_COURSE_FIELDS) {
    const value = entered(field, values);
    if (value !== saved[field]) (body as Record<string, unknown>)[field] = field === 'nameVi' ? values.nameVi : value;
  }
  return body;
}

export interface ImpactReview {
  body: Entered<UpdateCourseBody>;
  affected: AffectedCurriculum[];
  reviewVersion: string;
  changed: boolean;
}

export function courseHas(saved: Course, body: Entered<UpdateCourseBody> | Entered<CreateCourseBody>): boolean {
  return EDITABLE_COURSE_FIELDS.every((field) => {
    if (!Object.hasOwn(body, field)) return true;
    const want = (body as Record<string, unknown>)[field];
    return saved[field] === (typeof want === 'string' ? want.trim() : want);
  });
}

export const PROGRAM_FIELDS = ['code', 'nameVi', 'nameEn', 'faculty'] as const;
export type ProgramField = (typeof PROGRAM_FIELDS)[number];
export type ProgramValues = Record<ProgramField, string>;
export type SavedProgram = { code: string; nameVi: string; nameEn: string | null; faculty: string | null };
const PROGRAM_TEXT: TextFields<'nameVi' | 'nameEn' | 'faculty'> = { required: ['nameVi'], optional: ['nameEn', 'faculty'] };

export const programValues = (saved: SavedProgram | null): ProgramValues => ({
  code: saved?.code ?? '',
  nameVi: saved?.nameVi ?? '',
  nameEn: saved?.nameEn ?? '',
  faculty: saved?.faculty ?? '',
});

export const newProgramBody = (values: ProgramValues): Entered<CreateProgramBody> => ({ code: values.code, ...sentText(values, PROGRAM_TEXT) }) as Entered<CreateProgramBody>;

export const programChanges = (saved: SavedProgram, values: ProgramValues): Entered<UpdateProgramBody> => textChanges(saved, values, PROGRAM_TEXT);

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

export const cohortChanges = (saved: CohortDetails, values: CohortValues): Entered<UpdateCohortBody> => textChanges(saved, values, COHORT_TEXT);

export const cohortMatches = (saved: CohortDetails, values: CohortValues, withIdentity = false): boolean =>
  (!withIdentity || (String(saved.cohortYear) === values.cohortYear.trim() && saved.code === storedCode(values.code))) && textMatches(saved, values, COHORT_TEXT);

export const CALENDAR_EVENT_FIELDS = ['academicYear', 'term', 'kind', 'startsOn', 'endsOn', 'title', 'titleEn', 'sourceUrl', 'notes'] as const;
export type CalendarEventField = (typeof CALENDAR_EVENT_FIELDS)[number];
export interface CalendarEventValues {
  academicYear: string;
  term: '' | '1' | '2' | '3';
  kind: CalendarEventKind | '';
  startsOn: string;
  endsOn: string;
  title: string;
  titleEn: string;
  sourceUrl: string;
  notes: string;
}

const enteredTerm = (term: CalendarEventValues['term']): CalendarTerm | null => (term === '' ? null : (Number(term) as CalendarTerm));

export const calendarEventValues = (saved: CalendarEvent | null): CalendarEventValues => ({
  academicYear: saved ? String(saved.academicYear) : '',
  term: saved?.term ? (String(saved.term) as '1' | '2' | '3') : '',
  kind: saved?.kind ?? '',
  startsOn: saved?.startsOn ?? '',
  endsOn: saved?.endsOn ?? '',
  title: saved?.title ?? '',
  titleEn: saved?.titleEn ?? '',
  sourceUrl: saved?.sourceUrl ?? '',
  notes: saved?.notes ?? '',
});

export function newCalendarEventBody(values: CalendarEventValues): Entered<CreateCalendarEventBody> {
  const endsOn = values.endsOn.trim();
  return {
    academicYear: enteredNumber(values.academicYear),
    term: enteredTerm(values.term),
    kind: values.kind || null,
    startsOn: values.startsOn.trim(),
    ...(endsOn !== '' && { endsOn }),
    title: values.title,
    titleEn: blankToNull(values.titleEn),
    sourceUrl: blankToNull(values.sourceUrl),
    notes: blankToNull(values.notes),
  };
}

export function calendarEventChanges(saved: CalendarEvent, values: CalendarEventValues): Entered<UpdateCalendarEventBody> {
  const body: Entered<UpdateCalendarEventBody> = {};
  const academicYear = enteredNumber(values.academicYear);
  if (academicYear !== saved.academicYear) body.academicYear = academicYear;
  const term = enteredTerm(values.term);
  if (term !== saved.term) body.term = term;
  const kind = values.kind || null;
  if (kind !== saved.kind) body.kind = kind;
  const startsOn = values.startsOn.trim();
  if (startsOn !== saved.startsOn) body.startsOn = startsOn;
  const endsOn = values.endsOn.trim() || startsOn;
  if (endsOn !== saved.endsOn) body.endsOn = endsOn;
  if (values.title.trim() !== saved.title) body.title = values.title;
  if (blankToNull(values.titleEn) !== saved.titleEn) body.titleEn = blankToNull(values.titleEn);
  if (blankToNull(values.sourceUrl) !== saved.sourceUrl) body.sourceUrl = blankToNull(values.sourceUrl);
  if (blankToNull(values.notes) !== saved.notes) body.notes = blankToNull(values.notes);
  return body;
}

export function calendarEventMatches(saved: CalendarEvent, values: CalendarEventValues): boolean {
  const startsOn = values.startsOn.trim();
  const endsOn = values.endsOn.trim() || startsOn;
  return (
    saved.academicYear === enteredNumber(values.academicYear) &&
    saved.term === enteredTerm(values.term) &&
    saved.kind === values.kind &&
    saved.startsOn === startsOn &&
    saved.endsOn === endsOn &&
    saved.title === values.title.trim() &&
    saved.titleEn === blankToNull(values.titleEn) &&
    saved.sourceUrl === blankToNull(values.sourceUrl) &&
    saved.notes === blankToNull(values.notes)
  );
}
