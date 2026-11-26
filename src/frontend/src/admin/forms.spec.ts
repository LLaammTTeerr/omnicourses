import { describe, expect, it } from 'vitest';
import {
  blankToNull,
  cohortChanges,
  cohortMatches,
  cohortValues,
  newCohortBody,
  newProgramBody,
  programChanges,
  programMatches,
  programValues,
  courseChanges,
  courseHas,
  courseIn,
  courseValues,
  enteredNumber,
  groupChanges,
  groupHas,
  groupMatches,
  newCourseBody,
  newGroupBody,
  sameList,
  storedCode,
  storedPrerequisites,
} from './forms.js';
import { BASE_GROUP, catalogCourse, curriculum, ELECTIVE_GROUP, GROUP_BASE_ID, GROUP_ELECTIVE_ID } from './testing/fixtures.js';

describe('what a form sends: the values typed, never a judgement of them', () => {
  it('reads a number box as a number, an empty one as null, and anything else as the text typed', () => {
    expect([enteredNumber('4'), enteredNumber(' 45 '), enteredNumber('0'), enteredNumber('-1'), enteredNumber('1.5')]).toEqual([4, 45, 0, -1, 1.5]);
    expect([enteredNumber(''), enteredNumber('   ')]).toEqual([null, null]);
    expect([enteredNumber('4o'), enteredNumber('ba'), enteredNumber('1e3'), enteredNumber('0x10'), enteredNumber('1,5')]).toEqual(['4o', 'ba', '1e3', '0x10', '1,5']);
  });

  it('builds a new course with the text as typed, and leaves an empty period box out', () => {
    expect(newCourseBody({ ...courseValues(null), code: ' zz300 ', nameVi: ' Môn thử ', credits: '3', labPeriods: '30', projectPeriods: 'x' })).toEqual({
      code: ' zz300 ',
      nameVi: ' Môn thử ',
      nameEn: null,
      credits: 3,
      labPeriods: 30,
      projectPeriods: 'x',
    });
    expect(newCourseBody(courseValues(null))).toEqual({ code: '', nameVi: '', nameEn: null, credits: null });
  });

  it('opens the course form on the saved values, an empty box for a blank period', () => {
    expect(courseValues(catalogCourse('ZZ200', { nameEn: 'Test course' }))).toEqual({
      code: 'ZZ200',
      nameVi: 'Học phần thử ZZ200',
      nameEn: 'Test course',
      credits: '4',
      theoryPeriods: '45',
      labPeriods: '30',
      exercisePeriods: '',
      projectPeriods: '0',
    });
  });

  it('sends only the course fields that differ from the saved course', () => {
    const saved = catalogCourse('ZZ200');
    const form = courseValues(saved);
    expect(courseChanges(saved, form)).toEqual({});
    expect(courseChanges(saved, { ...form, nameVi: '  Học phần thử ZZ200 ' })).toEqual({});
    expect(courseChanges(saved, { ...form, nameVi: 'Tên mới ', nameEn: ' New name ', credits: '3', exercisePeriods: '15', labPeriods: '', projectPeriods: '0' })).toEqual({
      nameVi: 'Tên mới ',
      nameEn: 'New name',
      credits: 3,
      labPeriods: null,
      exercisePeriods: 15,
    });
    expect(courseChanges(saved, { ...form, code: 'ZZ201' })).toEqual({});
  });

  it('builds a group as typed, with no kind chosen sent as null', () => {
    expect(newGroupBody({ name: ' Nhóm thử ', kind: '', officialNotes: '  ' })).toEqual({ name: ' Nhóm thử ', kind: null, officialNotes: null });
    expect(newGroupBody({ name: 'Nhóm thử', kind: 'elective', officialNotes: ' Ghi chú ' })).toEqual({ name: 'Nhóm thử', kind: 'elective', officialNotes: 'Ghi chú' });
  });

  it('sends only the group fields that differ from the saved group', () => {
    const form = { name: ELECTIVE_GROUP.name, kind: ELECTIVE_GROUP.kind, officialNotes: ELECTIVE_GROUP.officialNotes ?? '' };
    expect(groupChanges(ELECTIVE_GROUP, form)).toEqual({});
    expect(groupChanges(ELECTIVE_GROUP, { name: '', kind: 'compulsory', officialNotes: '' })).toEqual({ name: '', kind: 'compulsory', officialNotes: null });
    expect(groupChanges(BASE_GROUP, { name: BASE_GROUP.name, kind: 'compulsory', officialNotes: 'Ghi chú' })).toEqual({ officialNotes: 'Ghi chú' });
  });
});

describe('finding a change again in reloaded data (UC-11 A7)', () => {
  it('writes a code and a blank text as the API stores them', () => {
    expect([storedCode(' zz101 '), storedCode('ZZ101'), blankToNull('  '), blankToNull(' a ')]).toEqual(['ZZ101', 'ZZ101', null, 'a']);
  });

  it('tells a saved group that matches the form from one that does not', () => {
    const form = { name: ' Tự chọn thử ', kind: 'elective' as const, officialNotes: 'Chọn tối thiểu 8 tín chỉ.' };
    expect(groupMatches(ELECTIVE_GROUP, form)).toBe(true);
    expect(groupMatches(ELECTIVE_GROUP, { ...form, officialNotes: '' })).toBe(false);
    expect(groupMatches(ELECTIVE_GROUP, { ...form, kind: 'compulsory' })).toBe(false);
    expect(groupMatches(BASE_GROUP, { name: BASE_GROUP.name, kind: 'compulsory', officialNotes: ' ' })).toBe(true);
  });

  it('finds a course in a group, and in the curriculum whatever its group', () => {
    const saved = curriculum();
    expect([groupHas(saved, GROUP_BASE_ID, 'ZZ101'), groupHas(saved, GROUP_ELECTIVE_ID, 'ZZ101'), groupHas(saved, GROUP_BASE_ID, 'ZZ999')]).toEqual([true, false, false]);
    expect(courseIn(saved, 'ZZ102')?.prerequisites).toEqual(['ZZ101']);
    expect(courseIn(saved, 'ZZ999')).toBeNull();
  });

  it('keeps "not recorded" apart from "none" when it compares lists', () => {
    expect(storedPrerequisites({ state: 'not_recorded' })).toBeNull();
    expect(storedPrerequisites({ state: 'none' })).toEqual([]);
    expect(storedPrerequisites({ state: 'list', codes: [' zz102', 'ZZ101 '] })).toEqual(['ZZ101', 'ZZ102']);
    expect([sameList(null, null), sameList([], []), sameList(['ZZ101'], ['ZZ101']), sameList([1, 3], [1, 3])]).toEqual([true, true, true, true]);
    expect([sameList(null, []), sameList([], null), sameList(undefined, []), sameList(['ZZ101'], ['ZZ102']), sameList(['ZZ101'], ['ZZ101', 'ZZ102'])]).toEqual([false, false, false, false, false]);
  });

  it('says whether the saved course has the values of a write', () => {
    const saved = catalogCourse('ZZ200', { credits: 3, nameVi: 'Tên mới', labPeriods: null });
    expect(courseHas(saved, { credits: 3, nameVi: ' Tên mới ', labPeriods: null })).toBe(true);
    expect(courseHas(saved, { credits: 4 })).toBe(false);
    expect(courseHas(saved, { labPeriods: 0 })).toBe(false);
    expect(courseHas(saved, { credits: 'ba' })).toBe(false);
    expect(courseHas(saved, { code: 'zz200', nameVi: 'Tên mới', nameEn: null, credits: 3 })).toBe(true);
  });
});

describe('the program and cohort forms (UC-11 A1, A2): what is typed, and nothing the API does not take', () => {
  const PROGRAM = { code: 'ZZ-NEW', nameVi: 'Chương trình thử', nameEn: null, faculty: 'Khoa thử' };
  const COHORT = {
    id: '00000000-0000-4000-8000-0000000000c9',
    programId: '00000000-0000-4000-8000-0000000000a1',
    cohortYear: 2026,
    code: 'ZZ-NEW-2026',
    nameVi: 'Khóa thử 2026',
    nameEn: null,
    language: 'vi',
    totalCreditsMin: null,
    updatedAt: '2026-11-25T02:00:00.000Z',
  };

  it('builds a new program with the code as typed, blank boxes as null, and no training type', () => {
    expect(newProgramBody({ code: ' zz-new ', nameVi: ' Chương trình thử ', nameEn: ' ', faculty: '' })).toEqual({ code: ' zz-new ', nameVi: ' Chương trình thử ', nameEn: null, faculty: null });
  });

  it('sends only the changed program details, never the code, and recognises them once saved', () => {
    expect(programChanges(PROGRAM, programValues(PROGRAM))).toEqual({});
    const typed = { ...programValues(PROGRAM), nameEn: 'Test program', faculty: ' ' };
    expect(programChanges(PROGRAM, typed)).toEqual({ nameEn: 'Test program', faculty: null });
    expect(programMatches({ ...PROGRAM, nameEn: 'Test program', faculty: null }, typed)).toBe(true);
    expect(programMatches(PROGRAM, typed)).toBe(false);
    expect(programMatches(PROGRAM, { ...programValues(PROGRAM), code: ' zz-new ' }, true)).toBe(true);
  });

  it('builds a new cohort with the year as a number when it reads as one, and no credit total', () => {
    expect(newCohortBody({ cohortYear: ' 2026 ', code: 'zz-new-2026', nameVi: 'Khóa thử', nameEn: '', language: ' ' })).toEqual({ cohortYear: 2026, code: 'zz-new-2026', nameVi: 'Khóa thử', nameEn: null, language: null });
    expect(newCohortBody({ ...cohortValues(null), cohortYear: '2O26' }).cohortYear).toBe('2O26');
  });

  it('sends only the changed cohort details, never the year or the code, and recognises a new cohort by them', () => {
    expect(cohortChanges(COHORT, cohortValues(COHORT))).toEqual({});
    expect(cohortChanges(COHORT, { ...cohortValues(COHORT), cohortYear: '2027', code: 'X', language: '' })).toEqual({ language: null });
    expect(cohortMatches(COHORT, { ...cohortValues(COHORT), code: 'zz-new-2026 ' }, true)).toBe(true);
    expect(cohortMatches(COHORT, { ...cohortValues(COHORT), cohortYear: '2025' }, true)).toBe(false);
  });
});
