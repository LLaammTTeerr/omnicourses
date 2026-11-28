import { defineStore } from 'pinia';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { newestOnly, reportFailure } from '../async-load.js';
import { useAuth } from '../auth/store.js';
import { fetchUnreadCount } from './api.js';

export const UNREAD_POLL_MS = 60_000;

export const useUnread = defineStore('notifications-unread', () => {
  const auth = useAuth();
  const count = ref(0);
  const newest = newestOnly();

  watch(
    () => auth.user?.id,
    () => {
      newest.drop();
      count.value = 0;
    },
    { flush: 'sync' },
  );

  async function refresh(): Promise<void> {
    if (!auth.signedIn) return;
    const isNewest = newest.start();
    try {
      const { unread } = await fetchUnreadCount();
      if (isNewest()) count.value = unread;
    } catch (e) {
      reportFailure('Loading the unread notification count', e);
    }
  }

  function set(unread: number): void {
    newest.drop();
    count.value = unread;
  }

  return { count, refresh, set };
});

export function useUnreadPolling(): void {
  const auth = useAuth();
  const unread = useUnread();
  const route = useRoute();
  watch(
    () => route.fullPath,
    () => {
      if (auth.signedIn) void unread.refresh();
    },
    { immediate: true },
  );
  let poll: ReturnType<typeof setInterval> | undefined;
  onMounted(
    () =>
      (poll = setInterval(() => {
        if (!document.hidden) void unread.refresh();
      }, UNREAD_POLL_MS)),
  );
  onBeforeUnmount(() => clearInterval(poll));
}
