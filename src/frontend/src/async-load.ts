import { ref, shallowRef, watch, type WatchSource } from 'vue';
import { statusOf } from './api.js';

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

const SIGNED_OUT_STATUS = 401;

export function reportFailure(what: string, e: unknown): boolean {
  if (statusOf(e) === SIGNED_OUT_STATUS) return false;
  console.error(`${what} failed:`, e);
  return true;
}

export function useAttempt(failureText: () => string) {
  const busy = ref(false);
  const error = ref<string | null>(null);

  async function run(what: string, action: () => Promise<void>): Promise<boolean> {
    busy.value = true;
    error.value = null;
    try {
      await action();
      return true;
    } catch (e) {
      if (reportFailure(what, e)) error.value = failureText();
      return false;
    } finally {
      busy.value = false;
    }
  }

  return { busy, error, run };
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
