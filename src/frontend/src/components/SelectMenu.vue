<script setup lang="ts" generic="T extends string | number">
import { computed, nextTick, onBeforeUnmount, ref, useAttrs, useId, watch } from 'vue';
import Icon from '../shell/Icon.vue';

// The app's own select (WAI-ARIA "select-only combobox"): a button that shows the choice and opens a styled list.
// Focus stays on the button; the arrows, Home, End and a first letter move through the options, Enter or Space
// picks, Escape closes. The list is fixed to the viewport, so a table or a scrolling card never clips it. Attributes
// such as aria-label, aria-invalid, aria-describedby, id and data-test go on the button; class goes on the wrapper.
defineOptions({ inheritAttrs: false });

interface SelectOption<V> {
  value: V;
  label: string;
  disabled?: boolean;
}

const props = defineProps<{ modelValue: T | null | undefined; options: readonly SelectOption<T>[]; placeholder?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: T] }>();
const attrs = useAttrs();
const rootAttrs = computed(() => ({ class: attrs.class, style: attrs.style }));
const buttonAttrs = computed(() => {
  const { class: _c, style: _s, ...rest } = attrs;
  return rest;
});

const uid = useId();
const listId = `${uid}-list`;
const optionId = (i: number) => `${uid}-opt-${i}`;

const open = ref(false);
const active = ref(-1);
const trigger = ref<HTMLButtonElement | null>(null);
const list = ref<HTMLUListElement | null>(null);
const root = ref<HTMLElement | null>(null);
const place = ref<{ top: number; left: number; width: number; up: boolean }>({ top: 0, left: 0, width: 0, up: false });

const chosen = computed(() => props.options.findIndex((o) => o.value === props.modelValue));
const shown = computed(() => props.options[chosen.value]?.label ?? props.placeholder ?? '');

const enabled = (i: number) => i >= 0 && i < props.options.length && !props.options[i]!.disabled;
function step(from: number, by: 1 | -1): number {
  for (let i = from + by; i >= 0 && i < props.options.length; i += by) if (enabled(i)) return i;
  return from;
}
const first = () => step(-1, 1);
const last = () => step(props.options.length, -1);

function measure(): void {
  const el = trigger.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const room = window.innerHeight - r.bottom;
  const up = room < 220 && r.top > room;
  place.value = { top: up ? r.top - 6 : r.bottom + 6, left: r.left, width: r.width, up };
}

function show(at = enabled(chosen.value) ? chosen.value : first()): void {
  measure();
  open.value = true;
  active.value = at;
  void reveal();
}
function hide(): void {
  open.value = false;
}
function pick(i: number): void {
  if (!enabled(i)) return;
  hide();
  if (props.options[i]!.value !== props.modelValue) emit('update:modelValue', props.options[i]!.value);
  trigger.value?.focus();
}

async function reveal(): Promise<void> {
  await nextTick();
  const el = list.value?.querySelector<HTMLElement>(`#${CSS.escape(optionId(active.value))}`);
  if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' });
}

let typed = '';
let typedAt = 0;
function typeAhead(key: string): void {
  const now = Date.now();
  typed = now - typedAt > 700 ? key : typed + key;
  typedAt = now;
  const want = typed.toLocaleLowerCase();
  const order = [...props.options.keys()].map((k) => (k + Math.max(active.value, 0) + (typed.length === 1 ? 1 : 0)) % props.options.length);
  const hit = order.find((i) => enabled(i) && props.options[i]!.label.toLocaleLowerCase().startsWith(want));
  if (hit === undefined) return;
  if (!open.value) show(hit);
  else active.value = hit;
  void reveal();
}

function onKey(event: KeyboardEvent): void {
  const key = event.key;
  if (!open.value) {
    if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') show();
    else if (key === 'Home') show(first());
    else if (key === 'End') show(last());
    else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) typeAhead(key);
    else return;
    event.preventDefault();
    return;
  }
  if (key === 'ArrowDown') active.value = step(active.value, 1);
  else if (key === 'ArrowUp') active.value = step(active.value, -1);
  else if (key === 'Home') active.value = first();
  else if (key === 'End') active.value = last();
  else if (key === 'PageDown') active.value = Array.from({ length: 10 }).reduce<number>((i) => step(i, 1), active.value);
  else if (key === 'PageUp') active.value = Array.from({ length: 10 }).reduce<number>((i) => step(i, -1), active.value);
  else if (key === 'Enter' || key === ' ') pick(active.value);
  else if (key === 'Escape') hide();
  else if (key === 'Tab') {
    hide();
    return;
  } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) typeAhead(key);
  else return;
  event.preventDefault();
  void reveal();
}

function onOutside(event: Event): void {
  if (!root.value?.contains(event.target as Node)) hide();
}
watch(open, (isOpen) => {
  const method = isOpen ? 'addEventListener' : 'removeEventListener';
  document[method]('pointerdown', onOutside, true);
  window[method]('resize', measure);
  window[method]('scroll', measure, true);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutside, true);
  window.removeEventListener('resize', measure);
  window.removeEventListener('scroll', measure, true);
});
</script>

<template>
  <div ref="root" class="ui-select" :class="[rootAttrs.class, { open }]" :style="rootAttrs.style as never">
    <button
      ref="trigger"
      class="select ui-select-trigger"
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="listId"
      :aria-activedescendant="open && active >= 0 ? optionId(active) : undefined"
      v-bind="buttonAttrs"
      @click="open ? hide() : show()"
      @keydown="onKey"
      @blur="hide"
    >
      <span class="ui-select-value" :class="{ t3: chosen < 0 }">{{ shown }}</span>
      <Icon name="down" size="sm" />
    </button>
    <ul
      v-show="open"
      :id="listId"
      ref="list"
      class="ui-select-list"
      :class="{ up: place.up }"
      role="listbox"
      tabindex="-1"
      :style="{ top: `${place.top}px`, left: `${place.left}px`, minWidth: `${place.width}px` }"
      @pointerdown.prevent
    >
      <li
        v-for="(option, i) in options"
        :id="optionId(i)"
        :key="String(option.value)"
        role="option"
        :aria-selected="i === chosen"
        :aria-disabled="option.disabled || undefined"
        :class="{ active: i === active }"
        @click="pick(i)"
        @pointermove="enabled(i) && (active = i)"
      >
        <span>{{ option.label }}</span>
        <Icon v-if="i === chosen" name="check" size="sm" />
      </li>
    </ul>
  </div>
</template>

<style>
.ui-select { position: relative; min-width: 0; }
.ui-select-trigger {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; text-align: left; cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}
.ui-select-trigger:hover { border-color: var(--ink-3); }
.ui-select-trigger:focus-visible { outline: none; border-color: var(--info); box-shadow: 0 0 0 3px color-mix(in oklab, var(--info) 22%, transparent); }
.ui-select-value { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ui-select-trigger .icon { color: var(--ink-3); transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1); }
.ui-select.open .ui-select-trigger { border-color: var(--info); box-shadow: 0 0 0 3px color-mix(in oklab, var(--info) 22%, transparent); }
.ui-select.open .ui-select-trigger .icon { transform: rotate(180deg); }
.ui-select-list {
  position: fixed; z-index: 120; margin: 0; padding: 5px; list-style: none; max-height: min(300px, 50vh); overflow-y: auto;
  max-width: min(420px, calc(100vw - 24px)); background: var(--surface); border: 1px solid var(--edge); border-radius: 12px;
  box-shadow: var(--shadow-lg); transform-origin: top center; animation: ui-select-in 0.16s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.ui-select-list.up { transform: translateY(-100%); transform-origin: bottom center; animation-name: ui-select-in-up; }
.ui-select-list li {
  display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; border-radius: 8px;
  font-size: 14px; cursor: pointer; color: var(--ink); white-space: nowrap;
}
.ui-select-list li.active { background: var(--surface-2); }
.ui-select-list li[aria-selected='true'] { font-weight: 650; color: color-mix(in oklab, var(--info) 80%, var(--ink)); }
.ui-select-list li[aria-selected='true'] .icon { color: var(--info); }
.ui-select-list li[aria-disabled='true'] { color: var(--ink-3); cursor: not-allowed; }
:root[data-theme='dark'] .ui-select-list { background: var(--surface-2); border-color: var(--edge-strong); }
:root[data-theme='dark'] .ui-select-list li.active { background: var(--surface-3); }
@keyframes ui-select-in { from { opacity: 0; transform: translateY(-4px) scale(0.98); } }
@keyframes ui-select-in-up { from { opacity: 0; transform: translateY(calc(-100% + 4px)) scale(0.98); } }
</style>
