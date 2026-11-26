import { defineStore } from 'pinia';
import { computed, ref, shallowRef, watch } from 'vue';
import { statusOf } from '../api.js';
import { newestOnly } from '../async-load.js';
import { useAccountCache, useAuth } from '../auth/store.js';
import { fetchAdminPrograms, fetchOwnGrants, GLOBAL_PERMISSIONS, type AdminProgram, type PermissionKind, type UserGrants } from './api.js';
import { readFailure } from './errors.js';

// The signed-in user's own administration grants (ADR 0011), from GET /admin/grants. They only decide what the
// screens offer: the navigation entry and the sections of the administration page. The API checks the current
// grants on every request, so a stale answer here can hide or show a link, never allow a write. The grants belong
// to one account: they are forgotten at sign-out, so nothing of one sign-in shows in the next, even of the same
// account.

/** After this many failed loads in a row, only the administration page's own Try again asks once more. */
export const MAX_FAILED_LOADS = 3;

export const useAdminAccess = defineStore('admin-access', () => {
  const auth = useAuth();
  /** The last grants loaded, with the account they belong to. Tests seed it. */
  const cache = useAccountCache(fetchOwnGrants);
  /** The account whose last load failed. */
  const failedFor = ref<string | null>(null);
  /** Loads that failed in a row for this account: the shell stops asking on its own after MAX_FAILED_LOADS. */
  const failures = ref(0);
  let settling: { run: Promise<UserGrants>; settled: Promise<UserGrants | null> } | null = null;
  /**
   * A write the API refused for lack of a permission (403 permission_required), until the user has read it. The
   * grants are asked again at once, so the navigation follows; the administration page keeps the screen the write
   * came from as it was, with what was typed, until this is cleared.
   */
  const refusal = shallowRef<{ permission: PermissionKind | null } | null>(null);

  watch(
    () => auth.user?.id,
    () => {
      cache.forget();
      failures.value = 0;
      failedFor.value = null;
      refusal.value = null;
    },
    // At once, not on the next tick: a load asked for right after a sign-in must not be counted to the one before.
    { flush: 'sync' },
  );

  const grants = cache.value;
  /** The last load for this account failed: the grants shown, if any, may be out of date. */
  const failed = computed(() => failedFor.value !== null && failedFor.value === auth.user?.id);
  /** The kinds of permission the user holds, in the order the screens list them. */
  const held = computed<PermissionKind[]>(() => {
    const own = grants.value;
    if (!own) return [];
    return [...(own.programs.length > 0 ? (['program_admin'] as const) : []), ...GLOBAL_PERMISSIONS.filter((permission) => own.permissions.some((grant) => grant.permission === permission))];
  });
  /** At least one grant: the navigation shows the administration entry. */
  const any = computed(() => held.value.length > 0);
  const holds = (permission: PermissionKind): boolean => held.value.includes(permission);
  /** The last load failed, and not so often in a row that asking again on the next page would only add noise. */
  const retryable = computed(() => failed.value && failures.value < MAX_FAILED_LOADS);

  /**
   * The grants, from the API the first time for each account, or again with `fresh`. Never rejects: a failed load
   * sets `failed`, keeps what was loaded before, and resolves to null. A load without `fresh` joins one that is
   * out; a fresh one always asks, since the grants may have changed after the other request left.
   */
  function load({ fresh = false }: { fresh?: boolean } = {}): Promise<UserGrants | null> {
    const userId = auth.user?.id;
    if (!userId) return Promise.resolve(null);
    const run = cache.load({ fresh });
    if (settling?.run === run) return settling.settled;
    const current = () => cache.isLatest(run) && auth.user?.id === userId;
    const settled = run.then(
      (loaded) => {
        if (current()) {
          failedFor.value = null;
          failures.value = 0;
        }
        return loaded;
      },
      (e: unknown) => {
        // A 401 has signed the user out (App.vue takes them to sign in); anything else is worth a line.
        if (statusOf(e) !== 401) console.error('Loading the administration grants failed:', e);
        if (current()) {
          failedFor.value = userId;
          failures.value++;
        }
        return null;
      },
    );
    settling = { run, settled };
    return settled;
  }

  return { seed: cache.seed, grants, failed, retryable, held, any, holds, load, refusal };
});

interface ProgramPick {
  programId: string | null;
  curriculumId: string | null;
}

export function useProgramPicker(what: string, initial: ProgramPick | null = null) {
  const programList = shallowRef<AdminProgram[] | null>(null);
  const programsStatus = ref<'idle' | 'loading' | 'loaded' | 'failed'>('idle');
  const newest = newestOnly();

  /** `quiet`: the list is replaced when the answer is in, and the page stays as it is meanwhile. */
  async function loadPrograms(quiet = false): Promise<void> {
    const isNewest = newest.start();
    if (!quiet) {
      programList.value = null;
      programsStatus.value = 'loading';
    }
    try {
      const { programs } = await fetchAdminPrograms();
      if (!isNewest()) return;
      programList.value = programs;
      programsStatus.value = 'loaded';
    } catch (e) {
      if (!isNewest() || readFailure(e).kind === 'signed_out') return;
      console.error(`Loading ${what} failed:`, e);
      if (!quiet) programsStatus.value = 'failed';
    }
  }

  const picked = ref<ProgramPick | null>(initial);
  const program = computed(() => {
    const list = programList.value ?? [];
    return list.find((item) => item.id === picked.value?.programId) ?? list[0] ?? null;
  });
  const cohort = computed(() => program.value?.curricula.find((item) => item.id === picked.value?.curriculumId) ?? program.value?.curricula[0] ?? null);
  return { programList, programsStatus, loadPrograms, picked, program, cohort };
}
