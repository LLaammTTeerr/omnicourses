import { afterEach, describe, expect, it, vi } from 'vitest';
import { edgeScroll, play, snapshot } from './flip.js';

describe('dragging near the edge of the window', () => {
  afterEach(() => vi.restoreAllMocks());

  it('scrolls up near the top and down near the bottom, faster closer to the edge, and not in between', () => {
    const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
    expect(edgeScroll(0, 800)).toBe(-20);
    expect(edgeScroll(60, 800)).toBe(-5);
    expect(edgeScroll(400, 800)).toBe(0);
    expect(edgeScroll(790, 800)).toBe(18);
    expect(scroll.mock.calls).toEqual([
      [0, -20],
      [0, -5],
      [0, 18],
    ]);
  });
});

describe('tiles gliding to their new place', () => {
  afterEach(() => vi.restoreAllMocks());

  it('plays each tile from where it was, fades in a new one, and leaves one that did not move', () => {
    const root = document.createElement('div');
    root.innerHTML = '<span data-flip="a"></span><span data-flip="b"></span><span data-flip="c"></span>';
    const [a, b, c] = [...root.querySelectorAll<HTMLElement>('[data-flip]')];
    const at = (left: number, top: number) => ({ left, top }) as DOMRect;
    a!.getBoundingClientRect = () => at(0, 0);
    b!.getBoundingClientRect = () => at(10, 10);
    const before = snapshot(root);
    expect([...before.keys()]).toEqual(['a', 'b', 'c']);
    before.delete('c');
    a!.getBoundingClientRect = () => at(0, 50);
    const calls = new Map<string, unknown>();
    for (const el of [a, b, c]) el!.animate = ((frames: Keyframe[]) => (calls.set(el!.dataset.flip!, frames[0]), {})) as unknown as HTMLElement['animate'];
    play(root, before);
    expect(calls.get('a')).toEqual({ transform: 'translate(0px, -50px)' });
    expect(calls.has('b')).toBe(false);
    expect(calls.get('c')).toEqual({ opacity: 0, transform: 'scale(.92)' });
  });

  it('does nothing when the student asks for reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const root = document.createElement('div');
    root.innerHTML = '<span data-flip="a"></span>';
    const el = root.querySelector<HTMLElement>('[data-flip]')!;
    const animate = vi.fn();
    el.animate = animate;
    play(root, new Map());
    expect(animate).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
