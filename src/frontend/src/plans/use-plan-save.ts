import { ref, shallowRef, type ShallowRef } from 'vue';
import { HttpError, reportFailure, statusOf } from '../api.js';
import { useAuth } from '../auth/store.js';
import { savePlacements, type Plan } from './api.js';
import { boardBody, sameTiles, type Board } from './board.js';
import { isLocked, setLocked } from './lock.js';

/** How long a save waits after each 429 before sending again; after the last one it fails as any error does. */
const SAVE_RETRY_MS = [2000, 5000, 10000];
const HISTORY_MAX = 50;

/**
 * The plan the editor has open. The router reuses the editor when the student goes from one plan straight to
 * another, so each load opens a new one, and a save or check started for an earlier one stops instead of touching
 * the plan now on screen.
 */
export interface Opened {
  id: string;
  saving: boolean;
}

interface SaveOptions {
  plan: ShallowRef<Plan | null>;
  /** The board on screen. */
  board: ShallowRef<Board>;
  /** The board the API last saved. */
  saved: ShallowRef<Board>;
  opened: () => Opened;
  issues: { check(board: Board): Promise<void>; dropPending(): void };
  /** Puts the saved board back on screen after a failed save. */
  revert: () => void;
  words: () => { saveRefused: (details: string) => string; saveFailed: string };
}

/**
 * Saving the board (ADR 0014: each change saves the whole board), the Undo history, and the lock. The save loop is
 * the only place that retries a rate limit (429): it keeps the board and sends the board on screen again.
 */
export function usePlanSave({ plan, board, saved, opened, issues, revert, words }: SaveOptions) {
  const auth = useAuth();
  const saveState = ref<'saved' | 'saving' | 'failed'>('saved');
  const saveError = ref<string | null>(null);

  /**
   * Saves the board on screen until the API holds it, then checks the saved board, also after a failure, which puts
   * back the last saved board (an earlier request of the same loop may have gone through). If the student opens
   * another plan meanwhile, the request in flight still lands in this one and the loop stops there: a change not yet
   * sent is dropped rather than written into the plan now open.
   */
  async function save(): Promise<void> {
    const mine = opened();
    if (mine.saving) return;
    mine.saving = true;
    saveState.value = 'saving';
    let waits = 0;
    try {
      for (;;) {
        const sending = board.value;
        if (sameTiles(sending, saved.value)) {
          saved.value = sending; // Same tiles, maybe more empty rows: keep them if a later save fails.
          break;
        }
        issues.dropPending();
        let updated: Plan;
        try {
          updated = await auth.authed((token) => savePlacements(token, mine.id, boardBody(sending)));
        } catch (e) {
          // 429: too many requests, not a refusal. Keep the board, wait, and send the board on screen again.
          if (statusOf(e) !== 429 || waits >= SAVE_RETRY_MS.length) throw e;
          await new Promise((resolve) => setTimeout(resolve, SAVE_RETRY_MS[waits++]));
          if (mine !== opened()) return;
          continue;
        }
        waits = 0;
        if (mine !== opened()) return;
        plan.value = updated;
        saved.value = sending;
      }
      saveState.value = 'saved';
      void issues.check(saved.value);
    } catch (e) {
      if (mine !== opened()) return;
      revert();
      forgetUnsaved();
      if (!reportFailure('Saving the plan', e)) {
        saveState.value = 'saved';
        return;
      }
      saveState.value = 'failed';
      const details = e instanceof HttpError ? e.details.join('; ') : '';
      saveError.value = statusOf(e) === 400 && details ? words().saveRefused(details) : words().saveFailed;
      void issues.check(saved.value);
    } finally {
      mine.saving = false;
    }
  }

  /** The boards before each change, newest last, with what the change was, for Undo (Ctrl+Z). */
  const history = shallowRef<{ board: Board; said: string }[]>([]);

  function record(before: Board, said: string): void {
    history.value = [...history.value.slice(1 - HISTORY_MAX), { board: before, said }];
  }

  /**
   * After a failed save the board is back at the last saved one: the changes made since are gone, so Undo forgets them
   * too. They are the newest entries, down to the one that holds the saved board.
   */
  function forgetUnsaved(): void {
    const kept = [...history.value];
    while (kept.length) {
      const last = kept.pop()!;
      if (sameTiles(last.board, saved.value)) break;
    }
    history.value = kept;
  }

  /** Takes the newest change off the history, to undo it. */
  function takeLast(): { board: Board; said: string } | undefined {
    const last = history.value.at(-1);
    if (last) history.value = history.value.slice(0, -1);
    return last;
  }

  // The lock: the plan cannot change until it is unlocked, kept per plan on this browser (lock.ts).
  const locked = ref(false);
  function setLock(planId: string, value: boolean): void {
    locked.value = value;
    setLocked(planId, value);
  }

  /** Reads the lock of the plan just opened. */
  function open(planId: string): void {
    locked.value = isLocked(planId);
  }
  /** Starts afresh for another plan: saved, no error, no history. */
  function reset(): void {
    saveState.value = 'saved';
    saveError.value = null;
    history.value = [];
  }

  return { saveState, saveError, save, history, record, takeLast, locked, setLock, open, reset };
}
