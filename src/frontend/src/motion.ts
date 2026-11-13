// Motion the screens share. Every animation respects the student's "reduce motion" setting.

/** True when the student asked the system for less motion. False in jsdom, which has no matchMedia. */
export const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Plays a one-off animation class (`flash`, `shake` in styles.css) on an element again, even if it just played. */
export function replay(el: HTMLElement, cls: 'flash' | 'shake'): void {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

/** Scrolls an element into view, at once when the student asked for less motion. jsdom has no scrollIntoView. */
export function scrollToView(el: HTMLElement, block: ScrollLogicalPosition): void {
  if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block, behavior: reducedMotion() ? 'auto' : 'smooth' });
}
