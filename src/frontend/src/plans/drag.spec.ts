import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pointerDrag, type DropTarget } from './drag.js';

// The pointer drag of the planner (drag.ts): a ghost follows the pointer, the target under it is the element with
// `data-drop`, and the wheel scrolls the page meanwhile, since nothing captures it.

let source: HTMLElement;
let row: HTMLElement;
let under: Element | null;
const calls: string[] = [];

const at = (type: string, x: number, y: number, { button = 0, pointerType = 'mouse' }: { button?: number; pointerType?: string } = {}) =>
  Object.assign(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button }), { pointerType });

function setup(accepts?: (what: string, target: DropTarget) => boolean) {
  return pointerDrag<string>({
    accepts,
    begin: (what) => calls.push(`begin ${what}`),
    over: (target: DropTarget | null) => calls.push(`over ${target ?? '-'}`),
    drop: (what, target) => calls.push(`drop ${what} ${target}`),
    cancel: (what) => calls.push(`cancel ${what}`),
    hit: () => under,
  });
}

beforeEach(() => {
  calls.length = 0;
  source = document.createElement('div');
  source.id = 'tile-1';
  source.dataset.test = 'tile-ZZ101';
  source.textContent = 'ZZ101';
  row = document.createElement('section');
  row.dataset.drop = 'row:2026-2';
  document.body.append(source, row);
  under = null;
});
afterEach(() => {
  document.body.innerHTML = '';
  document.body.className = '';
});

describe('pointerDrag', () => {
  it('starts after the pointer moves a few pixels, with a ghost that copies the tile but not its ids', () => {
    const drag = setup();
    drag.down(at('pointerdown', 10, 10), source, 'ZZ101');
    window.dispatchEvent(at('pointermove', 12, 12));
    expect(calls).toEqual([]);
    window.dispatchEvent(at('pointermove', 30, 30));
    expect(calls).toEqual(['begin ZZ101', 'over -']);
    const ghost = document.querySelector<HTMLElement>('.ghost-tile')!;
    expect(ghost.textContent).toBe('ZZ101');
    expect(ghost.id).toBe('');
    expect(ghost.dataset.test).toBeUndefined();
    expect(document.body.classList.contains('dragging')).toBe(true);
    drag.stop();
  });

  it('keeps the ghost on the pointer every frame, centred under it, leaning into a fast move', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => frames.push(f));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const run = (n: number) => {
      for (let i = 0; i < n; i++) frames.shift()?.(0);
    };
    source.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect;
    const drag = setup();
    drag.down(at('pointerdown', 10, 10), source, 'ZZ101');
    window.dispatchEvent(at('pointermove', 300, 300));
    const ghost = document.querySelector<HTMLElement>('.ghost-tile')!;
    const pos = () => ghost.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\) rotate\(([-\d.]+)deg\)/)!.slice(1).map(Number);
    run(1);
    expect(pos()[2]).not.toBe(0); // a fast move to the right tilts it
    run(40);
    // The grab point has slid to the middle: 300 − 200/2, 300 − 100/2.
    expect(pos()[0]).toBeCloseTo(200, 0);
    expect(pos()[1]).toBeCloseTo(250, 0);
    // A jump of the pointer moves the ghost the whole way in the next frame: it never trails behind.
    window.dispatchEvent(at('pointermove', 700, 500));
    run(1);
    expect(pos()[0]).toBeCloseTo(600, 0);
    expect(pos()[1]).toBeCloseTo(450, 0);
    drag.stop();
    vi.unstubAllGlobals();
  });

  it('reports the drop target under the pointer, and drops there', () => {
    const drag = setup();
    drag.down(at('pointerdown', 10, 10), source, 'ZZ101');
    under = row;
    window.dispatchEvent(at('pointermove', 40, 40));
    expect(calls).toEqual(['begin ZZ101', 'over row:2026-2']);
    window.dispatchEvent(at('pointerup', 40, 40));
    expect(calls.at(-1)).toBe('drop ZZ101 row:2026-2');
    expect(document.querySelector('.ghost-tile')).toBeNull();
    expect(document.body.classList.contains('dragging')).toBe(false);
  });

  it('finds the target again when the page scrolls under a still pointer (the wheel works while dragging)', () => {
    const drag = setup();
    drag.down(at('pointerdown', 10, 10), source, 'ZZ101');
    window.dispatchEvent(at('pointermove', 40, 40));
    under = row;
    window.dispatchEvent(new Event('scroll'));
    expect(calls).toEqual(['begin ZZ101', 'over -', 'over row:2026-2']);
    drag.stop();
  });

  it('cancels with Escape, or when released over no target', () => {
    const drag = setup();
    drag.down(at('pointerdown', 10, 10), source, 'ZZ101');
    window.dispatchEvent(at('pointermove', 40, 40));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(calls.at(-1)).toBe('cancel ZZ101');

    drag.down(at('pointerdown', 10, 10), source, 'ZZ101');
    window.dispatchEvent(at('pointermove', 40, 40));
    window.dispatchEvent(at('pointerup', 40, 40));
    expect(calls.at(-1)).toBe('cancel ZZ101');
  });

  it('flies home when the target would change nothing, such as its own row', () => {
    const drag = setup((_what, target) => target !== 'row:2026-2');
    drag.down(at('pointerdown', 10, 10), source, 'ZZ101');
    under = row;
    window.dispatchEvent(at('pointermove', 40, 40));
    window.dispatchEvent(at('pointerup', 40, 40));
    expect(calls.at(-1)).toBe('cancel ZZ101');
  });

  it('is only a click when the pointer does not move: nothing starts', () => {
    const drag = setup();
    drag.down(at('pointerdown', 10, 10), source, 'ZZ101');
    window.dispatchEvent(at('pointerup', 10, 10));
    expect(calls).toEqual([]);
    expect(drag.active()).toBe(false);
  });

  it('on touch, starts after a short hold, and a swipe before it scrolls instead', () => {
    vi.useFakeTimers();
    const drag = setup();
    drag.down(at('pointerdown', 10, 10, { pointerType: 'touch' }), source, 'ZZ101');
    window.dispatchEvent(at('pointermove', 10, 40, { pointerType: 'touch' }));
    vi.advanceTimersByTime(400);
    expect(calls).toEqual([]);

    drag.down(at('pointerdown', 10, 10, { pointerType: 'touch' }), source, 'ZZ101');
    vi.advanceTimersByTime(400);
    expect(calls[0]).toBe('begin ZZ101');
    drag.stop();
    vi.useRealTimers();
  });

  it('ignores a press on a button inside the tile, and a press with another button', () => {
    const drag = setup();
    const inner = document.createElement('button');
    source.append(inner);
    const press = at('pointerdown', 10, 10);
    Object.defineProperty(press, 'target', { value: inner });
    drag.down(press, source, 'ZZ101');
    window.dispatchEvent(at('pointermove', 40, 40));
    drag.down(at('pointerdown', 10, 10, { button: 2 }), source, 'ZZ101');
    window.dispatchEvent(at('pointermove', 40, 40));
    expect(calls).toEqual([]);
  });
});
