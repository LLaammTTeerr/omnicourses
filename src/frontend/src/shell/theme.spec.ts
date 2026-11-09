import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import indexHtml from '../../index.html?raw';
import { THEME_STORAGE_KEY, useTheme } from './theme.js';

function systemPrefersDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: dark && query.includes('dark') }));
}

describe('theme store', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    setActivePinia(createPinia());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('follows the system until the student chooses', async () => {
    systemPrefersDark(true);
    expect(useTheme().theme).toBe('dark');
    await nextTick();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('starts light on a light system', () => {
    systemPrefersDark(false);
    expect(useTheme().theme).toBe('light');
  });

  it('toggles, sets <html data-theme> and remembers the choice after a reload', async () => {
    systemPrefersDark(false);
    useTheme().toggle();
    await nextTick();
    expect(document.documentElement.dataset.theme).toBe('dark');
    setActivePinia(createPinia());
    expect(useTheme().theme).toBe('dark');
  });

  it('ignores a stored value that is not a theme', () => {
    systemPrefersDark(false);
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    expect(useTheme().theme).toBe('light');
  });

  it('still switches when the browser blocks storage', () => {
    systemPrefersDark(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const theme = useTheme();
    theme.set('dark');
    expect(theme.theme).toBe('dark');
  });

  it('shares its storage key with the script that paints index.html', () => {
    expect(indexHtml).toContain(`'${THEME_STORAGE_KEY}'`);
  });
});
