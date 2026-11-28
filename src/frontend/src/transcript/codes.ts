import { shallowRef, type ShallowRef } from 'vue';
import { reportFailure } from '../async-load.js';
import { fetchTranscript } from './api.js';

export function useTranscriptCodes(where: string): ShallowRef<ReadonlySet<string>> {
  const codes = shallowRef<ReadonlySet<string>>(new Set());
  fetchTranscript()
    .then(({ rows }) => (codes.value = new Set(rows.map((row) => row.courseCode))))
    .catch((e) => reportFailure(`Loading the transcript for ${where}`, e));
  return codes;
}
