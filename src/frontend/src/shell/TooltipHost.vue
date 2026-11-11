<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

// One tooltip for the whole app, in place of the browser's: any element with a `title` shows it here, after a short
// hover or at once on keyboard focus. While it shows, the title moves to a data attribute (so the browser does not
// show its own as well) and the element is described by the tooltip; it comes back when the tooltip hides. Nothing
// shows while a course is dragged (body.dragging).
const ID = 'app-tooltip';
const DELAY = 350;

const text = ref('');
const shown = ref(false);
const place = ref({ top: 0, left: 0, below: false });
const el = ref<HTMLElement | null>(null);
let owner: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

const busy = () => document.body.classList.contains('dragging');

function release(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  if (owner) {
    const kept = owner.dataset.tipTitle;
    if (kept !== undefined && !owner.hasAttribute('title')) owner.setAttribute('title', kept);
    delete owner.dataset.tipTitle;
    if (owner.getAttribute('aria-describedby') === ID) owner.removeAttribute('aria-describedby');
  }
  owner = null;
  shown.value = false;
}

async function reveal(): Promise<void> {
  if (!owner || busy()) return;
  shown.value = true;
  if (!owner.hasAttribute('aria-describedby')) owner.setAttribute('aria-describedby', ID);
  await nextTick();
  const r = owner.getBoundingClientRect();
  const tip = el.value?.getBoundingClientRect();
  const w = tip?.width ?? 0;
  const h = tip?.height ?? 0;
  const below = r.top - h - 10 < 8;
  const left = Math.max(8 + w / 2, Math.min(window.innerWidth - 8 - w / 2, r.left + r.width / 2));
  place.value = { top: below ? r.bottom + 8 : r.top - 8, left, below };
}

function take(target: EventTarget | null, now: boolean): void {
  const found = (target as Element | null)?.closest?.<HTMLElement>('[title], [data-tip-title]');
  if (!found || found === owner) return;
  release();
  if (busy()) return;
  const title = found.getAttribute('title') ?? found.dataset.tipTitle ?? '';
  if (!title.trim()) return;
  owner = found;
  found.dataset.tipTitle = title;
  found.removeAttribute('title');
  text.value = title;
  if (now) void reveal();
  else timer = setTimeout(() => void reveal(), DELAY);
}

function leave(event: Event): void {
  if (!owner) return;
  const to = (event as PointerEvent | FocusEvent).relatedTarget as Node | null;
  if (to && owner.contains(to)) return;
  release();
}
const onOver = (e: Event) => take(e.target, false);
const onFocus = (e: Event) => {
  const t = e.target as Element | null;
  // Only a keyboard focus shows it at once; a click that focuses waits for the hover like a pointer does.
  if (t?.matches?.(':focus-visible') !== false) take(t, true);
};
const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') release();
};
const onAway = () => release();

onMounted(() => {
  document.addEventListener('pointerover', onOver);
  document.addEventListener('pointerout', leave);
  document.addEventListener('focusin', onFocus);
  document.addEventListener('focusout', leave);
  document.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', onAway, true);
  window.addEventListener('scroll', onAway, true);
});
onBeforeUnmount(() => {
  release();
  document.removeEventListener('pointerover', onOver);
  document.removeEventListener('pointerout', leave);
  document.removeEventListener('focusin', onFocus);
  document.removeEventListener('focusout', leave);
  document.removeEventListener('keydown', onKey);
  document.removeEventListener('pointerdown', onAway, true);
  window.removeEventListener('scroll', onAway, true);
});
</script>

<template>
  <div
    :id="ID"
    ref="el"
    class="app-tooltip"
    :class="{ below: place.below }"
    role="tooltip"
    :hidden="!shown"
    :style="{ top: `${place.top}px`, left: `${place.left}px` }"
  >{{ text }}</div>
</template>

<style>
.app-tooltip {
  position: fixed; z-index: 130; pointer-events: none; max-width: min(320px, calc(100vw - 16px));
  padding: 7px 10px; border-radius: 9px; background: var(--ink); color: var(--on-ink);
  font: 600 12.5px/1.4 var(--font); letter-spacing: 0; white-space: pre-line; text-align: left;
  box-shadow: var(--shadow-lg); transform: translate(-50%, -100%); animation: tip-in 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.app-tooltip.below { transform: translate(-50%, 0); animation-name: tip-in-below; }
.app-tooltip::after {
  content: ''; position: absolute; left: 50%; bottom: -4px; width: 8px; height: 8px; margin-left: -4px;
  background: inherit; transform: rotate(45deg); border-radius: 1px;
}
.app-tooltip.below::after { bottom: auto; top: -4px; }
:root[data-theme='dark'] .app-tooltip { background: #2a3040; color: var(--ink); border: 1px solid var(--edge-strong); }
@keyframes tip-in { from { opacity: 0; transform: translate(-50%, calc(-100% + 4px)) scale(0.96); } }
@keyframes tip-in-below { from { opacity: 0; transform: translate(-50%, -4px) scale(0.96); } }
</style>
