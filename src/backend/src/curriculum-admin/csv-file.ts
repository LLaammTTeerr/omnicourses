import { type Options, parse } from 'csv-parse/sync';
import { importRejected, type ImportRowErrorDto, payloadTooLarge } from './admin-errors.js';

// Reads one CSV import file (ADR 0011, "CSV contract and UC-11 handoff") into text cells.
// It decides nothing about a course or a link: no cell is cast, and a value is checked later
// by the validation manual entry uses. These bounds are input limits, not academic rules.

export const CSV_MAX_BYTES = 1024 * 1024;
export const CSV_MAX_RECORDS = 1000;

export const CATALOG_COURSES_HEADER = ['code', 'name_vi', 'name_en', 'credits', 'theory_periods', 'lab_periods', 'exercise_periods', 'project_periods'] as const;
export const GROUP_LINKS_HEADER = ['requirement_group_name', 'course_code'] as const;

export type CatalogColumn = (typeof CATALOG_COURSES_HEADER)[number];
export type GroupLinkColumn = (typeof GROUP_LINKS_HEADER)[number];

/** One data record with the template's field count: its cells, trimmed at the edges. */
export interface CsvRow<C extends string> {
  /** The logical record number; the header is record 1 and a blank line is not a record. */
  record: number;
  /** The physical line the record starts on. */
  line: number;
  values: Record<C, string>;
}

export interface CsvFile<C extends string> {
  rows: CsvRow<C>[];
  /** Records with another field count than the template. They are refused, never padded or skipped. */
  errors: ImportRowErrorDto[];
}

// RFC 4180 quoting, strictly: a quote opens and closes a whole field and is doubled inside it,
// so `relax_quotes` stays off and the parser trims nothing (a space outside the quotes is an
// error, not decoration). `relax_column_count` is on only so that readCsv can report every
// record with a wrong field count as a row error; the parser alone would stop at the first.
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

// The parser's own messages quote the cell that broke it. These do not, so a refused file
// leaves no content in a message that may be logged.
const PARSE_ERRORS: Record<string, string> = {
  CSV_INVALID_CLOSING_QUOTE: 'text follows a closing quote; a quoted field ends at the comma or at the end of the line',
  INVALID_OPENING_QUOTE: 'a quote appears inside an unquoted field; quote the whole field and double each quote inside it',
  CSV_QUOTE_NOT_CLOSED: 'a quoted field of this record is never closed; the file ends inside it',
};

const LONE_SURROGATE = /[\uD800-\uDFFF]/u;

/**
 * The data records of `csv`, which must start with exactly `header`.
 * Throws 413 over a size bound, and 400 for a file no template row can be read from:
 * malformed quoting, another header, or text that is not UTF-8. A quoting error names the
 * record and the line where reading stopped, which for an unclosed quote is the last line.
 */
export function readCsv<C extends string>(csv: string, header: readonly C[]): CsvFile<C> {
  if (Buffer.byteLength(csv, 'utf8') > CSV_MAX_BYTES) throw payloadTooLarge('The CSV is larger than 1 MiB of UTF-8 text');
  if (LONE_SURROGATE.test(csv) || csv.includes('\u0000')) throw importRejected('The CSV is not UTF-8 text', []);

  let parsed: { record: string[]; info: { lines: number } }[];
  try {
    parsed = parse(csv, PARSER_OPTIONS) as unknown as typeof parsed;
  } catch (error) {
    const { code, lines, records } = error as { code?: string; lines?: number; records?: number };
    const at: ImportRowErrorDto = { record: (records ?? 0) + 1, line: lines ?? 1, field: null, message: PARSE_ERRORS[code ?? ''] ?? 'the CSV is malformed here' };
    throw importRejected('The CSV is malformed; nothing was read from it', [at]);
  }

  const records = parsed.map(({ record, info }, index) => {
    // info.lines is the line the record ends on; a quoted field may have started it earlier.
    const breaks = record.reduce((n, cell) => n + (cell.match(/\n/g)?.length ?? 0), 0);
    return { record: index + 1, line: info.lines - breaks, cells: record.map((cell) => cell.trim()), raw: record };
  });
  // A record of empty cells only (",,,") is ignored, like a blank line, but keeps its number.
  const data = records.slice(1).filter((r) => r.cells.some((cell) => cell !== ''));
  if (data.length > CSV_MAX_RECORDS) throw payloadTooLarge(`The CSV has more than ${CSV_MAX_RECORDS} data records`);

  const first = records[0];
  if (!first || first.raw.length !== header.length || first.raw.some((cell, i) => cell !== header[i])) {
    const message = `the header must be exactly: ${header.join(',')}`;
    throw importRejected('The CSV does not have the header of this template', [{ record: 1, line: first?.line ?? 1, field: null, message }]);
  }

  const file: CsvFile<C> = { rows: [], errors: [] };
  for (const { record, line, cells } of data) {
    if (cells.length !== header.length) {
      file.errors.push({ record, line, field: null, message: `has ${cells.length} fields; the template has ${header.length}` });
    } else {
      file.rows.push({ record, line, values: Object.fromEntries(header.map((column, i) => [column, cells[i]])) as Record<C, string> });
    }
  }
  return file;
}
