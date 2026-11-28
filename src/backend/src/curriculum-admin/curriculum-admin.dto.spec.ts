import type { Type } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { flattenErrors, validateStrict } from '../common/api-requests.js';
import { ImportConfirmRequestDto } from './csv-import.dto.js';
import {
  CreateCourseDto,
  CreateRequirementGroupDto,
  UpdateCourseDto,
  UpdateRequirementGroupDto,
} from './curriculum-admin.dto.js';

const messages = async (dto: Type<object>, body: object) => flattenErrors((await validateStrict<object>(dto, body)).errors ?? []);
const INT4_MAX = 2_147_483_647;
const OFFICIAL_NOTES_LIMIT = 2000;
const TOKEN_LIMIT = 128;
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
    expect(await messages(CreateCourseDto, { ...course, credits: INT4_MAX + 1, projectPeriods: 1e30 })).toEqual([
      `credits must not be greater than ${INT4_MAX}`,
      `projectPeriods must not be greater than ${INT4_MAX}`,
    ]);
    expect(await messages(UpdateCourseDto, { exercisePeriods: INT4_MAX + 1 })).toEqual([`exercisePeriods must not be greater than ${INT4_MAX}`]);
    expect(await messages(CreateCourseDto, { ...course, credits: INT4_MAX, theoryPeriods: INT4_MAX })).toEqual([]);
    expect(await messages(CreateCourseDto, { ...course, credits: 0, labPeriods: -1 })).toEqual(['credits must not be less than 1', 'labPeriods must not be less than 0']);
  });
});

describe('requirement-group credit totals', () => {
  const group = { name: 'Nhóm thử', kind: 'elective' };

  it('accepts a whole number from 0, or null, on create and update', async () => {
    for (const value of [0, 16, MAX_INTEGER, null]) {
      expect(await messages(CreateRequirementGroupDto, { ...group, creditsTotal: value, creditsTotalMin: value })).toEqual([]);
      expect(await messages(UpdateRequirementGroupDto, { creditsTotal: value, creditsTotalMin: value })).toEqual([]);
    }
  });

  it('refuses a negative number, a fraction, text and a number above what the database stores', async () => {
    for (const [dto, base] of [[CreateRequirementGroupDto, group], [UpdateRequirementGroupDto, {}]] as const) {
      for (const field of ['creditsTotal', 'creditsTotalMin']) {
        expect(await messages(dto, { ...base, [field]: -1 })).toEqual([`${field} must not be less than 0`]);
        expect(await messages(dto, { ...base, [field]: 2.5 })).toEqual([`${field} must be an integer number`]);
        expect(await messages(dto, { ...base, [field]: '16' })).toEqual(expect.arrayContaining([`${field} must be an integer number`]));
        expect(await messages(dto, { ...base, [field]: MAX_INTEGER + 1 })).toEqual([`${field} must not be greater than ${MAX_INTEGER}`]);
      }
    }
  });
});

describe('code-point length bounds on notes and review tokens', () => {
  const FIELDS: [Type<object>, object, string, number][] = [
    [CreateRequirementGroupDto, { name: 'Nhóm thử', kind: 'elective' }, 'officialNotes', OFFICIAL_NOTES_LIMIT],
    [UpdateRequirementGroupDto, {}, 'officialNotes', OFFICIAL_NOTES_LIMIT],
    [UpdateCourseDto, {}, 'confirmImpact', TOKEN_LIMIT],
    [ImportConfirmRequestDto, { csv: 'code\nZZ101\n' }, 'reviewVersion', TOKEN_LIMIT],
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
