import { defineStore } from 'pinia';
import { computed, ref, shallowRef, watch } from 'vue';
import { statusOf } from '../api.js';
import { useAuth } from '../auth/store.js';
import { fetchOwnGrants, GLOBAL_PERMISSIONS, type PermissionKind, type UserGrants } from './api.js';

// The signed-in user's own administration grants (ADR 0011), from GET /admin/grants. They only decide what the
// screens offer: the navigation entry and the sections of the administration page. The API checks the current
// grants on every request, so a stale answer here can hide or show a link, never allow a write. The grants belong
// to one account: they are forgotten at sign-out, so nothing of one sign-in shows in the next, even of the same
// account.

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
  /** Counts the sign-ins and sign-outs: an answer asked for in one is not kept in the next. */
  let signIn = 0;
  /**
   * A write the API refused for lack of a permission (403 permission_required), until the user has read it. The
   * grants are asked again at once, so the navigation follows; the administration page keeps the screen the write
   * came from as it was, with what was typed, until this is cleared.
   */
  const refusal = shallowRef<{ permission: PermissionKind | null } | null>(null);

  watch(
    () => auth.user?.id,
    () => {
      signIn++;
      pending = null;
      cache.value = null;
      failedFor.value = null;
      refusal.value = null;
    },
    // At once, not on the next tick: a load asked for right after a sign-in must not be counted to the one before.
    { flush: 'sync' },
  );

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
      const during = signIn;
      const current = () => during === signIn && auth.user?.id === userId;
      const run: Promise<UserGrants | null> = auth.authed(fetchOwnGrants).then(
        (loaded) => {
          if (current()) {
            cache.value = { userId, grants: loaded };
            failedFor.value = null;
          }
          return loaded;
        },
        (e: unknown) => {
          // A 401 has signed the user out (App.vue takes them to sign in); anything else is worth a line.
          if (statusOf(e) !== 401) console.error('Loading the administration grants failed:', e);
          if (current()) failedFor.value = userId;
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

  return { cache, grants, failed, held, any, holds, load, refusal };
});
