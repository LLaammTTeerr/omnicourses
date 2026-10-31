// The read contract of the transcript for other modules (ADR 0007): plain types, so a
// change to the HTTP DTOs of the review table doesn't reach the degree audit or the advisor.
import { Term } from '../terms/term.js';

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
