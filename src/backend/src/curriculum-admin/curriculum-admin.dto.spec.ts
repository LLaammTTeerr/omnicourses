import { describe, expect, it } from 'vitest';
import { flattenErrors, validateStrict } from '../common/api-requests.js';
import { CreateCourseDto, MAX_INTEGER, UpdateCourseDto } from './curriculum-admin.dto.js';

const messages = async (dto: typeof CreateCourseDto | typeof UpdateCourseDto, body: object) => flattenErrors((await validateStrict<object>(dto, body)).errors ?? []);
const course = { code: 'ZZ101', nameVi: 'Học phần thử', credits: 3 };

// The bound on credit and period counts exists so that a number PostgreSQL cannot store is a
// 400. It must add nothing to the answer for a value that is not a whole number.
describe('credit and period counts', () => {
  it('answers a value that is not a whole number with the messages it had before the bound existed', async () => {
    for (const credits of ['abc', '3', null, undefined, {}]) {
      expect(await messages(CreateCourseDto, { ...course, credits })).toEqual(['credits must not be less than 1', 'credits must be an integer number']);
    }
    expect(await messages(CreateCourseDto, { ...course, credits: 2.5 })).toEqual(['credits must be an integer number']);
    expect(await messages(CreateCourseDto, { ...course, credits: Infinity })).toEqual(['credits must be an integer number']);
    expect(await messages(CreateCourseDto, { ...course, theoryPeriods: 'x' })).toEqual(['theoryPeriods must not be less than 0', 'theoryPeriods must be an integer number']);
    expect(await messages(UpdateCourseDto, { credits: 'abc', labPeriods: '4' })).toEqual([
      'credits must not be less than 1',
      'credits must be an integer number',
      'labPeriods must not be less than 0',
      'labPeriods must be an integer number',
    ]);
  });

  it('refuses a whole number above what the database stores, and only that', async () => {
    expect(await messages(CreateCourseDto, { ...course, credits: MAX_INTEGER + 1, projectPeriods: 1e30 })).toEqual([
      `credits must not be greater than ${MAX_INTEGER}`,
      `projectPeriods must not be greater than ${MAX_INTEGER}`,
    ]);
    expect(await messages(UpdateCourseDto, { exercisePeriods: MAX_INTEGER + 1 })).toEqual([`exercisePeriods must not be greater than ${MAX_INTEGER}`]);
    expect(await messages(CreateCourseDto, { ...course, credits: MAX_INTEGER, theoryPeriods: MAX_INTEGER })).toEqual([]);
    expect(await messages(CreateCourseDto, { ...course, credits: 0, labPeriods: -1 })).toEqual(['credits must not be less than 1', 'labPeriods must not be less than 0']);
  });
});
