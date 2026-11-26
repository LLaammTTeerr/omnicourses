import { requestAsUser } from '../auth/store.js';
import type { Term } from '../terms.js';

export { TERM_NUMBERS, type Term } from '../terms.js';

export const TRANSCRIPT_RESULTS = ['graded', 'in_progress', 'exempt', 'pass', 'fail'] as const;
export type TranscriptResult = (typeof TRANSCRIPT_RESULTS)[number];

export interface TranscriptRow {
  courseCode: string;
  courseName: string;
  credits: number;
  result: TranscriptResult;
  grade?: number | null;
  term: Term;
}

export interface Transcript {
  rows: TranscriptRow[];
}

export const fetchTranscript = () => requestAsUser<Transcript>('GET', '/users/me/transcript');

export const saveTranscript = (rows: TranscriptRow[]) => requestAsUser<Transcript>('PUT', '/users/me/transcript', { body: { rows } });
