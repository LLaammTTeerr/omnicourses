import { describe, expect, it } from 'vitest';
import { problems } from './rows.js';
import { parseTermCell, parseTranscriptPaste } from './paste.js';

describe('parseTermCell', () => {
  it.each([
    ['2024-1', { year: 2024, number: 1 }],
    ['2024/2', { year: 2024, number: 2 }],
    ['HK1 2024-2025', { year: 2024, number: 1 }],
    ['HK3 2023–2024', { year: 2023, number: 3 }],
    ['Term 2 2025-2026', { year: 2025, number: 2 }],
    ['2024-2025/1', { year: 2024, number: 1 }],
    ['2024-2025 HK2', { year: 2024, number: 2 }],
  ])('parses %j into %j', (input, expected) => {
    expect(parseTermCell(input)).toEqual(expected);
  });

  it.each(['', '2024', '2024-4', '2024-0', '1999-1', '2101-1', '2024-2026/1', 'HK1 2024-2027', 'Spring 2024'])('rejects %j', (input) => {
    expect(parseTermCell(input)).toBeNull();
  });
});

describe('parseTranscriptPaste (F2 deterministic paste parser, ADR 0007)', () => {
  it('returns empty rows and errors for blank input', () => {
    expect(parseTranscriptPaste('')).toEqual({ rows: [], errors: [] });
    expect(parseTranscriptPaste('   \n\t\n  ')).toEqual({ rows: [], errors: [] });
  });

  it('parses a TSV portal grades paste with header skipping, blank lines, comma decimals, and all result kinds', () => {
    const text = [
      '',
      'Học kỳ\tMã MH\tTên môn học\tTín chỉ\tĐiểm',
      'HK1 2024-2025\t zz101 \tNhập môn lập trình\t4\t8,5',
      '',
      '2024/2\tZZ102\tAnh văn 1\t3\tMiễn',
      '2024-2025/3\tZZ103\tGiáo dục thể chất 1\t2\tĐ',
      '2025-1\tZZ104\tGiải tích 1\t4\tKhông đạt',
      '2025-1\tZZ105\tCấu trúc dữ liệu\t4\tĐang học',
    ].join('\r\n');

    const result = parseTranscriptPaste(text);
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      { year: 2024, number: 1, courseCode: 'ZZ101', courseName: 'Nhập môn lập trình', credits: '4', result: 'graded', grade: '8.5' },
      { year: 2024, number: 2, courseCode: 'ZZ102', courseName: 'Anh văn 1', credits: '3', result: 'exempt', grade: '' },
      { year: 2024, number: 3, courseCode: 'ZZ103', courseName: 'Giáo dục thể chất 1', credits: '2', result: 'pass', grade: '' },
      { year: 2025, number: 1, courseCode: 'ZZ104', courseName: 'Giải tích 1', credits: '4', result: 'fail', grade: '' },
      { year: 2025, number: 1, courseCode: 'ZZ105', courseName: 'Cấu trúc dữ liệu', credits: '4', result: 'in_progress', grade: '' },
    ]);
    for (const [key, row] of result.rows.entries()) {
      expect(problems({ key, ...row })).toEqual([]);
    }
  });

  it('supports pipe and semicolon tables as well as 7-column (year, termNumber, code, name, credits, result, grade) rows', () => {
    const pipeTable = [
      '| Year | Term | Course Code | Course Name | Credits | Result | Grade |',
      '| 2024 | 1 | zz201 | Linear Algebra | 04 | graded | 9 |',
      '| 2024 | 2 | ZZ202 | Physical Education | 2 | PASS | |',
      '| 2025 | 1 | ZZ203 | Operating Systems | 4 | IN_PROGRESS | |',
    ].join('\n');

    const parsedPipe = parseTranscriptPaste(pipeTable);
    expect(parsedPipe.errors).toEqual([]);
    expect(parsedPipe.rows).toEqual([
      { year: 2024, number: 1, courseCode: 'ZZ201', courseName: 'Linear Algebra', credits: '4', result: 'graded', grade: '9.0' },
      { year: 2024, number: 2, courseCode: 'ZZ202', courseName: 'Physical Education', credits: '2', result: 'pass', grade: '' },
      { year: 2025, number: 1, courseCode: 'ZZ203', courseName: 'Operating Systems', credits: '4', result: 'in_progress', grade: '' },
    ]);

    const semicolonTable = ['Code;Term;Credits'];
    expect(parseTranscriptPaste(semicolonTable.join('\n'))).toEqual({ rows: [], errors: [] });

    const semiData = [
      '2024;1;ZZ301;Discrete Mathematics;4;7.5',
      '2024-2;ZZ302;Foreign Language;3;EXEMPT;',
    ].join('\n');
    expect(parseTranscriptPaste(semiData)).toEqual({
      rows: [
        { year: 2024, number: 1, courseCode: 'ZZ301', courseName: 'Discrete Mathematics', credits: '4', result: 'graded', grade: '7.5' },
        { year: 2024, number: 2, courseCode: 'ZZ302', courseName: 'Foreign Language', credits: '3', result: 'exempt', grade: '' },
      ],
      errors: [],
    });
  });

  it.each([
    ['0', 'graded', '0.0'],
    ['10', 'graded', '10.0'],
    ['8.5', 'graded', '8.5'],
    ['8,5', 'graded', '8.5'],
    ['M', 'exempt', ''],
    ['Miễn', 'exempt', ''],
    ['MIỄN', 'exempt', ''],
    ['exempt', 'exempt', ''],
    ['Đ', 'pass', ''],
    ['Đạt', 'pass', ''],
    ['PASS', 'pass', ''],
    ['P', 'pass', ''],
    ['KĐ', 'fail', ''],
    ['Không đạt', 'fail', ''],
    ['Rớt', 'fail', ''],
    ['FAIL', 'fail', ''],
    ['F', 'fail', ''],
    ['Đang học', 'in_progress', ''],
    ['IN_PROGRESS', 'in_progress', ''],
    ['IP', 'in_progress', ''],
    ['--', 'in_progress', ''],
  ] as const)('maps token %j deterministically to %s (%j)', (token, expectedResult, expectedGrade) => {
    const { rows, errors } = parseTranscriptPaste(`2024-1\tZZ101\tSample Course\t3\t${token}`);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { year: 2024, number: 1, courseCode: 'ZZ101', courseName: 'Sample Course', credits: '3', result: expectedResult, grade: expectedGrade },
    ]);
  });

  it('does not mistakenly skip a headerless first row whose course name contains Mã, Code, or Course, even when its term is malformed', () => {
    const { rows, errors } = parseTranscriptPaste('2024-1\tZZ101\tMã hóa và Clean Code Course\t4\t9,0');
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.courseName).toBe('Mã hóa và Clean Code Course');

    const badTermVi = parseTranscriptPaste('2024-4\tCS101\tMã hóa\t4\t8.5');
    expect(badTermVi).toEqual({
      rows: [],
      errors: [{ line: 1, text: '2024-4\tCS101\tMã hóa\t4\t8.5', reason: 'term' }],
    });

    const typoTermEn = parseTranscriptPaste('2O24-1\tCS101\tCode Design\t4\t8.5');
    expect(typoTermEn).toEqual({
      rows: [],
      errors: [{ line: 1, text: '2O24-1\tCS101\tCode Design\t4\t8.5', reason: 'term' }],
    });
  });

  it('never drops or guesses malformed lines, reporting 1-based line numbers and specific reasons', () => {
    const text = [
      'Term\tCourse Code\tCourse Name\tCredits\tResult',
      '2024-1\tZZ101\tValid First\t4\t8.0',
      'only\tthree\tcolumns',
      '2024-4\tZZ102\tBad Term\t3\t8.0',
      '2024-1\tZZ-BAD!\tBad Code\t3\t8.0',
      '2024-1\tZZ103\t   \t3\t8.0',
      '2024-1\tZZ104\tBad Credits\t35\t8.0',
      '2024-1\tZZ105\tMissing Result\t3\t',
      '2024-1\tZZ106\tGrade Over Ten\t3\t10.5',
      '2024\t1\tZZ107\tContradictory Pass With Grade\t3\tPASS\t9.0',
      '2025-1\tZZ108\tValid Last\t3\tMiễn',
    ].join('\n');

    const { rows, errors } = parseTranscriptPaste(text);
    expect(rows).toEqual([
      { year: 2024, number: 1, courseCode: 'ZZ101', courseName: 'Valid First', credits: '4', result: 'graded', grade: '8.0' },
      { year: 2025, number: 1, courseCode: 'ZZ108', courseName: 'Valid Last', credits: '3', result: 'exempt', grade: '' },
    ]);
    expect(errors).toEqual([
      { line: 3, text: 'only\tthree\tcolumns', reason: 'columns' },
      { line: 4, text: '2024-4\tZZ102\tBad Term\t3\t8.0', reason: 'term' },
      { line: 5, text: '2024-1\tZZ-BAD!\tBad Code\t3\t8.0', reason: 'courseCode' },
      { line: 6, text: '2024-1\tZZ103\t   \t3\t8.0', reason: 'courseName' },
      { line: 7, text: '2024-1\tZZ104\tBad Credits\t35\t8.0', reason: 'credits' },
      { line: 8, text: '2024-1\tZZ105\tMissing Result\t3\t', reason: 'result' },
      { line: 9, text: '2024-1\tZZ106\tGrade Over Ten\t3\t10.5', reason: 'grade' },
      { line: 10, text: '2024\t1\tZZ107\tContradictory Pass With Grade\t3\tPASS\t9.0', reason: 'grade' },
    ]);
  });
});
