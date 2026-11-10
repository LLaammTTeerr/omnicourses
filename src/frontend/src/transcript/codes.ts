import { shallowRef, type ShallowRef } from 'vue';
import { statusOf } from '../api.js';
import { useAuth } from '../auth/store.js';
import { fetchTranscript } from './api.js';

/**
 * The course codes of the student's saved transcript, for a neutral "in your transcript" mark (the explorer, the
 * planner). Whether a course counts as passed is the rule engine's call (AGENTS.md hard rule 1). No transcript, or
 * none loaded, gives no codes; a 401 has already signed the student out (App.vue).
 */
export function useTranscriptCodes(where: string): ShallowRef<ReadonlySet<string>> {
  const auth = useAuth();
  const codes = shallowRef<ReadonlySet<string>>(new Set());
  auth
    .authed(fetchTranscript)
    .then(({ rows }) => (codes.value = new Set(rows.map((row) => row.courseCode))))
    .catch((e) => statusOf(e) === 401 || console.error(`Loading the transcript for ${where} failed:`, e));
  return codes;
}
