import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { statusOf } from '../api.js';
import { useAuth } from '../auth/store.js';
import { fetchOwnGrants, GLOBAL_PERMISSIONS, type PermissionKind, type UserGrants } from './api.js';

// The signed-in user's own administration grants (ADR 0011), from GET /admin/grants. They only decide what the
// screens offer: the navigation entry and the sections of the administration page. The API checks the current
// grants on every request, so a stale answer here can hide or show a link, never allow a write. The grants belong
// to one account: after a sign-out or another sign-in in the same tab they are not reused.

interface Owned {
  userId: string;
  grants: UserGrants;
}

export const useAdminAccess = defineStore('admin-access', () => {
  const auth = useAuth();
  /** The last grants loaded, with the account they belong to. Tests seed it. */
  const cache = shallowRef<Owned | null>(null);
  /** The account whose last load failed. */
  const failedFor = ref<string | null>(null);
  let pending: { userId: string; load: Promise<UserGrants | null> } | null = null;

  const grants = computed(() => (cache.value && cache.value.userId === auth.user?.id ? cache.value.grants : null));
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

  /**
   * The grants, from the API the first time for each account, or again with `fresh`. Never rejects: a failed load
   * sets `failed`, keeps what was loaded before, and resolves to null.
   */
  function load({ fresh = false }: { fresh?: boolean } = {}): Promise<UserGrants | null> {
    const userId = auth.user?.id;
    if (!userId) return Promise.resolve(null);
    if (!fresh && grants.value) return Promise.resolve(grants.value);
    if (pending?.userId !== userId) {
      const run: Promise<UserGrants | null> = auth.authed(fetchOwnGrants).then(
        (loaded) => {
          if (auth.user?.id === userId) {
            cache.value = { userId, grants: loaded };
            failedFor.value = null;
          }
          return loaded;
        },
        (e: unknown) => {
          // A 401 has signed the user out (App.vue takes them to sign in); anything else is worth a line.
          if (statusOf(e) !== 401) console.error('Loading the administration grants failed:', e);
          if (auth.user?.id === userId) failedFor.value = userId;
          return null;
        },
      );
      pending = { userId, load: run };
      void run.then(() => {
        if (pending?.load === run) pending = null;
      });
    }
    return pending.load;
  }

  return { cache, grants, failed, held, any, holds, load };
});
