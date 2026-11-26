import { describe, expect, it } from 'vitest';
import { CURRICULUM_SEEDS } from '../database/seeds/index.js';
import { ADMIN_CODE_PATTERN, canonicalAdminCode } from './admin-code.js';

describe('ADMIN_CODE_PATTERN', () => {
  // ADR 0011, review finding 3: the format "must accept both existing formats".
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
