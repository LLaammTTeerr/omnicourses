import { afterEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { HttpError } from '../api.js';
import { useSavedDocument } from './saved-document.js';

interface Scope {
  id: string;
  label: string;
}

interface Pending {
  of: Scope;
  resolve: (value: string) => void;
  reject: (error: unknown) => void;
}

const FIRST: Scope = { id: 'first', label: 'First' };
const SECOND: Scope = { id: 'second', label: 'Second' };
const SIGNED_OUT = new HttpError('/doc', 401);
const NOT_FOUND = new HttpError('/doc', 404, 'GET', [], 'not_found');
const SERVER_DOWN = new HttpError('/doc', 503);

function setup(start: Scope | null = FIRST, failedAs?: (failure: { kind: string }) => 'missing' | null) {
  const scope = ref<Scope | null>(start);
  const pending: Pending[] = [];
  const read = (of: Scope) => new Promise<string>((resolve, reject) => pending.push({ of, resolve, reject }));
  const saved = useSavedDocument({ scope, scopeKey: (of: Scope) => of.id, read, what: 'the document', reloadId: 'doc-reload', failedAs });
  const settle = async (index: number, value: string) => {
    pending[index]!.resolve(value);
    await Promise.resolve();
    await Promise.resolve();
  };
  const fail = async (index: number, error: unknown) => {
    pending[index]!.reject(error);
    await Promise.resolve();
    await Promise.resolve();
  };
  return { scope, pending, saved, settle, fail };
}

afterEach(() => vi.restoreAllMocks());

describe('useSavedDocument', () => {
  it('loads the document of the scope on screen', async () => {
    const { saved, pending, settle } = setup();
    const loading = saved.load();
    expect(saved.status.value).toBe('loading');
    expect(pending[0]!.of).toEqual(FIRST);
    await settle(0, 'first v1');
    await loading;
    expect(saved.document.value).toBe('first v1');
    expect(saved.status.value).toBe('loaded');
  });

  it('keeps the newest read when an older one answers last', async () => {
    const { saved, settle } = setup();
    void saved.load();
    void saved.readSaved(FIRST);
    await settle(1, 'newer');
    await settle(0, 'older');
    expect(saved.document.value).toBe('newer');
  });

  it('returns a read of another scope without showing it or closing the window of the read on screen', async () => {
    const { saved, settle } = setup();
    void saved.load();
    const other = saved.readSaved(SECOND);
    await settle(1, 'second v1');
    expect(await other).toBe('second v1');
    expect(saved.document.value).toBeNull();
    await settle(0, 'first v1');
    expect(saved.document.value).toBe('first v1');
  });

  it('drops a read whose scope left the screen while it ran', async () => {
    const { saved, scope, settle } = setup();
    void saved.load();
    scope.value = SECOND;
    await settle(0, 'first v1');
    expect(saved.document.value).toBeNull();
    expect(saved.status.value).toBe('loading');
  });

  it('matches scopes by key, so a read lands after the scope object is rebuilt', async () => {
    const { saved, scope, settle } = setup();
    void saved.load();
    scope.value = { ...FIRST, label: 'Renamed' };
    await settle(0, 'first v1');
    expect(saved.document.value).toBe('first v1');
    expect(saved.onScreen(FIRST)).toBe(true);
    expect(saved.onScreen(SECOND)).toBe(false);
  });

  it('reports a failed load, and ignores it once a newer read started', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const first = setup();
    void first.saved.load();
    await first.fail(0, SERVER_DOWN);
    expect(first.saved.status.value).toBe('failed');
    expect(console.error).toHaveBeenCalledWith('Loading the document to administer failed:', SERVER_DOWN);

    const raced = setup();
    void raced.saved.load();
    void raced.saved.readSaved(FIRST);
    await raced.fail(0, SERVER_DOWN);
    expect(raced.saved.status.value).toBe('loading');
    await raced.settle(1, 'first v2');
    expect(raced.saved.status.value).toBe('loaded');
  });

  it('lets the screen name a status of its own for a failure, without logging it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { saved, fail } = setup(FIRST, (failure) => (failure.kind === 'not_found' ? 'missing' : null));
    void saved.load();
    await fail(0, NOT_FOUND);
    expect(saved.status.value).toBe('missing');
    expect(console.error).not.toHaveBeenCalled();
  });

  it('changes nothing when the reader is signed out', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { saved, settle, fail } = setup();
    void saved.load();
    await settle(0, 'first v1');
    void saved.load();
    await fail(1, SIGNED_OUT);
    expect(saved.status.value).toBe('loading');
    void saved.showSaved();
    await fail(2, SIGNED_OUT);
    expect(saved.stale.value).toBe(false);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('marks the document stale when a reload fails, and clears it on the next good read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { saved, settle, fail } = setup();
    void saved.load();
    await settle(0, 'first v1');
    void saved.showSaved();
    await fail(1, SERVER_DOWN);
    expect(saved.stale.value).toBe(true);
    expect(saved.staleness.is()).toBe(true);
    expect(saved.document.value).toBe('first v1');
    void saved.showSaved();
    await settle(2, 'first v2');
    expect(saved.stale.value).toBe(false);
    expect(saved.document.value).toBe('first v2');
  });

  it('gives the dialog a stale guard that marks the document stale until a load', async () => {
    const { saved } = setup();
    expect(saved.staleness.reloadId).toBe('doc-reload');
    saved.staleness.mark();
    expect(saved.stale.value).toBe(true);
    void saved.load();
    expect(saved.stale.value).toBe(false);
  });

  it('clears the document and reads nothing when no scope is on screen', async () => {
    const { saved, pending } = setup(null);
    await saved.load();
    await saved.showSaved();
    expect(pending).toHaveLength(0);
    expect(saved.document.value).toBeNull();
    expect(saved.status.value).toBe('loading');
  });
});
