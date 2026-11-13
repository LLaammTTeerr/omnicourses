import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reducedMotion, replay, SHAKE_MS } from './motion.js';

// Read from disk: Vitest does not load CSS, so a ?raw import comes back empty. Under jsdom import.meta.url is not a
// file URL, so the path is built from the file name.
const css = readFileSync(join(dirname(import.meta.filename), 'styles.css'), 'utf8');

describe('motion', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('gives .shake in styles.css the duration the planner waits for', () => {
    const seconds = /\.shake\s*\{\s*animation:\s*shake\s+([\d.]+)s/.exec(css)?.[1];
    expect(Number(seconds) * 1000).toBe(SHAKE_MS);
  });

  it('reads the reduced-motion setting, and calls jsdom without matchMedia calm', () => {
    expect(reducedMotion()).toBe(false);
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(prefers-reduced-motion: reduce)' }));
    expect(reducedMotion()).toBe(true);
  });

  it('plays an animation class again, and takes it off when it ends', () => {
    const el = document.createElement('div');
    el.classList.add('flash');
    replay(el, 'flash');
    expect(el.classList.contains('flash')).toBe(true);
    el.dispatchEvent(new Event('animationend'));
    expect(el.classList.contains('flash')).toBe(false);
  });
});
