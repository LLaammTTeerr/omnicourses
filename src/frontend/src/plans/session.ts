import { computed, ref, shallowRef } from 'vue';
import { HttpError, statusOf } from '../api.js';
import { useAsyncLoad } from '../async-load.js';
import { useMessages } from '../locale.js';
import { useOnboarding } from '../onboarding/store.js';
import { currentTermNow, termKey, type Term } from '../terms.js';
import { fetchPlan, fetchPlanIssues, previewPlanDrops, savePlacements, type Plan } from './api.js';
import {
  attachIssues,
  boardBody,
  boardOf,
  boardWith,
  dropVerdict,
  isHome,
  placementOf,
  PREVIEW_KEY,
  removeTile,
  rowsFor,
  sameTiles,
  type AttachedIssues,
  type Board,
  type DropVerdict,
  type Moving,
} from './board.js';
import { rememberLastPlan } from './last-plan.js';
import { PLANNER_MESSAGES } from './messages.js';

export const SAVE_RETRY_MS = [2000, 5000, 10000];

export interface SessionHooks {
  reset(): void;
  opened(plan: Plan, board: Board): void;
  revert(toSaved: () => void): void;
}

interface Opened {
  id: string;
  saving: boolean;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function usePlanSession(id: () => string, hooks: SessionHooks) {
  const onboarding = useOnboarding();
  const m = useMessages(PLANNER_MESSAGES);

  const plan = shallowRef<Plan | null>(null);
  const board = shallowRef<Board>([]);
  const saved = shallowRef<Board>([]);
  let opened: Opened = { id: id(), saving: false };
  let nextKey = 0;
  const newKey = () => nextKey++;

  const issues = shallowRef<AttachedIssues | null>(null);
  const issuesStatus = ref<'loading' | 'failed' | 'idle'>('loading');
  let checkCall = 0;

  function dropCheckInFlight(): void {
    ++checkCall;
    if (issuesStatus.value === 'loading') issuesStatus.value = 'idle';
  }

  async function check(snapshot: Board): Promise<void> {
    const call = ++checkCall;
    issuesStatus.value = 'loading';
    try {
      const report = await fetchPlanIssues(opened.id);
      if (call !== checkCall) return;
      issues.value = attachIssues(snapshot, report);
      issuesStatus.value = 'idle';
    } catch (e) {
      if (call !== checkCall) return;
      if (statusOf(e) !== 401) console.error('Checking the plan failed:', e);
      issuesStatus.value = 'failed';
    }
  }

  function retryCheck(): void {
    if (!opened.saving) void check(saved.value);
  }

  const fresh = computed(() => issues.value !== null && sameTiles(issues.value.board, board.value));

  const saveState = ref<'saved' | 'saving' | 'failed'>('saved');
  const saveError = ref<string | null>(null);

  async function sendUntilSaved(mine: Opened): Promise<boolean> {
    let waits = 0;
    for (;;) {
      const sending = board.value;
      if (sameTiles(sending, saved.value)) {
        saved.value = sending;
        return true;
      }
      dropCheckInFlight();
      let updated: Plan;
      try {
        updated = await savePlacements(mine.id, boardBody(sending));
      } catch (e) {
        if (statusOf(e) !== 429 || waits >= SAVE_RETRY_MS.length) throw e;
        await wait(SAVE_RETRY_MS[waits++]!);
        if (mine !== opened) return false;
        continue;
      }
      waits = 0;
      if (mine !== opened) return false;
      plan.value = updated;
      saved.value = sending;
    }
  }

  function failSave(e: unknown): void {
    hooks.revert(() => (board.value = saved.value));
    const code = statusOf(e);
    saveState.value = code === 401 ? 'saved' : 'failed';
    if (code === 401) return;
    console.error('Saving the plan failed:', e);
    const details = e instanceof HttpError ? e.details.join('; ') : '';
    saveError.value = code === 400 && details ? m.value.saveRefused(details) : m.value.saveFailed;
    void check(saved.value);
  }

  async function save(): Promise<void> {
    const mine = opened;
    if (mine.saving) return;
    mine.saving = true;
    saveState.value = 'saving';
    try {
      if (!(await sendUntilSaved(mine))) return;
      saveState.value = 'saved';
      void check(saved.value);
    } catch (e) {
      if (mine === opened) failSave(e);
    } finally {
      mine.saving = false;
    }
  }

  async function graduationTarget(): Promise<Term | null> {
    return onboarding.load().then(
      (answers) => answers.targetGraduationTerm,
      () => null,
    );
  }

  const loaded = useAsyncLoad(
    'the plan',
    async () => {
      const mine: Opened = (opened = { id: id(), saving: false });
      dropCheckInFlight();
      issues.value = null;
      saveState.value = 'saved';
      saveError.value = null;
      hooks.reset();
      const found = await fetchPlan(mine.id);
      const target = await graduationTarget();
      if (mine !== opened) return found;
      const start = boardOf(found.terms, rowsFor(found.terms, currentTermNow(), target), newKey);
      plan.value = found;
      rememberLastPlan(found.id);
      board.value = start;
      saved.value = start;
      hooks.opened(found, start);
      void check(start);
      return found;
    },
    id,
  );

  return {
    plan,
    board,
    saved,
    newKey,
    openedId: () => opened.id,
    issues,
    issuesStatus,
    fresh,
    retryCheck,
    saveState,
    saveError,
    save,
    loaded,
  };
}

export type PlanSession = ReturnType<typeof usePlanSession>;

export interface RowPreview {
  status: 'loading' | 'done' | 'failed';
  attached: AttachedIssues | null;
  verdict: DropVerdict | null;
}

const LOADING: RowPreview = { status: 'loading', attached: null, verdict: null };
const FAILED: RowPreview = { status: 'failed', attached: null, verdict: null };

export function useDropPreview(session: Pick<PlanSession, 'board' | 'issues' | 'openedId'>) {
  const { board, issues } = session;
  const moving = shallowRef<Moving | null>(null);
  const previews = shallowRef<Map<string, RowPreview>>(new Map());
  let previewAbort: AbortController | null = null;
  let previewOf: Moving | null = null;

  function startFor(what: Moving): void {
    if (previewOf === what) return;
    previewAbort?.abort();
    previewAbort = new AbortController();
    previewOf = what;
    previews.value = new Map();
  }

  function needsAsking(snapshot: Board, what: Moving, term: Term): boolean {
    const had = previews.value.get(termKey(term));
    if (had && had.status !== 'failed') return false;
    return !isHome(snapshot, what, termKey(term)) && boardWith(snapshot, what, term) !== snapshot;
  }

  function previewRows(what: Moving, terms: readonly Term[]): void {
    startFor(what);
    const snapshot = board.value;
    const todo = terms.filter((term) => needsAsking(snapshot, what, term));
    const placement = placementOf(snapshot, what);
    if (!todo.length || !placement) return;
    const setAll = (value: (term: Term) => RowPreview) => {
      if (previewOf !== what) return;
      const next = new Map(previews.value);
      for (const term of todo) next.set(termKey(term), value(term));
      previews.value = next;
    };
    setAll(() => LOADING);
    const tileKey = 'key' in what ? what.key : PREVIEW_KEY;
    const without = 'key' in what ? removeTile(snapshot, what.key) : snapshot;
    const before = issues.value;
    const { signal } = previewAbort!;
    previewPlanDrops(session.openedId(), { terms: boardBody(without), placement, targets: todo }, signal)
      .then(({ reports }) => {
        const byTerm = new Map(reports.map((r) => [termKey(r.term), r.issues]));
        setAll((term) => {
          const report = byTerm.get(termKey(term));
          if (!report) return FAILED;
          const attached = attachIssues(boardWith(snapshot, what, term), report);
          return { status: 'done', attached, verdict: dropVerdict(attached, tileKey, term, before) };
        });
      })
      .catch((e) => {
        if (signal.aborted) return;
        if (statusOf(e) !== 401) console.error('Previewing a drop failed:', e);
        setAll(() => FAILED);
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

  return { moving, previews, previewRow, previewAll, stopPreview };
}
