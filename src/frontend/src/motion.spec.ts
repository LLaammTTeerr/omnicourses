import { afterEach, describe, expect, it, vi } from 'vitest';
import { reducedMotion, replay, scrollToView } from './motion.js';

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

  it('scrolls an element into view smoothly, at once when the student asked for less motion', () => {
    const el = document.createElement('div');
    const scroll = vi.fn();
    el.scrollIntoView = scroll;
    scrollToView(el, 'center');
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    scrollToView(el, 'nearest');
    expect(scroll.mock.calls).toEqual([[{ block: 'center', behavior: 'smooth' }], [{ block: 'nearest', behavior: 'auto' }]]);
  });

  it('does nothing where the browser cannot scroll an element into view (jsdom)', () => {
    expect(() => scrollToView(document.createElement('div'), 'center')).not.toThrow();
  });
});
