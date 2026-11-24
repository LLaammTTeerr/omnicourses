import { describe, expect, it } from 'vitest';
import type { CatalogColumn, CsvRow } from './csv-file.js';
import { checkCatalogRow } from './csv-import.service.js';
import { MAX_INTEGER, wholeNumberOrText } from './curriculum-admin.dto.js';

const row = (values: Partial<Record<CatalogColumn, string>>): CsvRow<CatalogColumn> => ({
  record: 2,
  line: 2,
  values: { code: 'ZZ101', name_vi: 'Học phần thử', name_en: '', credits: '4', theory_periods: '', lab_periods: '', exercise_periods: '', project_periods: '', ...values },
});
const errorsOf = async (values: Partial<Record<CatalogColumn, string>>) => (await checkCatalogRow(row(values))).errors.map((e) => [e.field, e.message]);

describe('wholeNumberOrText', () => {
  it('turns digits into a number and leaves everything else as text for the validator to refuse', () => {
    expect([wholeNumberOrText('4'), wholeNumberOrText('0'), wholeNumberOrText('030')]).toEqual([4, 0, 30]);
    for (const text of ['3.0', '1e2', '+3', '-1', '0x10', '4 ', ' 4', '4,0', '٤', 'four', '']) expect(wholeNumberOrText(text)).toBe(text);
  });
});

// A CSV row is checked by the DTO of the manual POST /admin/catalog/courses (ADR 0011).
describe('checkCatalogRow', () => {
  it('normalizes a valid row: canonical code, null for a blank English name, 0 for a blank period count', async () => {
    expect(await checkCatalogRow(row({ code: 'zz101', theory_periods: '30' }))).toEqual({
      code: 'ZZ101',
      values: { nameVi: 'Học phần thử', nameEn: null, credits: 4, theoryPeriods: 30, labPeriods: 0, exercisePeriods: 0, projectPeriods: 0 },
      errors: [],
    });
    expect((await checkCatalogRow(row({ name_en: 'Trial Course' }))).values?.nameEn).toBe('Trial Course');
  });

  it('refuses a number that is not a whole number, in the words of manual entry', async () => {
    for (const credits of ['3.0', '1e2', '+3', '0x10', 'four']) {
      expect(await errorsOf({ credits })).toEqual([['credits', expect.stringContaining('must be an integer number')]]);
    }
    expect(await errorsOf({ credits: '0' })).toEqual([['credits', 'must not be less than 1']]);
    expect(await errorsOf({ credits: '-2' })).toEqual([['credits', expect.stringContaining('must be an integer number')]]);
    expect(await errorsOf({ lab_periods: '1.5' })).toEqual([['lab_periods', expect.stringContaining('must be an integer number')]]);
    expect(await errorsOf({ project_periods: String(MAX_INTEGER + 1) })).toEqual([['project_periods', `must not be greater than ${MAX_INTEGER}`]]);
    expect(await errorsOf({ credits: '9'.repeat(400) })).toEqual([['credits', expect.any(String)]]);
    expect(await errorsOf({ credits: String(MAX_INTEGER) })).toEqual([]);
  });

  it('names each missing required value once, by its CSV column', async () => {
    expect(await errorsOf({ code: '', name_vi: '', credits: '' })).toEqual([
      ['code', 'a value is required'],
      ['name_vi', 'a value is required'],
      ['credits', 'a value is required'],
    ]);
  });

  it('refuses a malformed code and an overlong name, and still returns a code it could read', async () => {
    expect(await errorsOf({ code: 'zz.101' })).toEqual([['code', '"zz.101" is not a course code (letters A-Z and digits, 2 to 20)']]);
    const long = await checkCatalogRow(row({ name_vi: 'x'.repeat(256), name_en: 'y'.repeat(256) }));
    expect(long.errors.map((e) => e.field)).toEqual(['name_vi', 'name_en']);
    expect([long.code, long.values]).toEqual(['ZZ101', null]);
  });
});
