import { IMPORT_HEADERS, IMPORT_MAX_BYTES, IMPORT_MAX_RECORDS, type ImportFileType } from './api.js';

type ReadFile = { ok: true; text: string } | { ok: false; reason: 'not_utf8' | 'unreadable' };

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

type OverLimit = { limit: 'bytes'; bytes: number } | { limit: 'records'; records: number };

export function overLimit(text: string): OverLimit | null {
  const bytes = utf8Bytes(text);
  if (bytes > IMPORT_MAX_BYTES) return { limit: 'bytes', bytes };
  const records = countDataRecords(text);
  return records > IMPORT_MAX_RECORDS ? { limit: 'records', records } : null;
}

export const headerLine = (type: ImportFileType): string => IMPORT_HEADERS[type].join(',');

export const templateHref = (type: ImportFileType): string => `data:text/csv;charset=utf-8,${encodeURIComponent(`${headerLine(type)}\r\n`)}`;

export const templateName = (type: ImportFileType): string => `omnicourse-${type.replace('_', '-')}-template.csv`;
