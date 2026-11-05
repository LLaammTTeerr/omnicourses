import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { formatDate, useLocale } from './locale.js';

describe('locale store', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = '';
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts in Vietnamese and sets <html lang>', () => {
    expect(useLocale().lang).toBe('vi');
    expect(document.documentElement.lang).toBe('vi');
  });

  it('switches language, updates <html lang> and remembers the choice after a reload', async () => {
    useLocale().set('en');
    await nextTick();
    expect(document.documentElement.lang).toBe('en');
    setActivePinia(createPinia());
    expect(useLocale().lang).toBe('en');
  });

  it('ignores a stored value that is not a language', () => {
    localStorage.setItem('omnicourse.lang', 'fr');
    expect(useLocale().lang).toBe('vi');
  });

  it('still switches when the browser blocks storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const locale = useLocale();
    expect(locale.lang).toBe('vi');
    locale.set('en');
    expect(locale.lang).toBe('en');
  });
});

describe('formatDate', () => {
  it('writes a date the way each language does', () => {
    expect(formatDate('2026-11-13', 'vi')).toBe('13/11/2026');
    expect(formatDate('2026-11-13', 'en')).toBe('13 Nov 2026');
  });

  it('keeps the calendar date whatever the time zone', () => {
    expect(formatDate('2026-01-01', 'en')).toBe('1 Jan 2026');
  });
});
