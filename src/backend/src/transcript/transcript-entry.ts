import type { Term } from '../terms/term.js';

export const TRANSCRIPT_RESULTS = ['graded', 'in_progress', 'exempt', 'pass', 'fail'] as const;
export type TranscriptResult = (typeof TRANSCRIPT_RESULTS)[number];

export interface TranscriptEntry {
  courseCode: string;
  courseName: string;
  credits: number;
  result: TranscriptResult;
  grade: number | null;
  term: Term;
}
