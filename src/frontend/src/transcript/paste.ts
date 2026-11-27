import { codePoints } from '../api.js';
import { COURSE_CODE_PATTERN } from '../course-code.js';
import { TERM_NUMBERS, type Term, type TranscriptResult } from './api.js';
import { MAX_NAME_LENGTH, MAX_YEAR, MIN_YEAR, normalizeCode, parseCredits, parseGrade, type DraftRow, type Problem } from './rows.js';

export type PastedRow = Omit<DraftRow, 'key'>;

export type PasteReason = 'columns' | Problem;

export interface PasteLineError {
  line: number;
  text: string;
  reason: PasteReason;
}

export interface PasteParseResult {
  rows: PastedRow[];
  errors: PasteLineError[];
}

const HEADER_WORD_PATTERN =
  /(?<![\p{L}\p{N}])(?:mã(?:\s*(?:mh|môn|hp|học\s*phần))?|course(?:\s*(?:code|name|title))?|code|tín\s*chỉ|credits?)(?![\p{L}\p{N}])/iu;

const EXEMPT_TOKENS = new Set(['M', 'MIỄN', 'EXEMPT']);
const PASS_TOKENS = new Set(['Đ', 'ĐẠT', 'PASS', 'P']);
const FAIL_TOKENS = new Set(['KĐ', 'KHÔNG ĐẠT', 'RỚT', 'FAIL', 'F']);
const IN_PROGRESS_TOKENS = new Set(['ĐANG HỌC', 'IN_PROGRESS', 'IN PROGRESS', 'IP', '--']);
const GRADED_TOKENS = new Set(['GRADED', 'CÓ ĐIỂM']);
const NUMERIC_LIKE_PATTERN = /^[+-]?\d+(?:[.,]\d+)?$/;

function cleanToken(raw: string): string {
  return raw.normalize('NFC').trim().replace(/\s+/g, ' ').toUpperCase();
}

function validYear(year: number): boolean {
  return Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR;
}

function validTermNumber(n: number): n is Term['number'] {
  return (TERM_NUMBERS as readonly number[]).includes(n);
}

function splitCells(line: string): string[] {
  if (line.includes('\t')) return line.split('\t');
  if (line.includes('|')) {
    const trimmed = line.trim();
    const inner = trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length >= 2 ? trimmed.slice(1, -1) : line;
    return inner.split('|');
  }
  if (line.includes(';')) return line.split(';');
  return [line];
}

export function parseTermCell(raw: string): Term | null {
  const text = raw.normalize('NFC').trim().replace(/[–—]/g, '-').replace(/\s+/g, ' ');
  if (!text) return null;

  let match = /^(\d{4})\s*[-/]\s*([123])$/.exec(text);
  if (match) {
    const year = Number(match[1]);
    const number = Number(match[2]);
    return validYear(year) && validTermNumber(number) ? { year, number } : null;
  }

  match = /^(\d{4})\s*[-/]\s*(\d{4})\s*(?:[-/]\s*(?:HK|HỌC\s*KỲ|TERM)?\s*|\s+(?:HK|HỌC\s*KỲ|TERM)\s*)([123])$/iu.exec(text);
  if (match) {
    const year = Number(match[1]);
    const nextYear = Number(match[2]);
    const number = Number(match[3]);
    return nextYear === year + 1 && validYear(year) && validTermNumber(number) ? { year, number } : null;
  }

  match = /^(?:HK|HỌC\s*KỲ|TERM)\s*([123])\s*[,/-]?\s*\(?(\d{4})(?:\s*[-/]\s*(\d{4}))?\)?$/iu.exec(text);
  if (match) {
    const number = Number(match[1]);
    const year = Number(match[2]);
    const nextYear = match[3] ? Number(match[3]) : year + 1;
    return nextYear === year + 1 && validYear(year) && validTermNumber(number) ? { year, number } : null;
  }

  match = /^(\d{4})\s+(?:HK|HỌC\s*KỲ|TERM)\s*([123])$/iu.exec(text);
  if (match) {
    const year = Number(match[1]);
    const number = Number(match[2]);
    return validYear(year) && validTermNumber(number) ? { year, number } : null;
  }

  return null;
}

function parseYearCell(raw: string): number | null {
  const text = raw.trim().replace(/[–—]/g, '-').replace(/\s+/g, '');
  const single = /^(\d{4})$/.exec(text);
  if (single) {
    const year = Number(single[1]);
    return validYear(year) ? year : null;
  }
  const span = /^(\d{4})[-/](\d{4})$/.exec(text);
  if (span) {
    const year = Number(span[1]);
    const nextYear = Number(span[2]);
    return nextYear === year + 1 && validYear(year) ? year : null;
  }
  return null;
}

function parseTermNumberCell(raw: string): Term['number'] | null {
  const match = /^(?:HK|HỌC\s*KỲ|TERM)?\s*([123])$/iu.exec(raw.normalize('NFC').trim());
  if (!match) return null;
  const number = Number(match[1]);
  return validTermNumber(number) ? number : null;
}

function parseSeparateTerm(yearRaw: string, termRaw: string): Term | null {
  const year = parseYearCell(yearRaw);
  const number = parseTermNumberCell(termRaw);
  return year !== null && number !== null ? { year, number } : null;
}

type Outcome = { ok: true; result: TranscriptResult; grade: string } | { ok: false; reason: 'result' | 'grade' };

function parseSingleResultOrGrade(raw: string): Outcome {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: 'result' };

  const numericGrade = parseGrade(trimmed);
  if (numericGrade !== null) return { ok: true, result: 'graded', grade: numericGrade.toFixed(1) };

  const token = cleanToken(trimmed);
  if (EXEMPT_TOKENS.has(token)) return { ok: true, result: 'exempt', grade: '' };
  if (PASS_TOKENS.has(token)) return { ok: true, result: 'pass', grade: '' };
  if (FAIL_TOKENS.has(token)) return { ok: true, result: 'fail', grade: '' };
  if (IN_PROGRESS_TOKENS.has(token)) return { ok: true, result: 'in_progress', grade: '' };
  if (NUMERIC_LIKE_PATTERN.test(trimmed)) return { ok: false, reason: 'grade' };
  return { ok: false, reason: 'result' };
}

function parseSeparateResultAndGrade(resultRaw: string, gradeRaw: string): Outcome {
  const resultToken = cleanToken(resultRaw);
  const gradeTrimmed = gradeRaw.trim();
  const emptyGrade = gradeTrimmed === '' || gradeTrimmed === '--';

  if (GRADED_TOKENS.has(resultToken) || (resultToken === '' && gradeTrimmed !== '' && gradeTrimmed !== '--')) {
    const numericGrade = parseGrade(gradeTrimmed);
    return numericGrade !== null ? { ok: true, result: 'graded', grade: numericGrade.toFixed(1) } : { ok: false, reason: 'grade' };
  }
  if (EXEMPT_TOKENS.has(resultToken)) return emptyGrade ? { ok: true, result: 'exempt', grade: '' } : { ok: false, reason: 'grade' };
  if (PASS_TOKENS.has(resultToken)) return emptyGrade ? { ok: true, result: 'pass', grade: '' } : { ok: false, reason: 'grade' };
  if (FAIL_TOKENS.has(resultToken)) return emptyGrade ? { ok: true, result: 'fail', grade: '' } : { ok: false, reason: 'grade' };
  if (IN_PROGRESS_TOKENS.has(resultToken)) return emptyGrade ? { ok: true, result: 'in_progress', grade: '' } : { ok: false, reason: 'grade' };
  return { ok: false, reason: 'result' };
}

type LineOutcome = { ok: true; row: PastedRow } | { ok: false; reason: PasteReason };

function buildRow(term: Term | null, codeRaw: string, nameRaw: string, creditsRaw: string, outcome: Outcome): LineOutcome {
  if (!term) return { ok: false, reason: 'term' };
  const courseCode = normalizeCode(codeRaw);
  if (!COURSE_CODE_PATTERN.test(courseCode)) return { ok: false, reason: 'courseCode' };
  const courseName = nameRaw.normalize('NFC').trim();
  if (courseName.length === 0 || codePoints(courseName) > MAX_NAME_LENGTH) return { ok: false, reason: 'courseName' };
  const credits = parseCredits(creditsRaw);
  if (credits === null) return { ok: false, reason: 'credits' };
  if (!outcome.ok) return outcome;
  return {
    ok: true,
    row: {
      year: term.year,
      number: term.number,
      courseCode,
      courseName,
      credits: String(credits),
      result: outcome.result,
      grade: outcome.grade,
    },
  };
}

function parseCells(cells: readonly string[]): LineOutcome {
  if (cells.length === 5) {
    return buildRow(parseTermCell(cells[0]!), cells[1]!, cells[2]!, cells[3]!, parseSingleResultOrGrade(cells[4]!));
  }
  if (cells.length === 6) {
    const combinedTerm = parseTermCell(cells[0]!);
    if (combinedTerm) {
      return buildRow(combinedTerm, cells[1]!, cells[2]!, cells[3]!, parseSeparateResultAndGrade(cells[4]!, cells[5]!));
    }
    return buildRow(parseSeparateTerm(cells[0]!, cells[1]!), cells[2]!, cells[3]!, cells[4]!, parseSingleResultOrGrade(cells[5]!));
  }
  if (cells.length === 7) {
    return buildRow(parseSeparateTerm(cells[0]!, cells[1]!), cells[2]!, cells[3]!, cells[4]!, parseSeparateResultAndGrade(cells[5]!, cells[6]!));
  }
  return { ok: false, reason: 'columns' };
}

function hasValidTermPrefix(cells: readonly string[]): boolean {
  if (cells.length >= 5 && parseTermCell(cells[0]!) !== null) return true;
  if (cells.length >= 6 && parseSeparateTerm(cells[0]!, cells[1]!) !== null) return true;
  return false;
}

function hasDataCell(cells: readonly string[]): boolean {
  if (/^\d/.test(cells[0]?.trim() ?? '')) return true;
  for (const raw of cells) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (parseCredits(trimmed) !== null || parseGrade(trimmed) !== null) return true;
    const code = normalizeCode(trimmed);
    if (COURSE_CODE_PATTERN.test(code) && /[A-Z]/.test(code) && /\d/.test(code)) return true;
  }
  return false;
}

function isHeaderLine(line: string, cells: readonly string[]): boolean {
  if (cells.length < 2) return false;
  if (hasValidTermPrefix(cells) || hasDataCell(cells)) return false;
  return HEADER_WORD_PATTERN.test(line.normalize('NFC'));
}

export function parseTranscriptPaste(raw: string): PasteParseResult {
  const rows: PastedRow[] = [];
  const errors: PasteLineError[] = [];
  const lines = raw.split(/\r?\n/);
  let seenFirstNonEmpty = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim() === '') continue;
    const cells = splitCells(line);
    if (!seenFirstNonEmpty) {
      seenFirstNonEmpty = true;
      if (isHeaderLine(line, cells)) continue;
    }
    const parsed = parseCells(cells);
    if (parsed.ok) rows.push(parsed.row);
    else errors.push({ line: i + 1, text: line, reason: parsed.reason });
  }

  return { rows, errors };
}
