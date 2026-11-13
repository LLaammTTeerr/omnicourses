// Which attempt of a course counts (QĐ 1175/QĐ-KHTN Điều 14) and what passes (Điều 11.4, 13).
// Pure functions over the transcript's entries (ADR 0007): every attempt is its own entry.
import { byText } from '../common/by-text.js';
import { compareTerms, sameTerm, type Term } from '../terms/term.js';
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

/** How an attempt ranks, worst first: failed without a grade, failed with one, passed with one, passed without one. */
const SEVERITY_TIERS = ['failed_ungraded', 'failed_graded', 'passed_graded', 'passed_ungraded'] as const;

function tierOf(entry: TranscriptEntry): number {
  const graded = entry.result === 'graded' && entry.grade !== null;
  const tier = attemptPasses(entry) ? (graded ? 'passed_graded' : 'passed_ungraded') : graded ? 'failed_graded' : 'failed_ungraded';
  return SEVERITY_TIERS.indexOf(tier);
}

/** Negative when a is worse than b: the lower tier, then, within a graded tier, the lower grade. */
function compareSeverity(a: TranscriptEntry, b: TranscriptEntry): number {
  return tierOf(a) - tierOf(b) || (a.grade !== null && b.grade !== null ? toTenths(a.grade) - toTenths(b.grade) : 0);
}

/**
 * The order of a course's attempts: oldest term first. Within a term the transcript cannot say
 * which came first, so a fixed order on what each attempt says (name, credits, result, grade)
 * stands in for it, and a record never depends on the order its rows were read in (ADR 0013).
 */
export function compareAttempts(a: TranscriptEntry, b: TranscriptEntry): number {
  return compareTerms(a.term, b.term) || byText(a.courseName, b.courseName) || a.credits - b.credits || byText(a.result, b.result) || (a.grade ?? -1) - (b.grade ?? -1);
}

/** One course of the transcript, with every attempt and the one that counts. */
export interface CourseRecord {
  code: string;
  /** The name on the latest attempt. */
  name: string;
  /** In `compareAttempts` order: oldest term first. */
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

/** Groups the transcript by course code and resolves each course's official attempt. */
export function courseRecords(entries: readonly TranscriptEntry[]): Map<string, CourseRecord> {
  const byCode = new Map<string, TranscriptEntry[]>();
  for (const entry of entries) byCode.set(entry.courseCode, [...(byCode.get(entry.courseCode) ?? []), entry]);
  const records = new Map<string, CourseRecord>();
  for (const [code, list] of [...byCode].sort(([a], [b]) => byText(a, b))) records.set(code, resolve(code, [...list].sort(compareAttempts)));
  return records;
}

/** Resolves one course from its attempts, in `compareAttempts` order. Used for "as of term T" too. */
export function resolve(code: string, attempts: TranscriptEntry[]): CourseRecord {
  const completed = attempts.filter(isCompleted);
  const lastCompleted = completed.at(-1) ?? null;
  let official: TranscriptEntry | null = null;
  let sameTermAttempts = false;
  if (lastCompleted) {
    const inLastTerm = completed.filter((a) => sameTerm(a.term, lastCompleted.term));
    sameTermAttempts = inLastTerm.length > 1;
    official = inLastTerm.reduce((worst, a) => (compareSeverity(a, worst) < 0 ? a : worst));
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

function recordOf(record: CourseRecord, keep: (attempt: TranscriptEntry) => boolean): CourseRecord | null {
  const attempts = record.attempts.filter(keep);
  return attempts.length ? resolve(record.code, attempts) : null;
}

/** The course as it stood at the end of `term`: only the attempts up to that term. Null if none. */
export function recordAsOf(record: CourseRecord, term: Term): CourseRecord | null {
  return recordOf(record, (a) => compareTerms(a.term, term) <= 0);
}

/** The course as it stood before `term` began: only the attempts of earlier terms. Null if none. */
export function recordBefore(record: CourseRecord, term: Term): CourseRecord | null {
  return recordOf(record, (a) => compareTerms(a.term, term) < 0);
}
