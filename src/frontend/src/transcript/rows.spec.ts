import { describe, expect, it, vi } from 'vitest';
import type { TranscriptRow } from './api.js';
import { blankRow, fromRow, parseCredits, parseGrade, problems, toRow, yearChoices, type DraftRow } from './rows.js';

const draft = (overrides: Partial<DraftRow> = {}): DraftRow => ({
  key: 0,
  year: 2025,
  number: 1,
  courseCode: 'ZZ101',
  courseName: 'Môn học thử',
  credits: '4',
  result: 'graded',
  grade: '8.5',
  ...overrides,
});

describe('parseGrade', () => {
  it.each([
    ['8.5', 8.5],
    ['8,5', 8.5],
    [' 10 ', 10],
    ['0', 0],
    ['10.0', 10],
  ])('reads %j as %j', (text, grade) => {
    expect(parseGrade(text)).toBe(grade);
  });

  it.each(['', '8.55', '10.5', '11', '-1', 'abc', '8.', '.5', '1e1'])('refuses %j', (text) => {
    expect(parseGrade(text)).toBeNull();
  });
});

describe('parseCredits', () => {
  it.each([
    ['4', 4],
    ['0', 0],
    ['30', 30],
    [' 3 ', 3],
  ])('reads %j as %j', (text, credits) => {
    expect(parseCredits(text)).toBe(credits);
  });

  it.each(['', '31', '2.5', '-1', 'abc', '100'])('refuses %j', (text) => {
    expect(parseCredits(text)).toBeNull();
  });
});

describe('problems (UC-02 A2)', () => {
  it('finds none in a complete row', () => {
    expect(problems(draft())).toEqual([]);
  });

  it('takes a code the API will trim and upper-case', () => {
    expect(problems(draft({ courseCode: ' zz101 ' }))).toEqual([]);
  });

  it.each([
    [{ courseCode: '' }, ['courseCode']],
    [{ courseCode: 'ZZ-101' }, ['courseCode']],
    [{ courseCode: 'Z' }, ['courseCode']],
    [{ courseName: '   ' }, ['courseName']],
    [{ courseName: 'x'.repeat(256) }, ['courseName']],
    [{ credits: '31' }, ['credits']],
    [{ result: '' as const }, ['result']],
    [{ grade: '' }, ['grade']],
    [{ grade: '10.5' }, ['grade']],
    [{ year: 1999 }, ['term']],
    [{ year: 2101 }, ['term']],
  ])('flags %j', (overrides, expected) => {
    expect(problems(draft(overrides))).toEqual(expected);
  });

  it.each(['in_progress', 'exempt', 'pass', 'fail'] as const)('needs no grade for %s (UC-02 A3)', (result) => {
    expect(problems(draft({ result, grade: '' }))).toEqual([]);
  });

  it('lists every problem of a blank row in table order', () => {
    expect(problems(draft({ courseCode: '', courseName: '', credits: '', result: '' }))).toEqual(['courseCode', 'courseName', 'credits', 'result']);
  });
});

describe('toRow and fromRow', () => {
  it('sends the row as the API stores it', () => {
    expect(toRow(draft({ courseCode: ' zz101 ', courseName: ' Môn học thử ', credits: '04', grade: '8,5' }))).toEqual({
      courseCode: 'ZZ101',
      courseName: 'Môn học thử',
      credits: 4,
      result: 'graded',
      grade: 8.5,
      term: { year: 2025, number: 1 },
    });
  });

  it('sends no grade unless graded, even if one was typed before the result changed', () => {
    expect(toRow(draft({ result: 'exempt', grade: '9' })).grade).toBeNull();
  });

  it('round-trips a saved row', () => {
    const saved: TranscriptRow = { courseCode: 'ZZ102', courseName: 'Môn thử 2', credits: 3, result: 'graded', grade: 7, term: { year: 2024, number: 3 } };
    const row = fromRow(saved, 5);
    expect(row).toMatchObject({ key: 5, grade: '7.0', credits: '3', year: 2024, number: 3 });
    expect(toRow(row)).toEqual(saved);
    expect(fromRow({ ...saved, result: 'in_progress', grade: null }, 6).grade).toBe('');
  });
});

describe('blankRow', () => {
  it('starts in the term of the last row, with nothing filled in', () => {
    expect(blankRow(9, [draft({ year: 2024, number: 2 })])).toEqual({ key: 9, year: 2024, number: 2, courseCode: '', courseName: '', credits: '', result: '', grade: '' });
  });

  it('starts in the current academic year when the table is empty', () => {
    expect(blankRow(0, [], new Date(2026, 10, 9)).year).toBe(2026);
    expect(blankRow(0, [], new Date(2026, 2, 1)).year).toBe(2025);
  });

  it('counts the academic year on the date in Vietnam, as the API does, not on the browser clock', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles');
    try {
      // Still 31 August in Los Angeles, already 1 September (academic year 2026) in Vietnam.
      expect(blankRow(0, [], new Date('2026-08-31T18:00:00Z')).year).toBe(2026);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('yearChoices', () => {
  it('offers ten years back to next year, plus any year a row has', () => {
    const years = yearChoices([draft({ year: 2005 })], new Date(2026, 10, 9));
    expect(years[0]).toBe(2005);
    expect(years.slice(1)).toEqual([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027]);
  });
});
