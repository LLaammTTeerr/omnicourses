import { ref, shallowRef } from 'vue';
import { useAuth } from '../auth/store.js';
import { readFailure, type Failure } from './errors.js';
import { useAdminAccess } from './store.js';

// One administration write and what became of it (UC-11 A7, ADR 0011: "A lost response leaves the client in an
// unknown state: reload the saved resource before retrying or reporting success"). A write is sent once and never
// repeated here: the administrator decides whether to try again, after seeing the saved data.

type Refusal = Exclude<Failure, { kind: 'no_answer' }>;

export type WriteOutcome<T> =
  /** The API answered that it saved. */
  | { outcome: 'saved'; value: T }
  /** The API answered that it refused: nothing was saved. */
  | { outcome: 'refused'; failure: Refusal }
  /** No answer; the saved data, reloaded, has the change. */
  | { outcome: 'confirmed' }
  /** No answer; the saved data, reloaded, does not have the change. */
  | { outcome: 'not_applied' }
  /** No answer, and the saved data could not be reloaded either. */
  | { outcome: 'unknown' };

/** What the screen has to say about a write that is not known to be saved. */
export type Problem = Exclude<WriteOutcome<never>, { outcome: 'saved' | 'confirmed' }>;

/**
 * Sends `write`. When it gets no answer, `landed` reloads the saved data and says whether the change is in it;
 * only then is an outcome reported.
 */
export async function settleWrite<T>(write: () => Promise<T>, landed: () => Promise<boolean>): Promise<WriteOutcome<T>> {
  let lost: unknown;
  try {
    return { outcome: 'saved', value: await write() };
  } catch (e) {
    const failure = readFailure(e);
    if (failure.kind !== 'no_answer') return { outcome: 'refused', failure };
    lost = e;
  }
  console.error('An administration write got no answer:', lost);
  try {
    return { outcome: (await landed()) ? 'confirmed' : 'not_applied' };
  } catch (e) {
    const failure = readFailure(e);
    if (failure.kind === 'signed_out') return { outcome: 'refused', failure };
    console.error('Reloading the saved data after it failed too:', e);
    return { outcome: 'unknown' };
  }
}

/**
 * The writes of one administration screen: `busy` while one is out, and `problem` when the last one is not known
 * to be saved. A 403 asks for the caller's grants again, so a section whose permission was revoked closes.
 */
export function useWrites() {
  const auth = useAuth();
  const access = useAdminAccess();
  const busy = ref(false);
  const problem = shallowRef<Problem | null>(null);

  async function send<T>(write: (token: string) => Promise<T>, landed: () => Promise<boolean>): Promise<WriteOutcome<T>> {
    busy.value = true;
    problem.value = null;
    try {
      const result = await settleWrite(() => auth.authed(write), landed);
      if (result.outcome === 'refused' && result.failure.kind === 'permission') void access.load({ fresh: true });
      // A session that ended needs no words here: App.vue takes the user to sign in.
      if (result.outcome !== 'saved' && result.outcome !== 'confirmed' && !(result.outcome === 'refused' && result.failure.kind === 'signed_out')) problem.value = result;
      return result;
    } finally {
      busy.value = false;
    }
  }

  function clear(): void {
    problem.value = null;
  }

  return { busy, problem, send, clear };
}
