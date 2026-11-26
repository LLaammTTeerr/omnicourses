import { edgeScroll, reducedMotion, SETTLE_EASING } from './flip.js';

export type DropTarget = string;

export interface DragHandlers<W> {
  begin(what: W): void;
  over(target: DropTarget | null): void;
  drop(what: W, target: DropTarget, from: DOMRect): void;
  cancel(what: W): void;
  accepts?(what: W, target: DropTarget): boolean;
  hit?(x: number, y: number): Element | null;
}

const START = 6;
const HOLD = 280;
const GHOST_SCALE = 1.05;
const MAX_LEAN_DEG = 8;
const LEAN_PER_SPEED = 0.8;
const LEAN_EASING = 0.18;
const SPEED_DECAY = 0.8;
const GRAB_POINT_EASING = 0.25;
const FLY_HOME_MS = 300;
const FLY_HOME_FALLBACK_MS = 400;
const HOLD_VIBRATION_MS = 15;

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
    cx: number;
    cy: number;
    rot: number;
    vx: number;
    target: DropTarget | null;
    frame: number | null;
  } | null = null;

  function targetAt(x: number, y: number): DropTarget | null {
    const el = hit(x, y);
    const found = el?.closest<HTMLElement>('[data-drop]');
    if (found) return found.dataset.drop ?? null;
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
    state.ghost.style.transform = `translate(${state.x - state.dx}px, ${state.y - state.dy}px) rotate(${state.rot.toFixed(2)}deg) scale(${GHOST_SCALE})`;
  }
  function loop(): void {
    if (!state?.on) return;
    state.rot += (Math.max(-MAX_LEAN_DEG, Math.min(MAX_LEAN_DEG, state.vx * LEAN_PER_SPEED)) - state.rot) * LEAN_EASING;
    state.vx *= SPEED_DECAY;
    state.dx += (state.cx - state.dx) * GRAB_POINT_EASING;
    state.dy += (state.cy - state.dy) * GRAB_POINT_EASING;
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
    Object.assign(s, { on: true, ghost, dx: s.x - r.left, dy: s.y - r.top, cx: r.width / 2, cy: r.height / 2 });
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

  function flyHome(): void {
    const s = state!;
    const ghost = s.ghost;
    finish();
    h.cancel(s.what);
    if (!ghost) return;
    const home = s.el.getBoundingClientRect();
    const fly = reducedMotion() || typeof ghost.animate !== 'function' ? null : ghost.animate([{ transform: ghost.style.transform }, { transform: `translate(${home.left}px, ${home.top}px)` }], { duration: FLY_HOME_MS, easing: SETTLE_EASING });
    if (!fly) {
      ghost.remove();
      return;
    }
    const done = () => ghost.remove();
    fly.onfinish = done;
    setTimeout(done, FLY_HOME_FALLBACK_MS);
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
    if (state.touch) finish();
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
    down(e: PointerEvent | MouseEvent, el: HTMLElement, what: W): void {
      if (e.button > 0 || (e.target as Element | null)?.closest?.('button, a, input, select, textarea')) return;
      if (state) finish();
      const touch = (e as PointerEvent).pointerType === 'touch';
      state = { what, el, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, touch, on: false, hold: null, ghost: null, dx: 0, dy: 0, cx: 0, cy: 0, rot: 0, vx: 0, target: null, frame: null };
      if (touch) {
        state.hold = setTimeout(() => {
          begin();
          navigator.vibrate?.(HOLD_VIBRATION_MS);
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
    stop(): void {
      state?.ghost?.remove();
      finish();
    },
  };
}
