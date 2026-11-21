import { shallowRef, type Ref } from 'vue';
import { reportFailure } from '../api.js';
import { useAuth } from '../auth/store.js';
import { sameTerm, termKey, type Term } from '../terms.js';
import { previewPlanDrops } from './api.js';
import {
  attachIssues,
  boardBody,
  boardWith,
  dropVerdict,
  findTile,
  placementOf,
  PREVIEW_KEY,
  removeTile,
  type AttachedIssues,
  type Board,
  type DropVerdict,
  type Moving,
} from './board.js';

/** The engine's answer about a drop on one row. */
export interface RowPreview {
  status: 'loading' | 'done' | 'failed';
  attached: AttachedIssues | null;
  verdict: DropVerdict | null;
}

/**
 * The drag preview: while a course is dragged or lifted, the engine's report on the board with the drop made, one per
 * row, so each row can say before the drop whether it would break a rule and what its load would be. Saves nothing.
 */
export function useDropPreview(board: Ref<Board>, issues: Ref<AttachedIssues | null>, planId: () => string) {
  const auth = useAuth();
  /** What is being dragged with the pointer, or lifted with the keyboard. */
  const moving = shallowRef<Moving | null>(null);
  const previews = shallowRef<Map<string, RowPreview>>(new Map());
  let previewAbort: AbortController | null = null;
  let previewOf: Moving | null = null;

  /** The row a placed tile sits in now; a course of the tray has none. */
  const homeOf = (what: Moving) => ('key' in what ? findTile(board.value, what.key)?.row.term : undefined);
  /** Whether `term` is the row `what` already sits in: a drop there changes nothing. */
  const isHome = (what: Moving, term: Term) => sameTerm(homeOf(what) ?? null, term);

  /**
   * Asks the engine about the drop of `what` on each of `terms` it has no answer for yet, in one request
   * (POST /plans/{id}/issues/drops): a drag costs one request against the rate limit, not one per row.
   */
  function previewRows(what: Moving, terms: readonly Term[]): void {
    if (previewOf !== what) {
      previewAbort?.abort();
      previewAbort = new AbortController();
      previewOf = what;
      previews.value = new Map();
    }
    const snapshot = board.value;
    const todo = terms.filter((term) => {
      const had = previews.value.get(termKey(term));
      return !(had && had.status !== 'failed') && !isHome(what, term) && boardWith(snapshot, what, term) !== snapshot;
    });
    const placement = placementOf(snapshot, what);
    if (!todo.length || !placement) return;
    const setAll = (value: (term: Term) => RowPreview) => {
      if (previewOf !== what) return;
      const next = new Map(previews.value);
      for (const term of todo) next.set(termKey(term), value(term));
      previews.value = next;
    };
    setAll(() => ({ status: 'loading', attached: null, verdict: null }));
    const tileKey = 'key' in what ? what.key : PREVIEW_KEY;
    const without = 'key' in what ? removeTile(snapshot, what.key) : snapshot;
    const before = issues.value;
    const { signal } = previewAbort!;
    const id = planId();
    auth
      .authed((token) => previewPlanDrops(token, id, { terms: boardBody(without), placement, targets: todo }, signal))
      .then(({ reports }) => {
        const byTerm = new Map(reports.map((r) => [termKey(r.term), r.issues]));
        setAll((term) => {
          const report = byTerm.get(termKey(term));
          if (!report) return { status: 'failed', attached: null, verdict: null };
          const attached = attachIssues(boardWith(snapshot, what, term), report);
          return { status: 'done', attached, verdict: dropVerdict(attached, tileKey, term, before) };
        });
      })
      .catch((e) => {
        if (signal.aborted) return;
        reportFailure('Previewing a drop', e);
        setAll(() => ({ status: 'failed', attached: null, verdict: null }));
      });
  }

  const previewRow = (what: Moving, term: Term) => previewRows(what, [term]);
  const previewAll = (what: Moving) => previewRows(what, board.value.map((row) => row.term));

  function stopPreview(): void {
    previewAbort?.abort();
    previewAbort = null;
    previewOf = null;
    previews.value = new Map();
  }

  return { moving, previews, homeOf, isHome, previewRow, previewAll, stopPreview };
}
