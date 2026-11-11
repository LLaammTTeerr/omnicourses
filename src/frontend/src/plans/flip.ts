// Tiles glide from where they were to where a change put them (FLIP: first, last, invert, play). Drawing only: it
// reads positions before and after Vue renders the change, and moves nothing in the board. Skipped when the student
// asks for reduced motion, and where the browser cannot animate (jsdom).

/** Where each tile is now, by its board key. */
export type Snapshot = Map<string, DOMRect>;

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function snapshot(root: ParentNode | null): Snapshot {
  const rects: Snapshot = new Map();
  root?.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => rects.set(el.dataset.flip!, el.getBoundingClientRect()));
  return rects;
}

/** Plays each tile from its place in `before` to its place now; a tile that was not on screen fades in. */
export function play(root: ParentNode | null, before: Snapshot): void {
  if (!root || reducedMotion()) return;
  root.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
    if (typeof el.animate !== 'function') return;
    const was = before.get(el.dataset.flip!);
    if (!was) {
      el.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2, .8, .2, 1)' });
      return;
    }
    const now = el.getBoundingClientRect();
    const dx = was.left - now.left;
    const dy = was.top - now.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2, .8, .2, 1)' });
  });
}

/**
 * Scrolls the window while a dragged course is held near its top or bottom edge, faster the closer it gets.
 * Returns how far it scrolled, for tests.
 */
export function edgeScroll(clientY: number, viewport = window.innerHeight, edge = 80): number {
  let by = 0;
  if (clientY < edge) by = -Math.ceil((edge - clientY) / 5);
  else if (clientY > viewport - edge) by = Math.ceil((clientY - viewport + edge) / 5);
  if (by) window.scrollBy(0, by);
  return by;
}

/**
 * Scrolls once per animation frame while a drag is held near an edge, as the prototype does, so the page glides at a
 * steady pace instead of jumping on each `dragover`, which a browser fires at its own rate. `move` records where the
 * pointer is; `stop` ends the loop when the drag does.
 */
export function edgeScroller(
  frame: (step: () => void) => number = (step) => requestAnimationFrame(step),
  cancel: (id: number) => void = (id) => cancelAnimationFrame(id),
) {
  let y: number | null = null;
  let id: number | null = null;
  const tick = () => {
    id = null;
    // Away from the edges the loop rests; the next `move` starts it again.
    if (y === null || edgeScroll(y) === 0) return;
    id = frame(tick);
  };
  return {
    move(clientY: number): void {
      y = clientY;
      if (id === null) id = frame(tick);
    },
    stop(): void {
      y = null;
      if (id !== null) cancel(id);
      id = null;
    },
  };
}
