import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, ref } from 'vue';
import { useAsyncLoad } from './async-load.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}

describe('useAsyncLoad with a key', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps the answer for the current key when an older one arrives late', async () => {
    const key = ref('a');
    const pending = { a: deferred<string>(), b: deferred<string>() };
    let state!: ReturnType<typeof useAsyncLoad<string>>;
    mount(defineComponent({ setup: () => ((state = useAsyncLoad('the item', () => pending[key.value as 'a' | 'b'].promise, key)), () => null) }));

    key.value = 'b';
    await flushPromises();
    pending.b.resolve('answer for b');
    await flushPromises();
    pending.a.resolve('answer for a');
    await flushPromises();

    expect(state.status.value).toBe('loaded');
    expect(state.data.value).toBe('answer for b');
  });

  it('ignores a late failure for an older key', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const key = ref('a');
    const pending = { a: deferred<string>(), b: deferred<string>() };
    let state!: ReturnType<typeof useAsyncLoad<string>>;
    mount(defineComponent({ setup: () => ((state = useAsyncLoad('the item', () => pending[key.value as 'a' | 'b'].promise, key)), () => null) }));

    key.value = 'b';
    await flushPromises();
    pending.b.resolve('answer for b');
    pending.a.reject(new Error('late'));
    await flushPromises();

    expect(state.status.value).toBe('loaded');
    expect(consoleError).not.toHaveBeenCalled();
  });
});
