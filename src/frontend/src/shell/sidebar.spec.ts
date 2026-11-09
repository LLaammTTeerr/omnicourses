import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { isSidebarKey, useSidebar } from './sidebar.js';

describe('sidebar store', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('starts wide, narrows, and remembers it after a reload', () => {
    expect(useSidebar().mini).toBe(false);
    useSidebar().toggle();
    expect(useSidebar().mini).toBe(true);
    setActivePinia(createPinia());
    expect(useSidebar().mini).toBe(true);
  });
});

describe('isSidebarKey', () => {
  const key = (init: KeyboardEventInit, target: EventTarget = document.body) => {
    const event = new KeyboardEvent('keydown', init);
    Object.defineProperty(event, 'target', { value: target });
    return event;
  };

  it('takes a plain [', () => {
    expect(isSidebarKey(key({ key: '[' }))).toBe(true);
  });

  it('ignores other keys and [ with a modifier', () => {
    expect(isSidebarKey(key({ key: ']' }))).toBe(false);
    expect(isSidebarKey(key({ key: '[', ctrlKey: true }))).toBe(false);
    expect(isSidebarKey(key({ key: '[', metaKey: true }))).toBe(false);
    expect(isSidebarKey(key({ key: '[', altKey: true }))).toBe(false);
  });

  it.each(['input', 'textarea', 'select'])('ignores [ typed in a %s', (tag) => {
    expect(isSidebarKey(key({ key: '[' }, document.createElement(tag)))).toBe(false);
  });
});
