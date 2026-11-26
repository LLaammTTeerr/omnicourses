import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { statusOf } from '../api.js';
import { newestOnly } from '../async-load.js';
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
      if (statusOf(e) !== 401) console.error('Loading the unread notification count failed:', e);
    }
  }

  function set(unread: number): void {
    newest.drop();
    count.value = unread;
  }

  return { count, refresh, set };
});
