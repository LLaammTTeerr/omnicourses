import { defineStore } from 'pinia';
import { computed, ref, shallowRef, watch } from 'vue';
import { statusOf } from '../api.js';
import { newestOnly } from '../async-load.js';
import { useAccountCache, useAuth } from '../auth/store.js';
import { fetchAdminPrograms, fetchOwnGrants, GLOBAL_PERMISSIONS, type AdminProgram, type PermissionKind, type UserGrants } from './api.js';
import { readFailure } from './errors.js';

export const MAX_FAILED_LOADS = 3;

export const useAdminAccess = defineStore('admin-access', () => {
  const auth = useAuth();
  const cache = useAccountCache(fetchOwnGrants);
  const failedFor = ref<string | null>(null);
  const failures = ref(0);
  let settling: { run: Promise<UserGrants>; settled: Promise<UserGrants | null> } | null = null;
  const refusal = shallowRef<{ permission: PermissionKind | null } | null>(null);

  watch(
    () => auth.user?.id,
    () => {
      cache.forget();
      failures.value = 0;
      failedFor.value = null;
      refusal.value = null;
    },
    { flush: 'sync' },
  );

  const grants = cache.value;
  const failed = computed(() => failedFor.value !== null && failedFor.value === auth.user?.id);
  const held = computed<PermissionKind[]>(() => {
    const own = grants.value;
    if (!own) return [];
    return [...(own.programs.length > 0 ? (['program_admin'] as const) : []), ...GLOBAL_PERMISSIONS.filter((permission) => own.permissions.some((grant) => grant.permission === permission))];
  });
  const any = computed(() => held.value.length > 0);
  const holds = (permission: PermissionKind): boolean => held.value.includes(permission);
  const retryable = computed(() => failed.value && failures.value < MAX_FAILED_LOADS);

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
