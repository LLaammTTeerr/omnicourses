import { describe, expect, it } from 'vitest';
import type { CatalogColumn, CsvRow } from './csv-file.js';
import { impactVersion } from './catalog-admin.service.js';
import { catalogReviewVersion, checkCatalogRow, linksReviewVersion } from './csv-import.service.js';
import { MAX_INTEGER, wholeNumberOrText } from './curriculum-admin.dto.js';

const row = (values: Partial<Record<CatalogColumn, string>>): CsvRow<CatalogColumn> => ({
  record: 2,
  values: { code: 'ZZ101', name_vi: 'Học phần thử', name_en: '', credits: '4', theory_periods: '', lab_periods: '', exercise_periods: '', project_periods: '', ...values },
});
const errorsOf = async (values: Partial<Record<CatalogColumn, string>>) => (await checkCatalogRow(row(values))).errors.map((e) => [e.field, e.message]);

describe('wholeNumberOrText', () => {
  it('turns digits into a number and leaves everything else as text for the validator to refuse', () => {
    expect([wholeNumberOrText('4'), wholeNumberOrText('0'), wholeNumberOrText('030')]).toEqual([4, 0, 30]);
    for (const text of ['3.0', '1e2', '+3', '-1', '0x10', '4 ', ' 4', '4,0', '٤', 'four', '']) expect(wholeNumberOrText(text)).toBe(text);
  });
});

describe('checkCatalogRow', () => {
  it('normalizes a valid row: canonical code, null for a blank English name, null for a blank period count', async () => {
    expect(await checkCatalogRow(row({ code: 'zz101', theory_periods: '30' }))).toEqual({
      code: 'ZZ101',
      values: { nameVi: 'Học phần thử', nameEn: null, credits: 4, theoryPeriods: 30, labPeriods: null, exercisePeriods: null, projectPeriods: null },
      errors: [],
    });
    expect((await checkCatalogRow(row({ name_en: 'Trial Course' }))).values?.nameEn).toBe('Trial Course');
  });

  it('reads an empty cell of every period column as null and a written 0 as 0', async () => {
    const values = (await checkCatalogRow(row({}))).values;
    expect([values?.theoryPeriods, values?.labPeriods, values?.exercisePeriods, values?.projectPeriods]).toEqual([null, null, null, null]);
    const zeros = (await checkCatalogRow(row({ theory_periods: '0', lab_periods: '0', exercise_periods: '0', project_periods: '0' }))).values;
    expect([zeros?.theoryPeriods, zeros?.labPeriods, zeros?.exercisePeriods, zeros?.projectPeriods]).toEqual([0, 0, 0, 0]);
    const mixed = (await checkCatalogRow(row({ theory_periods: '45', lab_periods: '30', project_periods: '0' }))).values;
    expect([mixed?.theoryPeriods, mixed?.labPeriods, mixed?.exercisePeriods, mixed?.projectPeriods]).toEqual([45, 30, null, 0]);
  });

  it('refuses a number that is not a whole number, in the words of manual entry', async () => {
    for (const credits of ['3.0', '1e2', '+3', '0x10', 'four', '-2']) {
      expect(await errorsOf({ credits })).toEqual([['credits', 'must not be less than 1; must be an integer number']]);
    }
    expect(await errorsOf({ credits: '0' })).toEqual([['credits', 'must not be less than 1']]);
    expect(await errorsOf({ lab_periods: '1.5' })).toEqual([['lab_periods', 'must not be less than 0; must be an integer number']]);
    expect(await errorsOf({ project_periods: String(MAX_INTEGER + 1) })).toEqual([['project_periods', `must not be greater than ${MAX_INTEGER}`]]);
    expect(await errorsOf({ credits: '9'.repeat(30) })).toEqual([['credits', `must not be greater than ${MAX_INTEGER}`]]);
    expect(await errorsOf({ credits: '9'.repeat(400) })).toEqual([['credits', 'must be an integer number']]);
    expect(await errorsOf({ credits: String(MAX_INTEGER) })).toEqual([]);
  });

  it('refuses a missing code, name or credit count through the same validation, with no check of its own', async () => {
    expect(await errorsOf({ code: '', name_vi: '', credits: '' })).toEqual([
      ['code', '"" is not a course code (letters A-Z and digits, 2 to 20)'],
      ['name_vi', 'should not be empty'],
      ['credits', 'must not be less than 1; must be an integer number'],
    ]);
  });

  it('refuses a malformed code and an overlong name, and still returns a code it could read', async () => {
    expect(await errorsOf({ code: 'zz.101' })).toEqual([['code', '"zz.101" is not a course code (letters A-Z and digits, 2 to 20)']]);
    const long = await checkCatalogRow(row({ name_vi: 'x'.repeat(256), name_en: 'y'.repeat(256) }));
    expect(long.errors.map((e) => e.field)).toEqual(['name_vi', 'name_en']);
    expect([long.code, long.values]).toEqual(['ZZ101', null]);
  });
});

describe('review versions: the values from before the refactor, so a file previewed before a deploy still confirms after it', () => {
  const current = { nameVi: 'Học phần thử', nameEn: null, credits: 4, theoryPeriods: 30, labPeriods: 0, exercisePeriods: 0, projectPeriods: 0 };
  const proposed = { ...current, credits: 3, nameEn: 'Trial Course' };
  const affected = ['00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000c2'].map((curriculumId) => ({ curriculumId, curriculumCode: 'ZZ', programCode: 'ZZ', cohortYear: 2024 }));
  const impact = 'oNYs1fxh3MFOA5MEaqw_XjoX9_ln7ZxZK0eYPmRRqE8';

  it('keeps the version of a shared-course change', () => {
    expect(impactVersion('ZZ101', current, proposed, affected)).toBe(impact);
  });

  it('keeps the version of a catalog courses file', () => {
    const rows = [
      { code: 'ZZ101', values: proposed, action: 'update' as const, impactVersion: impact },
      { code: 'ZZ102', values: current, action: 'insert' as const, impactVersion: null },
      { code: 'ZZ103', values: current, action: 'no_op' as const, impactVersion: null },
    ];
    expect(catalogReviewVersion('f12-structural-1', rows)).toBe('LmAxdUO13TXHORF1QD1qAEZm31HJPqySO_KDF55M7qY');
  });

  it('keeps the version of a group-links file', () => {
    const group = '00000000-0000-4000-8000-0000000000a1';
    const rows = [
      { groupName: 'Nhóm thử', groupId: group, code: 'ZZ101', action: 'insert' as const },
      { groupName: 'Nhóm thử', groupId: group, code: 'ZZ102', action: 'no_op' as const },
    ];
    expect(linksReviewVersion('f12-structural-1', '00000000-0000-4000-8000-0000000000p1', '00000000-0000-4000-8000-0000000000c1', rows)).toBe('Tsc6Rxo6GM2zCBpKywA9L3_1m84HNCgk4c1w730wGCQ');
  });
});
