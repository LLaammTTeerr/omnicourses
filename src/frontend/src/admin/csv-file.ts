import { IMPORT_HEADERS, IMPORT_MAX_BYTES, IMPORT_MAX_RECORDS, type ImportFileType } from './api.js';

// A CSV import file in the browser (ADR 0011, "CSV contract and UC-11 handoff"; UC-11 A9). The file is read here and
// sent as JSON text; nothing is uploaded as a file. The browser checks only the API's input limits, so that a file
// far too large is not sent at all: the API checks them again, with every row, and decides. Nothing here reads a
// value of a row.

export type ReadFile = { ok: true; text: string } | { ok: false; reason: 'not_utf8' | 'unreadable' };

/**
 * The file's text, decoded as UTF-8; a BOM at the start is dropped, as the API would. A byte that is not UTF-8 is
 * refused here: a lenient read would turn it into "�", and the API would then save that into a name.
 */
export function readCsvFile(file: Blob): Promise<ReadFile> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve({ ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(reader.result as ArrayBuffer) });
      } catch {
        resolve({ ok: false, reason: 'not_utf8' });
      }
    };
    reader.onerror = () => resolve({ ok: false, reason: 'unreadable' });
    reader.readAsArrayBuffer(file);
  });
}

export const utf8Bytes = (text: string): number => new TextEncoder().encode(text).length;

/**
 * The data records of the text: the records after the header that have a field with something in it. A quoted
 * field may hold a line break, so a line count would be too high; a record of empty fields only is not counted,
 * as the API does not count it. An unclosed quote ends the count: the API reports that file's error.
 */
export function countDataRecords(text: string): number {
  let records = 0;
  let quoted = false;
  let filled = false;
  let first = true;
  const end = () => {
    if (!first && filled) records++;
    first = false;
    filled = false;
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        filled = true;
        i++;
      } else if (char === '"') quoted = false;
      else if (char.trim() !== '') filled = true;
    } else if (char === '"') quoted = true;
    else if (char === '\n' || (char === '\r' && text[i + 1] === '\n')) {
      if (char === '\r') i++;
      end();
    } else if (char !== ',' && char.trim() !== '') filled = true;
  }
  if (!quoted) end();
  return records;
}

/** Over an input limit of the API: the file is not sent. */
export type OverLimit = { limit: 'bytes'; bytes: number } | { limit: 'records'; records: number };

export function overLimit(text: string): OverLimit | null {
  const bytes = utf8Bytes(text);
  if (bytes > IMPORT_MAX_BYTES) return { limit: 'bytes', bytes };
  const records = countDataRecords(text);
  return records > IMPORT_MAX_RECORDS ? { limit: 'records', records } : null;
}

/** The first line of a file of this type, exactly as the API requires it. */
export const headerLine = (type: ImportFileType): string => IMPORT_HEADERS[type].join(',');

/** A template file to download: the header and nothing else, as a data address (no object URL to release). */
export const templateHref = (type: ImportFileType): string => `data:text/csv;charset=utf-8,${encodeURIComponent(`${headerLine(type)}\r\n`)}`;

/** The name a template is saved under. */
export const templateName = (type: ImportFileType): string => `omnicourse-${type.replace('_', '-')}-template.csv`;
