import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { MAX_TRANSCRIPT_ROWS, TranscriptDto } from './transcript.dto.js';

// Synthetic rows only (AGENTS.md hard rule 3).
const row = (overrides: Record<string, unknown> = {}) => ({
  courseCode: 'CSC10001',
  courseName: 'Introduction to Programming',
  credits: 4,
  result: 'graded',
  grade: 8.5,
  term: { year: 2025, number: 1 },
  ...overrides,
});

async function errorsFor(rows: unknown[]): Promise<string[]> {
  const dto = plainToInstance(TranscriptDto, { rows });
  const flatten = (errors: Awaited<ReturnType<typeof validate>>, path: string): string[] =>
    errors.flatMap((e) => [...Object.keys(e.constraints ?? {}).map((c) => `${path}${e.property}:${c}`), ...flatten(e.children ?? [], `${path}${e.property}.`)]);
  return flatten(await validate(dto), '');
}

describe('TranscriptDto validation', () => {
  it('accepts a graded row and a retake of it in the same term', async () => {
    expect(await errorsFor([row(), row({ grade: 3 })])).toEqual([]);
  });

  it.each(['in_progress', 'exempt', 'pass', 'fail'])('accepts a row with result %s and no grade, null or left out', async (result) => {
    expect(await errorsFor([row({ result, grade: null }), row({ result, grade: undefined })])).toEqual([]);
  });

  it('normalises the course code to upper case without spaces', () => {
    const dto = plainToInstance(TranscriptDto, { rows: [row({ courseCode: ' csc10001 ', courseName: '  Intro  ' })] });
    expect(dto.rows[0].courseCode).toBe('CSC10001');
    expect(dto.rows[0].courseName).toBe('Intro');
  });

  it.each([
    ['a missing result (incomplete row, UC-02 A2)', { result: undefined }, 'isIn'],
    ['an unknown result', { result: 'audited' }, 'isIn'],
    ['a graded row without a grade (incomplete row, UC-02 A2)', { grade: undefined }, 'isNumber'],
    ['a graded row with a null grade', { grade: null }, 'isNumber'],
    ['an exempt row with a grade', { result: 'exempt', grade: 8 }, 'nullUnlessGraded'],
    ['a row in progress with a grade of 0', { result: 'in_progress', grade: 0 }, 'nullUnlessGraded'],
    ['a passed row with a grade', { result: 'pass', grade: 10 }, 'nullUnlessGraded'],
    ['grade above 10', { grade: 10.5 }, 'max'],
    ['negative grade', { grade: -1 }, 'min'],
    ['grade with two decimals', { grade: 7.25 }, 'isNumber'],
    ['a missing term', { term: undefined }, 'isDefined'],
    ['term number 4', { term: { year: 2025, number: 4 } }, 'isIn'],
    ['term year out of range', { term: { year: 1999, number: 1 } }, 'min'],
    ['course code with punctuation', { courseCode: 'CSC-100' }, 'matches'],
    ['empty course name', { courseName: '   ' }, 'minLength'],
    ['fractional credits', { credits: 3.5 }, 'isInt'],
  ])('rejects %s', async (_label, overrides, constraint) => {
    expect((await errorsFor([row(overrides)])).some((e) => e.endsWith(`:${constraint}`))).toBe(true);
  });

  // The grade rule only applies once the result is valid, so the client sees one error.
  it.each([
    ['a missing result', { result: undefined }],
    ['an unknown result', { result: 'audited' }],
  ])('rejects a row with a grade and %s with the result error only', async (_label, overrides) => {
    expect(await errorsFor([row({ grade: 8.5, ...overrides })])).toEqual(['rows.0.result:isIn']);
  });

  it(`rejects more than ${MAX_TRANSCRIPT_ROWS} rows`, async () => {
    const rows = Array.from({ length: MAX_TRANSCRIPT_ROWS + 1 }, (_, i) => row({ courseCode: `C${i}` }));
    expect(await errorsFor(rows)).toContain('rows:arrayMaxSize');
  });
});
