import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { MAX_TRANSCRIPT_ROWS, TranscriptDto } from './transcript.dto.js';

// Synthetic rows only (AGENTS.md hard rule 3).
const row = (overrides: Record<string, unknown> = {}) => ({
  courseCode: 'CSC10001',
  courseName: 'Introduction to Programming',
  credits: 4,
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
  it('accepts a graded row, a row in progress (grade null) and a retake in the same term', async () => {
    expect(await errorsFor([row(), row({ courseCode: 'MTH00003', grade: null }), row({ grade: 3 })])).toEqual([]);
  });

  it('normalises the course code to upper case without spaces', () => {
    const dto = plainToInstance(TranscriptDto, { rows: [row({ courseCode: ' csc10001 ', courseName: '  Intro  ' })] });
    expect(dto.rows[0].courseCode).toBe('CSC10001');
    expect(dto.rows[0].courseName).toBe('Intro');
  });

  it.each([
    ['a missing grade (incomplete row, UC-02 A2)', { grade: undefined }, 'isNumber'],
    ['grade above 10', { grade: 10.5 }, 'max'],
    ['negative grade', { grade: -1 }, 'min'],
    ['grade with two decimals', { grade: 7.25 }, 'isNumber'],
    ['term number 4', { term: { year: 2025, number: 4 } }, 'isIn'],
    ['term year out of range', { term: { year: 1999, number: 1 } }, 'min'],
    ['course code with punctuation', { courseCode: 'CSC-100' }, 'matches'],
    ['empty course name', { courseName: '   ' }, 'minLength'],
    ['fractional credits', { credits: 3.5 }, 'isInt'],
  ])('rejects %s', async (_label, overrides, constraint) => {
    expect((await errorsFor([row(overrides)])).some((e) => e.endsWith(`:${constraint}`))).toBe(true);
  });

  it(`rejects more than ${MAX_TRANSCRIPT_ROWS} rows`, async () => {
    const rows = Array.from({ length: MAX_TRANSCRIPT_ROWS + 1 }, (_, i) => row({ courseCode: `C${i}` }));
    expect(await errorsFor(rows)).toContain('rows:arrayMaxSize');
  });
});
