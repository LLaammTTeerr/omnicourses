import { edgeScroll } from './flip.js';

// Drag and drop with the pointer, as in the prototype (planner.html): a copy of the tile (the ghost) follows the
// pointer and leans into the way it moves, the tile left behind fades, and the drop target is the element with a
// `data-drop` attribute under the pointer. Nothing captures the pointer and no native drag runs, so the mouse wheel
// still scrolls the page while a tile is held; near the top or bottom edge the page also scrolls by itself. A mouse
// or pen starts the drag after moving a few pixels (a press alone stays a click); a touch starts it after a short
// hold, so a swipe still scrolls. Drawing only: the planner decides what a drop does.

/** The `data-drop` value of a target: `row:<term>`, `pool` or `bin`. */
export type DropTarget = string;

export interface DragHandlers<W> {
  begin(what: W): void;
  over(target: DropTarget | null): void;
  /** `from` is where the ghost was, so the dropped tile can glide from there. */
  drop(what: W, target: DropTarget, from: DOMRect): void;
  cancel(what: W): void;
  /** Whether a drop on `target` changes anything; no (a tile over its own row) flies the ghost home. */
  accepts?(what: W, target: DropTarget): boolean;
  /** The element under a point; the browser's by default. */
  hit?(x: number, y: number): Element | null;
}

const START = 6;
const HOLD = 280;
const EASE = 'cubic-bezier(.2, .8, .2, 1)';
const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function pointerDrag<W>(h: DragHandlers<W>) {
  const hit = h.hit ?? ((x: number, y: number) => (typeof document.elementFromPoint === 'function' ? document.elementFromPoint(x, y) : null));
  let state: {
    what: W;
    el: HTMLElement;
    sx: number;
    sy: number;
    x: number;
    y: number;
    touch: boolean;
    on: boolean;
    hold: ReturnType<typeof setTimeout> | null;
    ghost: HTMLElement | null;
    dx: number;
    dy: number;
    rot: number;
    vx: number;
    target: DropTarget | null;
    frame: number | null;
  } | null = null;

  function targetAt(x: number, y: number): DropTarget | null {
    const el = hit(x, y);
    const found = el?.closest<HTMLElement>('[data-drop]');
    if (found) return found.dataset.drop ?? null;
    // Between two rows the last row stays the target, so the preview does not flicker.
    if (el?.closest('[data-drop-gap]') && state?.target?.startsWith('row:')) return state.target;
    return null;
  }
  function retarget(): void {
    if (!state?.on) return;
    const t = targetAt(state.x, state.y);
    if (t === state.target) return;
    state.target = t;
    h.over(t);
  }

  function place(): void {
    if (!state?.ghost) return;
    state.ghost.style.transform = `translate(${state.x - state.dx}px, ${state.y - state.dy}px) rotate(${state.rot.toFixed(2)}deg) scale(1.05)`;
  }
  function loop(): void {
    if (!state?.on) return;
    // The ghost leans into the way it moves, then settles.
    state.rot += (Math.max(-8, Math.min(8, state.vx * 0.8)) - state.rot) * 0.18;
    state.vx *= 0.8;
    place();
    if (edgeScroll(state.y)) retarget();
    state.frame = requestAnimationFrame(loop);
  }

  function begin(): void {
    if (!state || state.on) return;
    const s = state;
    const r = s.el.getBoundingClientRect();
    const ghost = s.el.cloneNode(true) as HTMLElement;
    ghost.removeAttribute('id');
    ghost.removeAttribute('data-test');
    ghost.querySelectorAll('[id], [data-test]').forEach((n) => (n.removeAttribute('id'), n.removeAttribute('data-test')));
    ghost.removeAttribute('tabindex');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.classList.add('ghost-tile');
    ghost.classList.remove('dragging-src', 'lifted', 'flash');
    ghost.style.width = `${r.width}px`;
    document.body.append(ghost);
    Object.assign(s, { on: true, ghost, dx: s.x - r.left, dy: s.y - r.top });
    document.body.classList.add('dragging');
    document.getSelection()?.removeAllRanges();
    h.begin(s.what);
    place();
    retarget();
    if (s.target === null) h.over(null);
    if (typeof requestAnimationFrame === 'function') s.frame = requestAnimationFrame(loop);
  }

  function finish(): void {
    if (!state) return;
    if (state.hold) clearTimeout(state.hold);
    if (state.frame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(state.frame);
    document.body.classList.remove('dragging');
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('scroll', retarget, true);
    window.removeEventListener('touchmove', noTouchScroll);
    window.removeEventListener('contextmenu', noMenu);
    state = null;
  }

  /** No drop: the ghost flies back to its tile, then the plan is as it was. */
  function flyHome(): void {
    const s = state!;
    const ghost = s.ghost;
    finish();
    h.cancel(s.what);
    if (!ghost) return;
    const home = s.el.getBoundingClientRect();
    const fly = calm() || typeof ghost.animate !== 'function' ? null : ghost.animate([{ transform: ghost.style.transform }, { transform: `translate(${home.left}px, ${home.top}px)` }], { duration: 300, easing: EASE });
    if (!fly) {
      ghost.remove();
      return;
    }
    const done = () => ghost.remove();
    fly.onfinish = done;
    setTimeout(done, 400);
  }

  function onMove(e: Event): void {
    const p = e as PointerEvent;
    if (!state) return;
    state.vx = p.clientX - state.x;
    state.x = p.clientX;
    state.y = p.clientY;
    if (state.on) {
      if (typeof requestAnimationFrame !== 'function') place();
      retarget();
      return;
    }
    const far = Math.hypot(p.clientX - state.sx, p.clientY - state.sy) > START;
    if (!far) return;
    if (state.touch) finish(); // a swipe scrolls, a hold drags
    else begin();
  }
  function onUp(): void {
    if (!state) return;
    if (!state.on) {
      finish();
      return;
    }
    const s = state;
    if (s.target === null || h.accepts?.(s.what, s.target) === false) {
      flyHome();
      return;
    }
    const rect = s.ghost!.getBoundingClientRect();
    s.ghost!.remove();
    finish();
    h.drop(s.what, s.target, rect);
  }
  function onCancel(): void {
    if (state && !state.on) finish();
  }
  function onKey(e: KeyboardEvent): void {
    if (e.key !== 'Escape' || !state) return;
    e.preventDefault();
    if (state.on) flyHome();
    else finish();
  }
  const noTouchScroll = (e: Event) => state?.on && e.preventDefault();
  const noMenu = (e: Event) => state?.on && e.preventDefault();

  return {
    /** Call from the tile's pointerdown. A press on a button inside it, or with another button, is not a drag. */
    down(e: PointerEvent | MouseEvent, el: HTMLElement, what: W): void {
      if (e.button > 0 || (e.target as Element | null)?.closest?.('button, a, input, select, textarea')) return;
      if (state) finish();
      const touch = (e as PointerEvent).pointerType === 'touch';
      state = { what, el, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, touch, on: false, hold: null, ghost: null, dx: 0, dy: 0, rot: 0, vx: 0, target: null, frame: null };
      if (touch) {
        state.hold = setTimeout(() => {
          begin();
          navigator.vibrate?.(15);
        }, HOLD);
      }
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('keydown', onKey);
      window.addEventListener('scroll', retarget, true);
      window.addEventListener('touchmove', noTouchScroll, { passive: false });
      window.addEventListener('contextmenu', noMenu);
    },
    active: () => !!state?.on,
    /** Ends any drag at once, with no drop and no cancel call (the editor is closing or reloading). */
    stop(): void {
      state?.ghost?.remove();
      finish();
    },
  };
}
