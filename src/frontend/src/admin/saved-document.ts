import { ref, shallowRef, type Ref } from 'vue';
import { newestOnly } from '../async-load.js';
import { readFailure, type Failure } from './errors.js';

type SavedStatus = 'loading' | 'loaded' | 'failed';

interface SavedDocumentOptions<S, T, X extends string> {
  scope: Readonly<Ref<S | null>>;
  scopeKey: (of: S) => string;
  read: (of: S) => Promise<T>;
  what: string;
  reloadId: string;
  failedAs?: (failure: Failure) => X | null;
}

export function useSavedDocument<S, T, X extends string = never>(options: SavedDocumentOptions<S, T, X>) {
  const { scope, scopeKey, read, what, reloadId, failedAs } = options;
  const document = shallowRef<T | null>(null);
  const status = ref('loading') as Ref<SavedStatus | X>;
  const stale = ref(false);
  const newest = newestOnly();
  const staleness = { reloadId, is: () => stale.value, mark: () => (stale.value = true) };

  const onScreen = (of: S): boolean => scope.value !== null && scopeKey(scope.value) === scopeKey(of);

  async function readSaved(of: S): Promise<T> {
    const isNewest = onScreen(of) ? newest.start() : null;
    const fresh = await read(of);
    if (isNewest?.() && onScreen(of)) {
      document.value = fresh;
      status.value = 'loaded';
      stale.value = false;
    }
    return fresh;
  }

  async function load(): Promise<void> {
    document.value = null;
    stale.value = false;
    status.value = 'loading';
    const of = scope.value;
    if (!of) return;
    const isNewest = newest.upcoming();
    try {
      await readSaved(of);
    } catch (e) {
      if (!isNewest()) return;
      const failure = readFailure(e);
      if (failure.kind === 'signed_out') return;
      const own = failedAs?.(failure) ?? null;
      if (own === null) console.error(`Loading ${what} to administer failed:`, e);
      status.value = own ?? 'failed';
    }
  }

  async function showSaved(): Promise<void> {
    const of = scope.value;
    if (!of) return;
    try {
      await readSaved(of);
    } catch (e) {
      if (readFailure(e).kind === 'signed_out') return;
      console.error(`Reloading ${what} failed:`, e);
      stale.value = true;
    }
  }

  return { document, status, stale, staleness, onScreen, readSaved, load, showSaved };
}
