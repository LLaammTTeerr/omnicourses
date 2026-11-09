import { request } from '../api.js';
import type { Term } from '../terms.js';

export { TERM_NUMBERS, type Term } from '../terms.js';

// The transcript DTOs of the API (ADR 0007, ADR 0009), written by hand; api.spec.ts checks them against
// src/backend/openapi.json.

export const TRANSCRIPT_RESULTS = ['graded', 'in_progress', 'exempt', 'pass', 'fail'] as const;
export type TranscriptResult = (typeof TRANSCRIPT_RESULTS)[number];

export interface TranscriptRow {
  courseCode: string;
  courseName: string;
  credits: number;
  result: TranscriptResult;
  /** 10-point scale, one decimal, when graded; null otherwise. The API may leave it out of a request. */
  grade?: number | null;
  term: Term;
}

export interface Transcript {
  rows: TranscriptRow[];
}

/** The saved transcript, oldest term first; no rows if none is saved. */
export const fetchTranscript = (token: string) => request<Transcript>('GET', '/users/me/transcript', { token });

/** The reviewed rows replace the whole saved transcript (UC-02 step 7, A5). 400: a row is invalid, nothing is saved. */
export const saveTranscript = (token: string, rows: TranscriptRow[]) => request<Transcript>('PUT', '/users/me/transcript', { token, body: { rows } });
