import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import ToastHost from './ToastHost.vue';
import { TOAST_MS, useToast } from './toast.js';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a message immediately and clears it after TOAST_MS', () => {
    const toast = useToast();
    expect(toast.message).toBe('');

    toast.show('Đã lưu lộ trình.');
    expect(toast.message).toBe('Đã lưu lộ trình.');

    vi.advanceTimersByTime(TOAST_MS - 1);
    expect(toast.message).toBe('Đã lưu lộ trình.');

    vi.advanceTimersByTime(1);
    expect(toast.message).toBe('');
  });

  it('restarts the timer when a newer message replaces an earlier one', () => {
    const toast = useToast();
    toast.show('Đang lưu…');
    vi.advanceTimersByTime(TOAST_MS - 500);

    toast.show('Đã lưu.');
    vi.advanceTimersByTime(500);
    expect(toast.message).toBe('Đã lưu.');

    vi.advanceTimersByTime(TOAST_MS - 500);
    expect(toast.message).toBe('');
  });

  it('renders a polite status banner in ToastHost only while a message is active', async () => {
    const w = mount(ToastHost);
    const banner = w.get('[data-test="toast"]');
    expect(banner.attributes('role')).toBe('status');
    expect(banner.attributes('aria-live')).toBe('polite');
    expect(banner.classes()).not.toContain('show');

    useToast().show('Đã hoàn tác.');
    await nextTick();
    expect(banner.text()).toBe('Đã hoàn tác.');
    expect(banner.classes()).toContain('show');

    vi.advanceTimersByTime(TOAST_MS);
    await nextTick();
    expect(banner.text()).toBe('');
    expect(banner.classes()).not.toContain('show');
    w.unmount();
  });
});
