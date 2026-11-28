import { defineStore } from 'pinia';
import { computed, ref, shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';
import { reportFailure } from '../async-load.js';
import { useAccountCache, useAuth } from '../auth/store.js';
import { fetchOwnGrants, GLOBAL_PERMISSIONS, type PermissionKind, type UserGrants } from './grants.js';

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
        reportFailure('Loading the administration grants', e);
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

export function useGrantsFollowSession(): void {
  const auth = useAuth();
  const access = useAdminAccess();
  const route = useRoute();
  watch(
    () => auth.user?.id,
    (userId) => {
      if (userId) void access.load();
    },
    { immediate: true },
  );
  watch(
    () => route.fullPath,
    () => {
      if (auth.signedIn && access.retryable) void access.load();
    },
  );
}
