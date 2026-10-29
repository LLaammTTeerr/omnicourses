// The read contract of the transcript for other modules (ADR 0007): plain types, so a
// change to the HTTP DTOs of the review table doesn't reach the degree audit or the advisor.

/** A term (ADR 0009): `year` 2026 is the academic year 2026–2027; 1 and 2 are main terms, 3 is summer. */
export interface Term {
  year: number;
  number: 1 | 2 | 3;
}

/**
 * What the transcript says about one attempt (ADR 0007). Only `graded` carries a grade.
 * Whether a result passes or counts toward graduation is the rule engine's call.
 */
export const TRANSCRIPT_RESULTS = ['graded', 'in_progress', 'exempt', 'pass', 'fail'] as const;
export type TranscriptResult = (typeof TRANSCRIPT_RESULTS)[number];

/** One course taken in one term, as the student saved it. A retake is another entry. */
export interface TranscriptEntry {
  courseCode: string;
  courseName: string;
  credits: number;
  result: TranscriptResult;
  /** 10-point scale, one decimal, when `result` is `graded`; null otherwise. */
  grade: number | null;
  term: Term;
}
