export type Snapshot = Map<string, DOMRect>;

export const FLIP_MS = 440;
const FADE_IN_MS = 240;
const GLIDE_MS = 320;
export const SETTLE_EASING = 'cubic-bezier(.2, .8, .2, 1)';

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function snapshot(root: ParentNode | null): Snapshot {
  const rects: Snapshot = new Map();
  root?.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => rects.set(el.dataset.flip!, el.getBoundingClientRect()));
  return rects;
}

export interface Lift {
  flip: string;
  rect: DOMRect;
}

export function play(root: ParentNode | null, before: Snapshot, lift?: Lift): void {
  if (!root || reducedMotion()) return;
  root.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
    if (typeof el.animate !== 'function') return;
    if (lift && el.dataset.flip === lift.flip) {
      const now = el.getBoundingClientRect();
      el.animate(
        [
          { transform: `translate(${lift.rect.left - now.left}px, ${lift.rect.top - now.top}px) scale(1.05)`, boxShadow: 'var(--shadow-lg)', zIndex: 5 },
          { transform: 'none', boxShadow: 'none', zIndex: 5 },
        ],
        { duration: FLIP_MS, easing: 'cubic-bezier(.3, 1.25, .4, 1)' },
      );
      return;
    }
    const was = before.get(el.dataset.flip!);
    if (!was) {
      el.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: FADE_IN_MS, easing: SETTLE_EASING });
      return;
    }
    const now = el.getBoundingClientRect();
    const dx = was.left - now.left;
    const dy = was.top - now.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: GLIDE_MS, easing: SETTLE_EASING });
  });
}

export function edgeScroll(clientY: number, viewport = window.innerHeight, edge = 80): number {
  let by = 0;
  if (clientY < edge) by = -Math.ceil((edge - clientY) / 5);
  else if (clientY > viewport - edge) by = Math.ceil((clientY - viewport + edge) / 5);
  if (by) window.scrollBy(0, by);
  return by;
}
