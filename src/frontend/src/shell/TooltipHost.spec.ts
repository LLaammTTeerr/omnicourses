import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TooltipHost from './TooltipHost.vue';

let wrapper: VueWrapper | undefined;
let button: HTMLButtonElement;

beforeEach(() => {
  vi.useFakeTimers();
  button = document.createElement('button');
  button.title = 'Hoàn tác (Ctrl+Z)';
  button.textContent = 'Undo';
  document.body.append(button);
  wrapper = mount(TooltipHost, { attachTo: document.body });
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  button.remove();
  vi.useRealTimers();
});

const tip = () => document.querySelector<HTMLElement>('[role="tooltip"]');

describe('TooltipHost', () => {
  it('shows a title in its own tooltip after a short hover, instead of the browser one', async () => {
    button.dispatchEvent(new Event('pointerover', { bubbles: true }));
    // The browser's own tooltip would show too: the title moves aside while ours is up.
    expect(button.hasAttribute('title')).toBe(false);
    expect(tip()?.hidden).toBe(true);
    vi.advanceTimersByTime(400);
    await wrapper!.vm.$nextTick();
    expect(tip()?.hidden).toBe(false);
    expect(tip()?.textContent).toBe('Hoàn tác (Ctrl+Z)');
    expect(button.getAttribute('aria-describedby')).toBe(tip()!.id);
  });

  it('hides it and gives the title back when the pointer leaves', async () => {
    button.dispatchEvent(new Event('pointerover', { bubbles: true }));
    vi.advanceTimersByTime(400);
    await wrapper!.vm.$nextTick();
    button.dispatchEvent(new Event('pointerout', { bubbles: true }));
    await wrapper!.vm.$nextTick();
    expect(tip()?.hidden).toBe(true);
    expect(button.getAttribute('title')).toBe('Hoàn tác (Ctrl+Z)');
    expect(button.hasAttribute('aria-describedby')).toBe(false);
  });

  it('shows at once on keyboard focus and hides on Escape', async () => {
    button.focus();
    await wrapper!.vm.$nextTick();
    expect(tip()?.hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper!.vm.$nextTick();
    expect(tip()?.hidden).toBe(true);
  });

  it('stays out of the way while something is dragged', async () => {
    document.body.classList.add('dragging');
    button.dispatchEvent(new Event('pointerover', { bubbles: true }));
    vi.advanceTimersByTime(400);
    await wrapper!.vm.$nextTick();
    expect(tip()?.hidden).toBe(true);
    expect(button.getAttribute('title')).toBe('Hoàn tác (Ctrl+Z)');
    document.body.classList.remove('dragging');
  });
});
