import { request } from '../api.js';
import type { TranscriptDto, TranscriptRowDto } from '../api-schema/types.gen.js';

// The transcript DTOs of the API (ADR 0007, ADR 0009), generated from the contract (ADR 0018).

/** `grade` may be left out of a request. */
export type TranscriptRow = TranscriptRowDto;
export type Transcript = TranscriptDto;
export type TranscriptResult = TranscriptRowDto['result'];

/** In the order the transcript screen lists them; api.spec.ts checks that it has every result of the contract. */
export const TRANSCRIPT_RESULTS = ['graded', 'in_progress', 'exempt', 'pass', 'fail'] as const satisfies readonly TranscriptResult[];

/** The saved transcript, oldest term first; no rows if none is saved. */
export const fetchTranscript = (token: string) => request<Transcript>('GET', '/users/me/transcript', { token });

/** The reviewed rows replace the whole saved transcript (UC-02 step 7, A5). 400: a row is invalid, nothing is saved. */
export const saveTranscript = (token: string, rows: TranscriptRow[]) => request<Transcript>('PUT', '/users/me/transcript', { token, body: { rows } });
