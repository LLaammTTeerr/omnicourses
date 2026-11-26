import { ref, shallowRef, watch, type WatchSource } from 'vue';

/**
 * Loads data for a view: loading, then loaded or failed, with a reload for the retry button. A failure's details go
 * to the console. With a `key`, it loads again whenever the key changes, and an answer for an older key is dropped.
 */
export function newestOnly() {
  let latest = 0;
  return {
    start(): () => boolean {
      const call = ++latest;
      return () => call === latest;
    },
    upcoming(): () => boolean {
      const call = latest + 1;
      return () => call === latest;
    },
    drop(): void {
      latest++;
    },
  };
}

export function useAsyncLoad<T>(what: string, load: () => Promise<T>, key: WatchSource = () => null) {
  const status = ref<'loading' | 'loaded' | 'failed'>('loading');
  const data = shallowRef<T | null>(null);
  const error = shallowRef<unknown>(null);
  const newest = newestOnly();

  async function reload(): Promise<void> {
    const isNewest = newest.start();
    status.value = 'loading';
    data.value = null;
    error.value = null;
    try {
      const loaded = await load();
      if (!isNewest()) return;
      data.value = loaded;
      status.value = 'loaded';
    } catch (e) {
      if (!isNewest()) return;
      console.error(`Loading ${what} failed:`, e);
      error.value = e;
      status.value = 'failed';
    }
  }

  watch(key, reload, { immediate: true });
  return { status, data, error, reload };
}
