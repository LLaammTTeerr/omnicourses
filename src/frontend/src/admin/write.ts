import { computed, nextTick, ref, shallowRef, type Ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { useAuth } from '../auth/store.js';
import { useMessages } from '../locale.js';
import { useToast } from '../shell/toast.js';
import { readFailure, type Failure } from './errors.js';
import { ADMIN_MESSAGES } from './messages.js';
import { useAdminAccess } from './store.js';

type Refusal = Exclude<Failure, { kind: 'no_answer' }>;

export type WriteOutcome<T> =
  | { outcome: 'saved'; value: T }
  | { outcome: 'refused'; failure: Refusal }
  | { outcome: 'confirmed' }
  | { outcome: 'not_applied' }
  | { outcome: 'unknown' };

export type Problem = Exclude<WriteOutcome<never>, { outcome: 'saved' | 'confirmed' }>;

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

async function settleLost(landed: () => Promise<boolean>): Promise<Exclude<WriteOutcome<never>, { outcome: 'saved' }>> {
  try {
    return { outcome: (await landed()) ? 'confirmed' : 'not_applied' };
  } catch (e) {
    const failure = readFailure(e);
    if (failure.kind === 'signed_out') return { outcome: 'refused', failure };
    console.error('Reloading the saved data after a write got no answer failed:', e);
    return { outcome: 'unknown' };
  }
}

export function useWrites() {
  const auth = useAuth();
  const access = useAdminAccess();
  const busy = ref(false);
  const problem = shallowRef<Problem | null>(null);
  let lastLanded: (() => Promise<boolean>) | null = null;

  function keep(result: WriteOutcome<unknown>): void {
    const settled = result.outcome === 'saved' || result.outcome === 'confirmed' || (result.outcome === 'refused' && result.failure.kind === 'signed_out');
    problem.value = settled ? null : (result as Problem);
  }

  async function send<T>(write: () => Promise<T>, landed: () => Promise<boolean>): Promise<WriteOutcome<T>> {
    if (problem.value?.outcome === 'unknown') return { outcome: 'unknown' };
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
  notice: Ref<boolean>;
  stale?: { reloadId: string; is: () => boolean; mark: () => void };
  onClose?: () => void;
}

interface FinishOptions {
  before?: (result: WriteOutcome<unknown>) => Promise<void> | void;
  fallback?: string;
}

function useFocusReturn(stale: AdminDialogOptions['stale']) {
  let opener: HTMLElement | null = null;

  function rememberOpener(from: Event): void {
    opener = from.currentTarget instanceof HTMLElement ? from.currentTarget : null;
  }

  function focusBack(fallback: string): void {
    const usable = opener?.isConnected && !(opener as HTMLButtonElement).disabled;
    const id = stale?.is() ? stale.reloadId : fallback;
    (usable ? opener : document.getElementById(id))?.focus();
    opener = null;
  }

  return { rememberOpener, focusBack };
}

export function useAdminDialog<D>(options: AdminDialogOptions) {
  const toast = useToast();
  const m = useMessages(ADMIN_MESSAGES);
  const writes = useWrites();
  const dialog = shallowRef<D | null>(null);
  const settling = ref(false);
  const busy = computed(() => writes.busy.value || settling.value);
  const { rememberOpener, focusBack } = useFocusReturn(options.stale);
  stayWhileBusy(() => busy.value);

  function open(next: D, from?: Event): void {
    if (from) rememberOpener(from);
    writes.clear();
    dialog.value = next;
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
      else options.notice.value = true;
      return true;
    } finally {
      settling.value = false;
    }
  }

  return { dialog, writes, busy, rememberOpener, open, close, cancel, finish };
}
