import { byText, groupBy } from '../common/collections.js';
import { compareTerms, type Term } from '../terms/term.js';
import type { TranscriptEntry } from '../transcript/transcript-entry.js';
import { isPassingGrade, toTenths } from './grades.js';
import type { TranscriptCourseStatus } from './types.js';

export function isCompleted(entry: TranscriptEntry): boolean {
  return entry.result !== 'in_progress';
}

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

const UNGRADED_PASS_SEVERITY = 1000;
const FAILED_GRADE_OFFSET = 1000;
const UNGRADED_FAIL_SEVERITY = -2000;

function severity(entry: TranscriptEntry): number {
  if (!attemptPasses(entry)) return entry.result === 'graded' && entry.grade !== null ? toTenths(entry.grade) - FAILED_GRADE_OFFSET : UNGRADED_FAIL_SEVERITY;
  return entry.result === 'graded' && entry.grade !== null ? toTenths(entry.grade) : UNGRADED_PASS_SEVERITY;
}

export interface CourseRecord {
  code: string;
  name: string;
  attempts: TranscriptEntry[];
  official: TranscriptEntry | null;
  passed: boolean;
  inProgress: boolean;
  sameTermAttempts: boolean;
}

const sameTerm = (a: Term, b: Term) => compareTerms(a, b) === 0;

export function courseRecords(entries: readonly TranscriptEntry[]): Map<string, CourseRecord> {
  const byCode = groupBy(entries, (entry) => entry.courseCode);
  const records = new Map<string, CourseRecord>();
  for (const [code, list] of [...byCode].sort(([a], [b]) => byText(a, b))) {
    const attempts = [...list].sort((a, b) => compareTerms(a.term, b.term));
    records.set(code, resolve(code, attempts));
  }
  return records;
}

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

export function courseStatus(record: CourseRecord): TranscriptCourseStatus {
  if (record.passed) return 'passed';
  if (record.inProgress) return 'in_progress';
  return 'failed';
}

export function recordAsOf(record: CourseRecord, term: Term): CourseRecord | null {
  const attempts = record.attempts.filter((a) => compareTerms(a.term, term) <= 0);
  return attempts.length ? resolve(record.code, attempts) : null;
}
