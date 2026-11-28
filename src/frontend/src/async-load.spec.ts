import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, ref } from 'vue';
import { HttpError } from './api.js';
import { reportFailure, useAsyncLoad, useAttempt } from './async-load.js';

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

describe('reportFailure', () => {
  afterEach(() => vi.restoreAllMocks());

  it('stays silent when the student is signed out', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(reportFailure('Loading the thing', new HttpError('/thing', 401))).toBe(false);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('logs any other failure once, under its name', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new HttpError('/thing', 500);
    expect(reportFailure('Loading the thing', failure)).toBe(true);
    expect(consoleError).toHaveBeenCalledExactlyOnceWith('Loading the thing failed:', failure);
  });
});

describe('useAttempt', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is busy while the action runs and leaves no error after a success', async () => {
    const pending = deferred<void>();
    const attempt = useAttempt(() => 'It failed');
    const done = attempt.run('Doing it', () => pending.promise);
    expect(attempt.busy.value).toBe(true);
    pending.resolve();
    expect(await done).toBe(true);
    expect(attempt.busy.value).toBe(false);
    expect(attempt.error.value).toBeNull();
  });

  it('clears an earlier error when it starts', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const attempt = useAttempt(() => 'It failed');
    await attempt.run('Doing it', () => Promise.reject(new HttpError('/it', 500)));
    expect(attempt.error.value).toBe('It failed');
    await attempt.run('Doing it', async () => {});
    expect(attempt.error.value).toBeNull();
  });

  it('logs and words a failure, and is no longer busy', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new HttpError('/it', 500);
    const attempt = useAttempt(() => 'It failed');
    expect(await attempt.run('Doing it', () => Promise.reject(failure))).toBe(false);
    expect(attempt.busy.value).toBe(false);
    expect(attempt.error.value).toBe('It failed');
    expect(consoleError).toHaveBeenCalledExactlyOnceWith('Doing it failed:', failure);
  });

  it('says nothing when the student is signed out', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const attempt = useAttempt(() => 'It failed');
    expect(await attempt.run('Doing it', () => Promise.reject(new HttpError('/it', 401)))).toBe(false);
    expect(attempt.error.value).toBeNull();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
