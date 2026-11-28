import { describe, expect, it } from 'vitest';
import { COHORT_FIELDS, PROGRAM_FIELDS } from './program-admin.dto.js';
import { detailsPatch } from './program-admin.service.js';

const program = { code: 'ZZ-PROG', nameVi: 'Chương trình thử', nameEn: 'Trial Program' as string | null, faculty: null as string | null, trainingType: 'standard' as string | null };
const cohort = { programId: 'p', cohortYear: 2024, code: 'ZZ-PROG-2024', nameVi: 'Khóa thử', nameEn: null as string | null, language: 'en' as string | null, totalCreditsMin: 120 as number | null };

describe('detailsPatch', () => {
  it('holds only the sent fields that differ from the stored row', () => {
    expect(detailsPatch(PROGRAM_FIELDS, program, {})).toEqual({});
    expect(detailsPatch(PROGRAM_FIELDS, program, { nameVi: 'Chương trình thử', nameEn: 'Trial Program', faculty: null })).toEqual({});
    expect(detailsPatch(PROGRAM_FIELDS, program, { nameVi: 'Tên mới', faculty: 'Khoa thử' })).toEqual({ nameVi: 'Tên mới', faculty: 'Khoa thử' });
  });

  it('stores a blank optional text as null', () => {
    expect(detailsPatch(PROGRAM_FIELDS, program, { nameEn: '  ' })).toEqual({ nameEn: null });
    expect(detailsPatch(PROGRAM_FIELDS, program, { nameEn: null })).toEqual({ nameEn: null });
    expect(detailsPatch(COHORT_FIELDS, cohort, { language: '' })).toEqual({ language: null });
    expect(detailsPatch(COHORT_FIELDS, cohort, { nameEn: '' })).toEqual({});
  });

  it('never carries an identifier or the training type, whatever the body object holds', () => {
    const body = { nameVi: 'Tên mới', code: 'ZZ-OTHER', trainingType: 'advanced', cohortYear: 2030, programId: 'q', totalCreditsMin: 1 };
    expect(detailsPatch(PROGRAM_FIELDS, program, body)).toEqual({ nameVi: 'Tên mới' });
    expect(detailsPatch(COHORT_FIELDS, cohort, body)).toEqual({ nameVi: 'Tên mới', totalCreditsMin: 1 });
  });

  it("carries a cohort's credit total only when it changes, null included", () => {
    expect(detailsPatch(COHORT_FIELDS, cohort, { totalCreditsMin: 120 })).toEqual({});
    expect(detailsPatch(COHORT_FIELDS, cohort, { totalCreditsMin: null })).toEqual({ totalCreditsMin: null });
    expect(detailsPatch(COHORT_FIELDS, cohort, { totalCreditsMin: 0 })).toEqual({ totalCreditsMin: 0 });
  });
});
