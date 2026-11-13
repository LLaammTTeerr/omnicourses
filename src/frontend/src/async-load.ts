import { ref, shallowRef, watch, type WatchSource } from 'vue';
import { reportFailure } from './api.js';

/**
 * Loads data for a view: loading, then loaded or failed, with a reload for the retry button. A failure is reported
 * the one way (`reportFailure`). With a `key`, it loads again whenever the key changes, and an answer for an older key is dropped.
 */
export function useAsyncLoad<T>(what: string, load: () => Promise<T>, key: WatchSource = () => null) {
  const status = ref<'loading' | 'loaded' | 'failed'>('loading');
  const data = shallowRef<T | null>(null);
  const error = shallowRef<unknown>(null);
  let latest = 0;

  async function reload(): Promise<void> {
    const call = ++latest;
    status.value = 'loading';
    data.value = null;
    error.value = null;
    try {
      const loaded = await load();
      if (call !== latest) return;
      data.value = loaded;
      status.value = 'loaded';
    } catch (e) {
      if (call !== latest) return;
      reportFailure(`Loading ${what}`, e);
      error.value = e;
      status.value = 'failed';
    }
  }

  watch(key, reload, { immediate: true });
  return { status, data, error, reload };
}
