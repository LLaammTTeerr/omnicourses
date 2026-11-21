import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveFile } from './download.js';

describe('saveFile', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('clicks a download link to an object URL, then lets the URL go', () => {
    vi.useFakeTimers();
    const created = vi.fn(() => 'blob:zz');
    const revoked = vi.fn();
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked });
    const clicks: { href: string; download: string; inPage: boolean }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push({ href: this.href, download: this.download, inPage: document.body.contains(this) });
    });

    saveFile(new Blob(['{}']), 'omnicourse-account.json');
    expect(clicks).toEqual([{ href: 'blob:zz', download: 'omnicourse-account.json', inPage: true }]);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revoked).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoked).toHaveBeenCalledWith('blob:zz');
  });
});
