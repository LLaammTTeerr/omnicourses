import type { Type } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { flattenErrors, validateStrict } from '../common/api-requests.js';
import { ImportConfirmRequestDto, REVIEW_VERSION_MAX_LENGTH } from './csv-import.dto.js';
import {
  CONFIRM_IMPACT_MAX_LENGTH,
  CreateCourseDto,
  CreateRequirementGroupDto,
  MAX_INTEGER,
  OFFICIAL_NOTES_MAX_LENGTH,
  UpdateCourseDto,
  UpdateRequirementGroupDto,
} from './curriculum-admin.dto.js';

const messages = async (dto: Type<object>, body: object) => flattenErrors((await validateStrict<object>(dto, body)).errors ?? []);
const course = { code: 'ZZ101', nameVi: 'Học phần thử', credits: 3 };

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

describe('code-point length bounds on notes and review tokens', () => {
  const FIELDS: [Type<object>, object, string, number][] = [
    [CreateRequirementGroupDto, { name: 'Nhóm thử', kind: 'elective' }, 'officialNotes', OFFICIAL_NOTES_MAX_LENGTH],
    [UpdateRequirementGroupDto, {}, 'officialNotes', OFFICIAL_NOTES_MAX_LENGTH],
    [UpdateCourseDto, {}, 'confirmImpact', CONFIRM_IMPACT_MAX_LENGTH],
    [ImportConfirmRequestDto, { csv: 'code\nZZ101\n' }, 'reviewVersion', REVIEW_VERSION_MAX_LENGTH],
  ];

  it('bounds officialNotes to 2000 code points and confirmImpact / reviewVersion to 128 code points', async () => {
    for (const [dto, base, field, max] of FIELDS) {
      for (const value of ['x'.repeat(max + 1), 'x'.repeat(max - 1) + '\u2764\uFE0F', '\u{1F600}'.repeat(max + 1)]) {
        expect([dto.name, field, await messages(dto, { ...base, [field]: value })]).toEqual([
          dto.name,
          field,
          [`${field} must be shorter than or equal to ${max} characters`],
        ]);
      }
      for (const value of ['x'.repeat(max), '\u{1F600}'.repeat(max), 'x'.repeat(max - 2) + '\u2764\uFE0F']) {
        expect([dto.name, field, await messages(dto, { ...base, [field]: value })]).toEqual([dto.name, field, []]);
      }
    }
  });
});
