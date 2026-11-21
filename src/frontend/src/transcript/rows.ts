import { academicYearAt, TERM_NUMBERS, type Term } from '../terms.js';
import { TRANSCRIPT_RESULTS, type TranscriptResult, type TranscriptRow } from './api.js';

// A row of the review table (UC-02 step 5) as the student edits it, and the checks TranscriptRowDto makes, so the
// table can block the save before the API refuses it (UC-02 A2). These are bounds on input, not academic rules:
// what a result is worth is the rule engine's call (ADR 0007, AGENTS.md hard rule 1).

// TranscriptDto and TermDto; api.spec.ts checks each against the contract.
export const MAX_ROWS = 300;
export const MAX_CREDITS = 30;
export const MAX_NAME_LENGTH = 255;
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;
// src/backend/src/common/course-code.ts.
export const COURSE_CODE_PATTERN = /^[A-Z0-9]{2,20}$/;

export interface DraftRow {
  /** Stable across edits, for the table's keys and labels. */
  key: number;
  year: number;
  number: Term['number'];
  courseCode: string;
  courseName: string;
  /** As typed. */
  credits: string;
  /** Empty until the student picks one. */
  result: TranscriptResult | '';
  /** As typed, with a dot or a comma. Ignored unless the result is `graded`. */
  grade: string;
}

export type Problem = 'term' | 'courseCode' | 'courseName' | 'credits' | 'result' | 'grade';

/** How the API stores a code: trimmed and upper-cased. */
export const normalizeCode = (code: string): string => code.trim().toUpperCase();

/** The credits as a whole number from 0 to 30, or null. */
export function parseCredits(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,2}$/.test(trimmed)) return null;
  const credits = Number(trimmed);
  return credits <= MAX_CREDITS ? credits : null;
}

/** A grade from 0 to 10 with at most one decimal, written 8.5 or 8,5; otherwise null. */
export function parseGrade(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,2}(?:[.,]\d)?$/.test(trimmed)) return null;
  const grade = Number(trimmed.replace(',', '.'));
  return grade <= 10 ? grade : null;
}

/** What keeps the row from being saved, in table order. Empty: the row can be saved. */
export function problems(row: DraftRow): Problem[] {
  const found: Problem[] = [];
  if (!Number.isInteger(row.year) || row.year < MIN_YEAR || row.year > MAX_YEAR || !TERM_NUMBERS.includes(row.number)) found.push('term');
  if (!COURSE_CODE_PATTERN.test(normalizeCode(row.courseCode))) found.push('courseCode');
  const name = row.courseName.trim();
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) found.push('courseName');
  if (parseCredits(row.credits) === null) found.push('credits');
  if (!(TRANSCRIPT_RESULTS as readonly string[]).includes(row.result)) found.push('result');
  else if (row.result === 'graded' && parseGrade(row.grade) === null) found.push('grade');
  return found;
}

/** The row as the API takes it. Call only on a row with no problems. */
export function toRow(row: DraftRow): TranscriptRow {
  const result = row.result as TranscriptResult;
  return {
    courseCode: normalizeCode(row.courseCode),
    courseName: row.courseName.trim(),
    credits: parseCredits(row.credits)!,
    result,
    grade: result === 'graded' ? parseGrade(row.grade) : null,
    term: { year: row.year, number: row.number },
  };
}

export function fromRow(row: TranscriptRow, key: number): DraftRow {
  return {
    key,
    year: row.term.year,
    number: row.term.number,
    courseCode: row.courseCode,
    courseName: row.courseName,
    credits: String(row.credits),
    result: row.result,
    grade: row.grade === null || row.grade === undefined ? '' : row.grade.toFixed(1),
  };
}

/** A new row in the term of the last row, or else the academic year `today` falls in, on the date in Vietnam. */
export function blankRow(key: number, rows: readonly DraftRow[], today = new Date()): DraftRow {
  const last = rows.at(-1);
  const year = last?.year ?? academicYearAt(today);
  return { key, year, number: last?.number ?? 1, courseCode: '', courseName: '', credits: '', result: '', grade: '' };
}

/** The academic years the term picker offers: ten years back to next year, plus any year a row already has. */
export function yearChoices(rows: readonly DraftRow[], today = new Date()): number[] {
  const now = today.getFullYear();
  const years = new Set<number>();
  for (let year = now - 10; year <= now + 1; year++) years.add(year);
  for (const row of rows) if (Number.isInteger(row.year)) years.add(row.year);
  return [...years].filter((year) => year >= MIN_YEAR && year <= MAX_YEAR).sort((a, b) => a - b);
}
