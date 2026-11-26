import { type Options, parse } from 'csv-parse/sync';
import { importRejected, type ImportRowErrorDto, payloadTooLarge } from './admin-errors.js';
import type { CourseField } from './curriculum-admin.dto.js';

export const MIB = 1024 * 1024;
export const inMiB = (bytes: number): string => `${bytes / MIB} MiB`;

export const CSV_MAX_BYTES = MIB;
export const CSV_MAX_RECORDS = 1000;

export const CATALOG_COLUMNS = {
  code: 'code',
  nameVi: 'name_vi',
  nameEn: 'name_en',
  credits: 'credits',
  theoryPeriods: 'theory_periods',
  labPeriods: 'lab_periods',
  exercisePeriods: 'exercise_periods',
  projectPeriods: 'project_periods',
} as const satisfies Record<'code' | CourseField, string>;
export type CatalogColumn = (typeof CATALOG_COLUMNS)[keyof typeof CATALOG_COLUMNS];
export const CATALOG_COURSES_HEADER: readonly CatalogColumn[] = Object.values(CATALOG_COLUMNS);
export const GROUP_LINKS_HEADER = ['requirement_group_name', 'course_code'] as const;

export type GroupLinkColumn = (typeof GROUP_LINKS_HEADER)[number];

export interface CsvRow<C extends string> {
  record: number;
  values: Record<C, string>;
}

export interface CsvFile<C extends string> {
  rows: CsvRow<C>[];
  errors: ImportRowErrorDto[];
}

const PARSER_OPTIONS: Options = {
  bom: true,
  delimiter: ',',
  quote: '"',
  escape: '"',
  record_delimiter: ['\r\n', '\n'],
  relax_quotes: false,
  relax_column_count: true,
  skip_empty_lines: true,
  trim: false,
  cast: false,
  columns: false,
  info: true,
};

const PARSE_ERRORS: Record<string, string> = {
  CSV_INVALID_CLOSING_QUOTE: 'text follows a closing quote; a quoted field ends at the comma or at the end of the line',
  INVALID_OPENING_QUOTE: 'a quote appears inside an unquoted field; quote the whole field and double each quote inside it',
  CSV_QUOTE_NOT_CLOSED: 'a quoted field of this record is never closed; the file ends inside it',
};

const LONE_SURROGATE = /[\uD800-\uDFFF]/u;

export function readCsv<C extends string>(csv: string, header: readonly C[]): CsvFile<C> {
  if (Buffer.byteLength(csv, 'utf8') > CSV_MAX_BYTES) throw payloadTooLarge(`The CSV is larger than ${inMiB(CSV_MAX_BYTES)} of UTF-8 text`);
  if (LONE_SURROGATE.test(csv) || csv.includes('\u0000')) throw importRejected('The CSV is not UTF-8 text', []);

  const records = parseRecords(csv).map(({ record }, index) => ({ record: index + 1, cells: record.map((cell) => cell.trim()), raw: record }));
  const data = records.slice(1).filter((r) => r.cells.some((cell) => cell !== ''));
  if (data.length > CSV_MAX_RECORDS) throw payloadTooLarge(`The CSV has more than ${CSV_MAX_RECORDS} data records`);

  const first = records[0];
  if (!first || first.raw.length !== header.length || first.raw.some((cell, i) => cell !== header[i])) {
    const message = `the header must be exactly: ${header.join(',')}`;
    throw importRejected('The CSV does not have the header of this template', [{ record: 1, field: null, message }]);
  }
  return rowsOf(data, header);
}

function parseRecords(csv: string): { record: string[] }[] {
  try {
    return parse(csv, PARSER_OPTIONS) as unknown as { record: string[] }[];
  } catch (error) {
    const { code, records } = error as { code?: string; records?: number };
    const at: ImportRowErrorDto = { record: (records ?? 0) + 1, field: null, message: PARSE_ERRORS[code ?? ''] ?? 'the CSV is malformed here' };
    throw importRejected('The CSV is malformed; nothing was read from it', [at]);
  }
}

function rowsOf<C extends string>(data: { record: number; cells: string[] }[], header: readonly C[]): CsvFile<C> {
  const file: CsvFile<C> = { rows: [], errors: [] };
  for (const { record, cells } of data) {
    if (cells.length !== header.length) {
      file.errors.push({ record, field: null, message: `has ${cells.length} fields; the template has ${header.length}` });
    } else {
      file.rows.push({ record, values: Object.fromEntries(header.map((column, i) => [column, cells[i]])) as Record<C, string> });
    }
  }
  return file;
}
