import { computed, nextTick, ref, shallowRef, type Ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { useAuth } from '../auth/store.js';
import { useMessages } from '../locale.js';
import { useToast } from '../shell/toast.js';
import { readFailure, type Failure } from './errors.js';
import { ADMIN_MESSAGES } from './messages.js';
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
  return settleLost(landed);
}

/** What became of a write that got no answer, read from the saved data. It sends no write. */
export async function settleLost(landed: () => Promise<boolean>): Promise<Exclude<WriteOutcome<never>, { outcome: 'saved' }>> {
  try {
    return { outcome: (await landed()) ? 'confirmed' : 'not_applied' };
  } catch (e) {
    const failure = readFailure(e);
    if (failure.kind === 'signed_out') return { outcome: 'refused', failure };
    console.error('Reloading the saved data after a write got no answer failed:', e);
    return { outcome: 'unknown' };
  }
}

/**
 * The writes of one administration screen: `busy` while one is out, and `problem` when the last one is not known
 * to be saved. A 403 asks for the caller's grants again, so the navigation follows a revoked permission, and leaves
 * the refusal with the store: the page keeps the screen as it was until the user has read it.
 */
export function useWrites() {
  const auth = useAuth();
  const access = useAdminAccess();
  const busy = ref(false);
  const problem = shallowRef<Problem | null>(null);
  /** How the last write is found again in the saved data, for `recheck`. */
  let lastLanded: (() => Promise<boolean>) | null = null;

  /** Keeps what the screen has to say about `result`. A session that ended needs no words: App.vue takes the user to sign in. */
  function keep(result: WriteOutcome<unknown>): void {
    const settled = result.outcome === 'saved' || result.outcome === 'confirmed' || (result.outcome === 'refused' && result.failure.kind === 'signed_out');
    problem.value = settled ? null : (result as Problem);
  }

  async function send<T>(write: () => Promise<T>, landed: () => Promise<boolean>): Promise<WriteOutcome<T>> {
    // While the outcome of the last write is not known, nothing more is sent: the saved data is read first
    // (`recheck`), or the screen drops the problem and says that it may be out of date.
    if (problem.value?.outcome === 'unknown') return { outcome: 'unknown' };
    // No session: nothing can be sent, so nothing is unknown. App.vue takes the user to sign in.
    if (!auth.token) {
      problem.value = null;
      return { outcome: 'refused', failure: { kind: 'signed_out' } };
    }
    busy.value = true;
    problem.value = null;
    lastLanded = landed;
    try {
      const result = await settleWrite(write, landed);
      if (result.outcome === 'refused' && result.failure.kind === 'permission') {
        access.refusal = { permission: result.failure.permission };
        void access.load({ fresh: true });
      }
      keep(result);
      return result;
    } finally {
      busy.value = false;
    }
  }

  /**
   * After an unknown outcome: reads the saved data again and settles the same write from it, as `send` would have:
   * confirmed, not applied, or still unknown. It sends no write. Resolves to null when there is nothing unknown.
   */
  async function recheck(): Promise<Exclude<WriteOutcome<never>, { outcome: 'saved' }> | null> {
    if (busy.value || problem.value?.outcome !== 'unknown' || !lastLanded) return null;
    busy.value = true;
    try {
      const result = await settleLost(lastLanded);
      keep(result);
      return result;
    } finally {
      busy.value = false;
    }
  }

  function clear(): void {
    problem.value = null;
  }

  return { busy, problem, send, recheck, clear };
}

export function stayWhileBusy(busy: () => boolean): void {
  const auth = useAuth();
  onBeforeRouteLeave(() => !busy() || !auth.signedIn);
}

interface AdminDialogOptions {
  fallback: string;
  notice: Ref<string | null>;
  stale?: { reloadId: string; is: () => boolean; mark: () => void };
  onClose?: () => void;
}

interface FinishOptions {
  before?: (result: WriteOutcome<unknown>) => Promise<void> | void;
  fallback?: string;
}

export function useAdminDialog<D>(options: AdminDialogOptions) {
  const toast = useToast();
  const m = useMessages(ADMIN_MESSAGES);
  const writes = useWrites();
  const dialog = shallowRef<D | null>(null);
  const settling = ref(false);
  const busy = computed(() => writes.busy.value || settling.value);
  let opener: HTMLElement | null = null;
  stayWhileBusy(() => busy.value);

  function rememberOpener(from: Event): void {
    opener = from.currentTarget instanceof HTMLElement ? from.currentTarget : null;
  }

  function open(next: D, from?: Event): void {
    if (from) rememberOpener(from);
    writes.clear();
    dialog.value = next;
  }

  function focusBack(fallback: string): void {
    const usable = opener?.isConnected && !(opener as HTMLButtonElement).disabled;
    const id = options.stale?.is() ? options.stale.reloadId : fallback;
    (usable ? opener : document.getElementById(id))?.focus();
    opener = null;
  }

  async function close(fallback = options.fallback): Promise<void> {
    if (writes.problem.value?.outcome === 'unknown') options.stale?.mark();
    dialog.value = null;
    options.onClose?.();
    writes.clear();
    await nextTick();
    focusBack(fallback);
  }

  function cancel(): void {
    if (!busy.value) void close();
  }

  async function finish(result: WriteOutcome<unknown>, saved: string, { before, fallback }: FinishOptions = {}): Promise<boolean> {
    if (result.outcome !== 'saved' && result.outcome !== 'confirmed') return false;
    settling.value = true;
    try {
      await before?.(result);
      await close(fallback);
      if (result.outcome === 'saved') toast.show(saved);
      else options.notice.value = m.value.problem.confirmed;
      return true;
    } finally {
      settling.value = false;
    }
  }

  return { dialog, writes, busy, rememberOpener, open, close, cancel, finish };
}
