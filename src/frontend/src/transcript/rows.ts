import { codePoints } from '../api.js';
import { COURSE_CODE_PATTERN } from '../course-code.js';
import { currentTerm, vietnamDate } from '../terms.js';
import { TERM_NUMBERS, TRANSCRIPT_RESULTS, type Term, type TranscriptResult, type TranscriptRow } from './api.js';

export const MAX_ROWS = 300;
export const MAX_CREDITS = 30;
export const MAX_NAME_LENGTH = 255;
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;

export interface DraftRow {
  key: number;
  year: number;
  number: Term['number'];
  courseCode: string;
  courseName: string;
  credits: string;
  result: TranscriptResult | '';
  grade: string;
}

export type Problem = 'term' | 'courseCode' | 'courseName' | 'credits' | 'result' | 'grade';

export const normalizeCode = (code: string): string => code.trim().toUpperCase();

export function parseCredits(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,2}$/.test(trimmed)) return null;
  const credits = Number(trimmed);
  return credits <= MAX_CREDITS ? credits : null;
}

export function parseGrade(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{1,2}(?:[.,]\d)?$/.test(trimmed)) return null;
  const grade = Number(trimmed.replace(',', '.'));
  return grade <= 10 ? grade : null;
}

export function problems(row: DraftRow): Problem[] {
  const found: Problem[] = [];
  if (!Number.isInteger(row.year) || row.year < MIN_YEAR || row.year > MAX_YEAR || !TERM_NUMBERS.includes(row.number)) found.push('term');
  if (!COURSE_CODE_PATTERN.test(normalizeCode(row.courseCode))) found.push('courseCode');
  const name = row.courseName.trim();
  if (name.length === 0 || codePoints(name) > MAX_NAME_LENGTH) found.push('courseName');
  if (parseCredits(row.credits) === null) found.push('credits');
  if (!(TRANSCRIPT_RESULTS as readonly string[]).includes(row.result)) found.push('result');
  else if (row.result === 'graded' && parseGrade(row.grade) === null) found.push('grade');
  return found;
}

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

export function blankRow(key: number, rows: readonly DraftRow[], today = new Date()): DraftRow {
  const last = rows.at(-1);
  const year = last?.year ?? currentTerm(vietnamDate(today)).year;
  return { key, year, number: last?.number ?? 1, courseCode: '', courseName: '', credits: '', result: '', grade: '' };
}

export function yearChoices(rows: readonly DraftRow[], today = new Date()): number[] {
  const now = Number(vietnamDate(today).slice(0, 4));
  const years = new Set<number>();
  for (let year = now - 10; year <= now + 1; year++) years.add(year);
  for (const row of rows) if (Number.isInteger(row.year)) years.add(row.year);
  return [...years].filter((year) => year >= MIN_YEAR && year <= MAX_YEAR).sort((a, b) => a - b);
}
