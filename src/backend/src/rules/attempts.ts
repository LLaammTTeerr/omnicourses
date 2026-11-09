// Which attempt of a course counts (QĐ 1175/QĐ-KHTN Điều 14) and what passes (Điều 11.4, 13).
// Pure functions over the transcript's entries (ADR 0007): every attempt is its own entry.
import { compareTerms } from '../terms/current-term.js';
import type { Term } from '../terms/term.js';
import type { TranscriptEntry } from '../transcript/transcript-entry.js';
import { isPassingGrade, toTenths } from './grades.js';

/** An attempt with a result: anything but `in_progress`. */
export function isCompleted(entry: TranscriptEntry): boolean {
  return entry.result !== 'in_progress';
}

/**
 * Whether one attempt passes. Điều 11.4: a grade of 5.0 or more. Điều 13.2: an exempt course
 * (miễn, điểm M or BL) is recognised, so its credits are accumulated. A `pass` result passes;
 * `fail` and `in_progress` do not.
 */
export function attemptPasses(entry: TranscriptEntry): boolean {
  switch (entry.result) {
    case 'exempt':
    case 'pass':
      return true;
    case 'graded':
      return entry.grade !== null && isPassingGrade(entry.grade);
    default:
      return false;
  }
}

/** Lower is worse: a failed attempt, then the lower grade. */
function severity(entry: TranscriptEntry): number {
  if (!attemptPasses(entry)) return entry.result === 'graded' && entry.grade !== null ? toTenths(entry.grade) - 1000 : -2000;
  return entry.result === 'graded' && entry.grade !== null ? toTenths(entry.grade) : 1000;
}

/** One course of the transcript, with every attempt and the one that counts. */
export interface CourseRecord {
  code: string;
  /** The name on the latest attempt. */
  name: string;
  /** Oldest term first; within a term, in transcript order. */
  attempts: TranscriptEntry[];
  /**
   * The official attempt: the last completed one (Điều 14.1.a and 14.2.a: "điểm lần học cuối là
   * điểm chính thức", even when it is lower than an earlier one). Null when none is completed.
   */
  official: TranscriptEntry | null;
  passed: boolean;
  /** An attempt in progress after the official one (or with no completed attempt). */
  inProgress: boolean;
  /**
   * Two or more completed attempts in the official attempt's term. The transcript cannot say which
   * was last, so the worse one counts (ADR 0013).
   */
  sameTermAttempts: boolean;
}

const sameTerm = (a: Term, b: Term) => compareTerms(a, b) === 0;

/** Groups the transcript by course code and resolves each course's official attempt. */
export function courseRecords(entries: readonly TranscriptEntry[]): Map<string, CourseRecord> {
  const byCode = new Map<string, TranscriptEntry[]>();
  for (const entry of entries) byCode.set(entry.courseCode, [...(byCode.get(entry.courseCode) ?? []), entry]);
  const records = new Map<string, CourseRecord>();
  for (const [code, list] of [...byCode].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    // A stable sort keeps transcript order inside a term.
    const attempts = [...list].sort((a, b) => compareTerms(a.term, b.term));
    records.set(code, resolve(code, attempts));
  }
  return records;
}

/** Resolves one course from its attempts, oldest term first. Used for "as of term T" too. */
export function resolve(code: string, attempts: TranscriptEntry[]): CourseRecord {
  const completed = attempts.filter(isCompleted);
  const lastCompleted = completed.at(-1) ?? null;
  let official: TranscriptEntry | null = null;
  let sameTermAttempts = false;
  if (lastCompleted) {
    const inLastTerm = completed.filter((a) => sameTerm(a.term, lastCompleted.term));
    sameTermAttempts = inLastTerm.length > 1;
    official = inLastTerm.reduce((worst, a) => (severity(a) < severity(worst) ? a : worst));
  }
  const inProgress = attempts.some((a) => a.result === 'in_progress' && (official === null || compareTerms(a.term, official.term) > 0));
  return {
    code,
    name: attempts.at(-1)!.courseName,
    attempts,
    official,
    passed: official !== null && attemptPasses(official),
    inProgress,
    sameTermAttempts,
  };
}

/** The course as it stood at the end of `term`: only the attempts up to that term. Null if none. */
export function recordAsOf(record: CourseRecord, term: Term): CourseRecord | null {
  const attempts = record.attempts.filter((a) => compareTerms(a.term, term) <= 0);
  return attempts.length ? resolve(record.code, attempts) : null;
}
