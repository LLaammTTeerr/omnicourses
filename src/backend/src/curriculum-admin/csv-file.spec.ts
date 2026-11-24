import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CATALOG_COURSES_HEADER, CSV_MAX_BYTES, CSV_MAX_RECORDS, GROUP_LINKS_HEADER, readCsv } from './csv-file.js';

const LINKS = 'requirement_group_name,course_code';
const COURSES = CATALOG_COURSES_HEADER.join(',');

/** The HTTP answer a refused file gets. */
function refusal(read: () => unknown): { status: number; code: string; message: string; errors?: { record: number; field: string | null; message: string }[] } {
  try {
    read();
  } catch (error) {
    if (error instanceof HttpException) return { status: error.getStatus(), ...(error.getResponse() as object) } as ReturnType<typeof refusal>;
    throw error;
  }
  throw new Error('the file was accepted');
}

// Synthetic rows only (AGENTS.md hard rule 3).
describe('readCsv', () => {
  it('reads quoted commas, doubled quotes and a quoted field that spans lines, with or without a BOM', () => {
    const csv = `${LINKS}\r\n"Group A, part 1",zz101\n"Group ""B""\nsecond line",ZZ102\r\n`;
    const expected = {
      errors: [],
      rows: [
        { record: 2, values: { requirement_group_name: 'Group A, part 1', course_code: 'zz101' } },
        { record: 3, values: { requirement_group_name: 'Group "B"\nsecond line', course_code: 'ZZ102' } },
      ],
    };
    expect(readCsv(csv, GROUP_LINKS_HEADER)).toEqual(expected);
    expect(readCsv(`\uFEFF${csv}`, GROUP_LINKS_HEADER)).toEqual(expected);
  });

  it('numbers records from the header as record 1, whatever line breaks the quoted fields hold', () => {
    // A blank line is not a record. The quoted names hold an LF, a CRLF, a lone CR and two CRLFs:
    // none of them moves the number of a later record.
    for (const eol of ['\n', '\r\n']) {
      const csv = [LINKS, 'Group A,ZZ101', '', '"Group\nB",ZZ102', '"Group\r\nC",ZZ103', '"Group\rD",ZZ104', '"Gr\r\nou\r\np E",ZZ105', 'Group F,ZZ106'].join(eol);
      expect(readCsv(csv, GROUP_LINKS_HEADER).rows.map((r) => [r.record, r.values.requirement_group_name, r.values.course_code])).toEqual([
        [2, 'Group A', 'ZZ101'],
        [3, 'Group\nB', 'ZZ102'],
        [4, 'Group\r\nC', 'ZZ103'],
        [5, 'Group\rD', 'ZZ104'],
        [6, 'Gr\r\nou\r\np E', 'ZZ105'],
        [7, 'Group F', 'ZZ106'],
      ]);
      // An error after them carries the right record too: a row error, and a quoting error.
      expect(readCsv(`${csv}${eol}Group G`, GROUP_LINKS_HEADER).errors).toEqual([{ record: 8, field: null, message: 'has 1 fields; the template has 2' }]);
      expect(refusal(() => readCsv(`${csv}${eol}Group G,"ZZ"107`, GROUP_LINKS_HEADER)).errors).toEqual([{ record: 8, field: null, message: expect.any(String) }]);
    }
  });

  it('trims the edges of a field and keeps the case and the inside of a name; it casts nothing', () => {
    const { rows } = readCsv(`${COURSES}\n  zz101 ,  Nhập môn  Lập trình ," Intro, to Programming ",4,030, ,,\n`, CATALOG_COURSES_HEADER);
    expect(rows).toEqual([
      {
        record: 2,
        values: { code: 'zz101', name_vi: 'Nhập môn  Lập trình', name_en: 'Intro, to Programming', credits: '4', theory_periods: '030', lab_periods: '', exercise_periods: '', project_periods: '' },
      },
    ]);
  });

  it('ignores blank lines and records whose fields are all empty, and keeps their numbers', () => {
    const { rows, errors } = readCsv(`${LINKS}\n\n,\n   \n"",""\nGroup A,ZZ101\n\n`, GROUP_LINKS_HEADER);
    expect(errors).toEqual([]);
    // Records 2, 3 and 4 are the three empty ones; the blank lines 2 and 7 are not records.
    expect(rows).toEqual([{ record: 5, values: { requirement_group_name: 'Group A', course_code: 'ZZ101' } }]);
  });

  it('accepts only the exact header of the template', () => {
    const wrong = [
      'course_code,requirement_group_name', // another order
      'requirement_group_name', // a missing column
      'requirement_group_name,course_code,curriculum_id', // an extra column
      'requirement_group_name,course_code,program_id',
      'Requirement_Group_Name,course_code', // another case
      ' requirement_group_name,course_code', // a padded name
      'Group B,ZZ102', // no header at all
    ];
    for (const header of wrong) {
      const answer = refusal(() => readCsv(`${header}\nGroup A,ZZ101\n`, GROUP_LINKS_HEADER));
      expect([header, answer.status, answer.code]).toEqual([header, 400, 'validation_failed']);
      expect(answer.errors).toEqual([{ record: 1, field: null, message: `the header must be exactly: ${LINKS}` }]);
    }
    // An empty file has no record at all.
    for (const empty of ['', '\uFEFF', '\n\n']) {
      expect(refusal(() => readCsv(empty, GROUP_LINKS_HEADER)).errors).toEqual([{ record: 1, field: null, message: `the header must be exactly: ${LINKS}` }]);
    }
    // A catalog file is not a links file, and the reverse.
    expect(refusal(() => readCsv(`${COURSES}\n`, GROUP_LINKS_HEADER)).status).toBe(400);
    expect(refusal(() => readCsv(`${LINKS}\n`, CATALOG_COURSES_HEADER)).status).toBe(400);
    expect(readCsv(`"requirement_group_name","course_code"\n`, GROUP_LINKS_HEADER)).toEqual({ rows: [], errors: [] });
  });

  it('refuses malformed quoting with the record, and without repeating the content', () => {
    const cases: [string, number][] = [
      [`${LINKS}\nGroup A,ZZ101\nSECRETNAME,"ZZ"102\n`, 3], // text after a closing quote
      [`${LINKS}\nSECRET"NAME,ZZ101\n`, 2], // a quote inside an unquoted field
      [`${LINKS}\nGroup A, "SECRETNAME"\n`, 2], // a space before the opening quote
      [`${LINKS}\nGroup A,ZZ101\n"SECRETNAME,ZZ102\nGroup C,ZZ103\n`, 3], // never closed: the record that opened the quote
    ];
    for (const [csv, record] of cases) {
      const answer = refusal(() => readCsv(csv, GROUP_LINKS_HEADER));
      expect([answer.status, answer.code]).toEqual([400, 'validation_failed']);
      expect(answer.errors).toEqual([{ record, field: null, message: expect.any(String) }]);
      expect(JSON.stringify(answer)).not.toContain('SECRET');
    }
  });

  it('reports every record with another field count as a row error, and reads the others', () => {
    const { rows, errors } = readCsv(`${LINKS}\nGroup A\nGroup B,ZZ102\nGroup C,ZZ103,2024\n`, GROUP_LINKS_HEADER);
    expect(errors).toEqual([
      { record: 2, field: null, message: 'has 1 fields; the template has 2' },
      { record: 4, field: null, message: 'has 3 fields; the template has 2' },
    ]);
    expect(rows.map((r) => r.record)).toEqual([3]);
  });

  it('accepts LF and CRLF in one file, and not a lone CR', () => {
    expect(readCsv(`${LINKS}\r\nGroup A,ZZ101\nGroup B,ZZ102\r\n`, GROUP_LINKS_HEADER).rows).toHaveLength(2);
    expect(refusal(() => readCsv(`${LINKS}\rGroup A,ZZ101\r`, GROUP_LINKS_HEADER)).status).toBe(400);
  });

  it('refuses text that is not UTF-8', () => {
    for (const bad of ['\uD800', '\u0000']) {
      const answer = refusal(() => readCsv(`${LINKS}\nGroup${bad}A,ZZ101\n`, GROUP_LINKS_HEADER));
      expect([answer.status, answer.code, answer.errors]).toEqual([400, 'validation_failed', []]);
    }
    // A character outside the BMP is a valid pair.
    expect(readCsv(`${LINKS}\nGroup 😀,ZZ101\n`, GROUP_LINKS_HEADER).rows).toHaveLength(1);
  });

  it('takes exactly 1 MiB of UTF-8 and refuses one byte more with 413', () => {
    const head = `${LINKS}\nNhóm A,ZZ101\n`;
    // Bytes, not characters: "ó" is two bytes of UTF-8.
    const padded = (bytes: number) => head + '\n'.repeat(bytes - Buffer.byteLength(head, 'utf8'));
    expect(Buffer.byteLength(padded(CSV_MAX_BYTES), 'utf8')).toBe(1024 * 1024);
    expect(readCsv(padded(CSV_MAX_BYTES), GROUP_LINKS_HEADER).rows).toHaveLength(1);
    const answer = refusal(() => readCsv(padded(CSV_MAX_BYTES + 1), GROUP_LINKS_HEADER));
    expect([answer.status, answer.code]).toEqual([413, 'payload_too_large']);
    // 600,000 two-byte characters are under 1 MiB of characters and over 1 MiB of bytes.
    expect(refusal(() => readCsv(`${LINKS}\n${'ó'.repeat(600_000)},ZZ101\n`, GROUP_LINKS_HEADER)).status).toBe(413);
  });

  it('takes exactly 1,000 data records and refuses 1,001 with 413; empty records do not count', () => {
    const records = (n: number) => `${LINKS}\n${Array.from({ length: n }, (_, i) => `Group A,ZZ${i}`).join('\n,\n')}\n`;
    expect(readCsv(records(CSV_MAX_RECORDS), GROUP_LINKS_HEADER).rows).toHaveLength(1000);
    const answer = refusal(() => readCsv(records(CSV_MAX_RECORDS + 1), GROUP_LINKS_HEADER));
    expect([answer.status, answer.code]).toEqual([413, 'payload_too_large']);
  });
});
