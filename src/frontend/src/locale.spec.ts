import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { formatDate, formatDateTime, formatNumber, localName, useLocale } from './locale.js';

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

  it('reads the choice students saved before this version', () => {
    localStorage.setItem('omnicourse.lang', 'en');
    expect(useLocale().lang).toBe('en');
  });

  it.each(['fr', 'toString'])('ignores the stored value %j, which is not a language', (value) => {
    localStorage.setItem('omnicourse.lang', value);
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

  it('keeps the calendar date in a time zone behind UTC', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles');
    try {
      expect(new Date('2026-01-01T00:00:00Z').getDate()).toBe(31);
      expect(formatDate('2026-01-01', 'en')).toBe('1 Jan 2026');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('formatDateTime', () => {
  it('writes an instant the way each language does, in the browser time zone', () => {
    vi.stubEnv('TZ', 'Asia/Ho_Chi_Minh');
    try {
      expect(formatDateTime('2026-12-09T08:05:00.000Z', 'vi')).toBe('15:05 09/12/2026');
      expect(formatDateTime('2026-12-09T08:05:00.000Z', 'en')).toBe('9 Dec 2026, 15:05');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('localName', () => {
  it('names in English when there is an English name, else in Vietnamese', () => {
    expect(localName({ nameVi: 'Học máy', nameEn: 'Machine learning' }, 'en')).toBe('Machine learning');
    expect(localName({ nameVi: 'Học máy', nameEn: 'Machine learning' }, 'vi')).toBe('Học máy');
    expect(localName({ nameVi: 'Học máy', nameEn: null }, 'en')).toBe('Học máy');
  });
});

describe('formatNumber', () => {
  it('writes a number as each language does, to the decimals asked for at most', () => {
    expect(formatNumber(7.25, 'vi', 1)).toBe('7,3');
    expect(formatNumber(7.25, 'en', 2)).toBe('7.25');
    expect(formatNumber(8, 'en', 2)).toBe('8');
  });
});
