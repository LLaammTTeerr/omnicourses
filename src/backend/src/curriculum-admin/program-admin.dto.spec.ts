import type { Type } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { flattenErrors, validateStrict } from '../common/api-requests.js';
import { CURRICULUM_SEEDS } from '../curriculum/seeds/index.js';
import { ADMIN_CODE_PATTERN, canonicalAdminCode, CreateCohortDto, CreateProgramDto, UpdateCohortDto, UpdateProgramDto } from './program-admin.dto.js';

const errorsOf = async (dto: Type<object>, body: unknown): Promise<string[]> => {
  const checked = await validateStrict(dto, body);
  return checked.errors ? flattenErrors(checked.errors) : [];
};
const valueOf = async <T extends object>(dto: Type<T>, body: unknown): Promise<T | null> => (await validateStrict(dto, body)).value;

const PROGRAM = { code: 'ZZ-PROG', nameVi: 'Chương trình thử' };
const COHORT = { cohortYear: 2024, code: 'ZZ-PROG-2024', nameVi: 'Khóa thử 2024' };

describe('CreateProgramDto', () => {
  it('trims and upper-cases the code, trims the names, and keeps what is left out undefined', async () => {
    expect(await valueOf(CreateProgramDto, { code: ' zz-prog ', nameVi: '  Chương trình thử ', nameEn: ' Trial Program ', faculty: null })).toEqual({
      code: 'ZZ-PROG',
      nameVi: 'Chương trình thử',
      nameEn: 'Trial Program',
      faculty: null,
    });
    expect(await valueOf(CreateProgramDto, PROGRAM)).toEqual(PROGRAM);
  });

  it('refuses a code that is not letters, digits and single hyphens, or is too long', async () => {
    for (const code of ['', 'zz prog', 'ZZ_PROG', 'ZZ/PROG', '-ZZ', 'ZZ--PROG', 'Z'.repeat(51), 7, null]) {
      expect([code, (await errorsOf(CreateProgramDto, { ...PROGRAM, code })).some((e) => e.startsWith('code'))]).toEqual([code, true]);
    }
    expect(await errorsOf(CreateProgramDto, { nameVi: 'x' })).toEqual(expect.arrayContaining([expect.stringContaining('code')]));
  });

  it('refuses a blank or overlong name and an overlong faculty', async () => {
    expect(await errorsOf(CreateProgramDto, { ...PROGRAM, nameVi: '   ' })).toEqual(['nameVi should not be empty']);
    expect(await errorsOf(CreateProgramDto, { ...PROGRAM, nameVi: 'x'.repeat(256) })).toEqual([expect.stringContaining('nameVi must be shorter than or equal to 255')]);
    expect(await errorsOf(CreateProgramDto, { ...PROGRAM, nameEn: 'x'.repeat(256) })).toEqual([expect.stringContaining('nameEn must be shorter than or equal to 255')]);
    expect(await errorsOf(CreateProgramDto, { ...PROGRAM, faculty: 'x'.repeat(101) })).toEqual([expect.stringContaining('faculty must be shorter than or equal to 100')]);
    expect(await errorsOf(CreateProgramDto, { ...PROGRAM, faculty: 'x'.repeat(100) })).toEqual([]);
  });

  it('refuses a training type, a grant and any other undeclared field', async () => {
    for (const field of ['trainingType', 'id', 'grantTo', 'curricula', 'updatedAt']) {
      expect(await errorsOf(CreateProgramDto, { ...PROGRAM, [field]: 'standard' })).toEqual([`${field}: property ${field} should not exist`]);
    }
  });
});

describe('UpdateProgramDto', () => {
  it('accepts any subset of the details, null to clear an optional one, and an empty body', async () => {
    expect(await valueOf(UpdateProgramDto, {})).toEqual({});
    expect(await valueOf(UpdateProgramDto, { nameVi: ' Tên mới ' })).toEqual({ nameVi: 'Tên mới' });
    expect(await valueOf(UpdateProgramDto, { nameEn: null, faculty: null })).toEqual({ nameEn: null, faculty: null });
  });

  it('refuses the code, also unchanged, instead of ignoring it', async () => {
    expect(await errorsOf(UpdateProgramDto, { code: 'ZZ-OTHER' })).toEqual(['code: property code should not exist']);
    expect(await errorsOf(UpdateProgramDto, { nameVi: 'Tên mới', code: 'ZZ-PROG' })).toEqual(['code: property code should not exist']);
    expect(await errorsOf(UpdateProgramDto, { id: '1b0d2a4c-0000-4000-8000-000000000000' })).toEqual(['id: property id should not exist']);
    expect(await errorsOf(UpdateProgramDto, { trainingType: 'standard' })).toEqual(['trainingType: property trainingType should not exist']);
  });

  it('does not let the required name be cleared', async () => {
    expect(await errorsOf(UpdateProgramDto, { nameVi: null })).not.toEqual([]);
    expect(await errorsOf(UpdateProgramDto, { nameVi: ' ' })).toEqual(['nameVi should not be empty']);
  });
});

describe('CreateCohortDto', () => {
  it('accepts a cohort, with a canonical code and trimmed text', async () => {
    expect(await valueOf(CreateCohortDto, { ...COHORT, code: ' zz-prog-2024', nameEn: ' Trial 2024 ', language: ' en ' })).toEqual({ ...COHORT, nameEn: 'Trial 2024', language: 'en' });
  });

  it("holds the cohort year to the schema's bound, as a whole number", async () => {
    for (const cohortYear of [2000, 2100]) expect(await errorsOf(CreateCohortDto, { ...COHORT, cohortYear })).toEqual([]);
    for (const cohortYear of [1999, 2101, 2024.5, '2024', null, undefined, -2024]) {
      expect([cohortYear, (await errorsOf(CreateCohortDto, { ...COHORT, cohortYear })).some((e) => e.startsWith('cohortYear'))]).toEqual([cohortYear, true]);
    }
  });

  it('refuses the gated credit total, a program ID and any other undeclared field', async () => {
    for (const [field, value] of [['totalCreditsMin', 120], ['totalCreditsMin', null], ['programId', '1b0d2a4c-0000-4000-8000-000000000000'], ['copyFrom', 2024], ['requirementGroups', []]] as const) {
      expect(await errorsOf(CreateCohortDto, { ...COHORT, [field]: value })).toEqual([`${field}: property ${field} should not exist`]);
    }
  });

  it('refuses a malformed code and an overlong language', async () => {
    expect(await errorsOf(CreateCohortDto, { ...COHORT, code: 'ZZ PROG 2024' })).toEqual([expect.stringContaining('code must be letters A-Z and digits')]);
    expect(await errorsOf(CreateCohortDto, { ...COHORT, language: 'x'.repeat(11) })).toEqual([expect.stringContaining('language must be shorter than or equal to 10')]);
  });
});

describe('UpdateCohortDto', () => {
  it('accepts any subset of the details and an empty body', async () => {
    expect(await valueOf(UpdateCohortDto, {})).toEqual({});
    expect(await valueOf(UpdateCohortDto, { nameVi: ' Khóa thử ', nameEn: null, language: 'vi' })).toEqual({ nameVi: 'Khóa thử', nameEn: null, language: 'vi' });
  });

  it('refuses each identifier and the gated credit total, instead of ignoring them', async () => {
    for (const [field, value] of [['cohortYear', 2025], ['programId', '1b0d2a4c-0000-4000-8000-000000000000'], ['code', 'ZZ-PROG-2025'], ['id', 'x'], ['totalCreditsMin', 120], ['totalCreditsMin', null]] as const) {
      expect(await errorsOf(UpdateCohortDto, { nameVi: 'Khóa thử', [field]: value })).toEqual([`${field}: property ${field} should not exist`]);
    }
  });
});

describe('the text fields of the program and cohort DTOs', () => {
  const FIELDS: [Type<object>, object, string, number][] = [
    [CreateProgramDto, PROGRAM, 'nameVi', 255],
    [CreateProgramDto, PROGRAM, 'nameEn', 255],
    [CreateProgramDto, PROGRAM, 'faculty', 100],
    [UpdateProgramDto, {}, 'nameVi', 255],
    [UpdateProgramDto, {}, 'nameEn', 255],
    [UpdateProgramDto, {}, 'faculty', 100],
    [CreateCohortDto, COHORT, 'nameVi', 255],
    [CreateCohortDto, COHORT, 'nameEn', 255],
    [CreateCohortDto, COHORT, 'language', 10],
    [UpdateCohortDto, {}, 'nameVi', 255],
    [UpdateCohortDto, {}, 'nameEn', 255],
    [UpdateCohortDto, {}, 'language', 10],
  ];

  it('refuses a null character anywhere in the value', async () => {
    for (const [dto, base, field] of FIELDS) {
      for (const value of ['\u0000', 'a\u0000b', 'ab\u0000']) {
        expect([dto.name, field, await errorsOf(dto, { ...base, [field]: value })]).toEqual([dto.name, field, [`${field} must not contain a null character (U+0000)`]]);
      }
    }
  });

  it('counts the length in code points, as PostgreSQL does', async () => {
    for (const [dto, base, field, max] of FIELDS) {
      const refused = [
        'x'.repeat(max - 1) + '\u2764\uFE0F',
        'x'.repeat(max + 1),
        '\u{1F600}'.repeat(max + 1),
      ];
      for (const value of refused) {
        expect([dto.name, field, [...value].length, await errorsOf(dto, { ...base, [field]: value })]).toEqual([dto.name, field, max + 1, [`${field} must be shorter than or equal to ${max} characters`]]);
      }
      for (const value of ['x'.repeat(max), '\u{1F600}'.repeat(max), 'x'.repeat(max - 2) + '\u2764\uFE0F']) {
        expect([dto.name, field, await errorsOf(dto, { ...base, [field]: value })]).toEqual([dto.name, field, []]);
      }
    }
  });
});

describe('ADMIN_CODE_PATTERN', () => {
  it('accepts every program code and curriculum code the seeds store', () => {
    const codes = CURRICULUM_SEEDS.flatMap((s) => [s.program.code, s.curriculum.code]);
    expect(codes).toEqual(expect.arrayContaining(['APCS', 'APCS2024', 'CNTT-TCTA-KHMT', 'CNTT-TCTA-KHMT-2025']));
    for (const code of codes) expect([code, ADMIN_CODE_PATTERN.test(code)]).toEqual([code, true]);
  });

  it('refuses what a URL path or a reader could confuse', () => {
    for (const code of ['', ' ', 'zz', 'ZZ 1', 'ZZ_1', 'ZZ/1', 'ZZ.1', '-ZZ', 'ZZ-', 'ZZ--1', 'ZZ%20', 'ZZ\n', 'ĐH1']) expect([code, ADMIN_CODE_PATTERN.test(code)]).toEqual([code, false]);
  });
});

describe('canonicalAdminCode', () => {
  it('trims and upper-cases text, and leaves anything else for the validators', () => {
    expect(canonicalAdminCode('  zz-prog-2024 ')).toBe('ZZ-PROG-2024');
    expect(canonicalAdminCode('zz prog')).toBe('ZZ PROG');
    for (const value of [null, undefined, 7, ['ZZ']]) expect(canonicalAdminCode(value)).toBe(value);
  });
});
