import { computed, ref, shallowRef, type Ref } from 'vue';
import { reportFailure } from '../api.js';
import { useAuth } from '../auth/store.js';
import { fetchPlanIssues, type PlanIssue } from './api.js';
import { attachIssues, sameTiles, type AttachedIssues, type Board } from './board.js';
import type { IssueContext } from './messages.js';

/**
 * The rule engine's report on the saved plan (GET /plans/{id}/issues), pinned to the board it was computed for, so
 * its issues follow their tiles and are dimmed while the board on screen holds other tiles. A report answered for
 * an earlier check, or for another plan, is dropped.
 */
export function usePlanIssues(board: Ref<Board>, planId: () => string) {
  const auth = useAuth();
  const issues = shallowRef<AttachedIssues | null>(null);
  const status = ref<'loading' | 'failed' | 'idle'>('loading');
  let checkCall = 0;

  async function check(snapshotBoard: Board): Promise<void> {
    const call = ++checkCall;
    const id = planId();
    status.value = 'loading';
    try {
      const report = await auth.authed((token) => fetchPlanIssues(token, id));
      if (call !== checkCall) return;
      issues.value = attachIssues(snapshotBoard, report);
      status.value = 'idle';
    } catch (e) {
      if (call !== checkCall) return;
      reportFailure('Checking the plan', e);
      status.value = 'failed';
    }
  }

  /**
   * Drops the check in flight. A save calls it before each PUT: a check asked for before may be answered after the
   * PUT commits, about that board and not its snapshot. The save checks again when it ends.
   */
  function dropPending(): void {
    ++checkCall;
    if (status.value === 'loading') status.value = 'idle';
  }

  /** Forgets the report, for another plan. */
  function reset(): void {
    ++checkCall;
    issues.value = null;
  }

  /** The report describes the board on screen. Empty rows do not count: they are not saved, so not checked either. */
  const fresh = computed(() => issues.value !== null && sameTiles(issues.value.board, board.value));

  /** The names an issue's wording needs, from the report's own coverage. */
  const ctx = computed<IssueContext>(() => ({
    requirementName: (issue: PlanIssue) => {
      const coverage = issues.value?.report.coverage;
      if (issue.requirementGroupId) return coverage?.groups.find((g) => g.id === issue.requirementGroupId)?.name ?? null;
      if (issue.combinedMinimumId) return coverage?.combinedMinimums.find((c) => c.id === issue.combinedMinimumId)?.name ?? null;
      return null;
    },
  }));

  return { issues, status, check, dropPending, reset, fresh, ctx };
}
