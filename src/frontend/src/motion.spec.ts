import { afterEach, describe, expect, it, vi } from 'vitest';
import { reducedMotion, replay } from './motion.js';

describe('motion', () => {
  afterEach(() => vi.unstubAllGlobals());

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
