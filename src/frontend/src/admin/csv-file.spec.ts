import { describe, expect, it } from 'vitest';
import { IMPORT_MAX_BYTES } from './api.js';
import { countDataRecords, headerLine, overLimit, readCsvFile, templateHref, templateName, utf8Bytes } from './csv-file.js';

describe('reading an import file in the browser (UC-11 A9)', () => {
  it('decodes UTF-8 and drops a BOM, as the API does', async () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('code,name_vi\nZZ101,Môn thử\n')]);
    expect(await readCsvFile(new Blob([bytes]))).toEqual({ ok: true, text: 'code,name_vi\nZZ101,Môn thử\n' });
  });

  it('refuses bytes that are not UTF-8, instead of turning them into replacement characters', async () => {
    expect(await readCsvFile(new Blob([new Uint8Array([0x4d, 0xf4, 0x6e])]))).toEqual({ ok: false, reason: 'not_utf8' });
  });

  it('counts the data records, not the lines: a quoted field may hold a line break, and an empty record is not one', () => {
    expect(countDataRecords('code,name\n')).toBe(0);
    expect(countDataRecords('code,name\nZZ101,a\nZZ102,b')).toBe(2);
    expect(countDataRecords('code,name\r\nZZ101,"two\r\nlines"\r\n,\r\n\r\nZZ102,"say ""hi"""\r\n')).toBe(2);
    expect(countDataRecords('a,b\n"",""\n" ",x\n')).toBe(1);
  });

  it('measures the size in UTF-8 bytes, as the API does', () => {
    expect(utf8Bytes('Môn')).toBe(4);
  });

  it('stops only a file over a limit of the API: 1 MiB of UTF-8, or 1,000 data records', () => {
    const header = 'requirement_group_name,course_code\n';
    expect(overLimit(header + 'Nhóm thử,ZZ101\n'.repeat(1000))).toBeNull();
    expect(overLimit(header + 'Nhóm thử,ZZ101\n'.repeat(1001))).toEqual({ limit: 'records', records: 1001 });
    expect(overLimit(header + '"Nhóm\nthử",ZZ101\n'.repeat(1000))).toBeNull();
    const big = 'a'.repeat(IMPORT_MAX_BYTES);
    expect(overLimit(big)).toBeNull();
    expect(overLimit(`${big}ô`)).toEqual({ limit: 'bytes', bytes: IMPORT_MAX_BYTES + 2 });
  });

  it('builds a template that holds the exact header and nothing else', async () => {
    expect(headerLine('group_links')).toBe('requirement_group_name,course_code');
    const href = templateHref('catalog_courses');
    expect(href.startsWith('data:text/csv;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(href.slice(href.indexOf(',') + 1))).toBe('code,name_vi,name_en,credits,theory_periods,lab_periods,exercise_periods,project_periods\r\n');
    expect(templateName('group_links')).toBe('omnicourse-group-links-template.csv');
  });
});
