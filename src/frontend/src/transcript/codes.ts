import { shallowRef, type ShallowRef } from 'vue';
import { statusOf } from '../api.js';
import { fetchTranscript } from './api.js';

export function useTranscriptCodes(where: string): ShallowRef<ReadonlySet<string>> {
  const codes = shallowRef<ReadonlySet<string>>(new Set());
  fetchTranscript()
    .then(({ rows }) => (codes.value = new Set(rows.map((row) => row.courseCode))))
    .catch((e) => statusOf(e) === 401 || console.error(`Loading the transcript for ${where} failed:`, e));
  return codes;
}
