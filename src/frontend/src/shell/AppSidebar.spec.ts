import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { setup } from '../testing/signed-in.js';
import AppSidebar from './AppSidebar.vue';
import PublicHeader from './PublicHeader.vue';
import PublicHeaderRaw from './PublicHeader.vue?raw';
import { SHELL_MESSAGES } from './messages.js';
import { useSidebar } from './sidebar.js';
import { useTheme } from './theme.js';

let wrapper: VueWrapper | undefined;

describe('AppSidebar accessibility', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('keeps collapse aria-label and title consistent, and adds titles to theme and language buttons when mini', async () => {
    const { pinia, router } = await setup('/dashboard');
    useTheme(pinia).set('light');
    wrapper = mount(AppSidebar, { global: { plugins: [pinia, router] }, attachTo: document.body });
    await flushPromises();

    const collapse = () => wrapper!.get('button.side-toggle[aria-pressed]');
    const themeBtn = () => wrapper!.get('.theme-btn');
    const langBtn = () => wrapper!.get('.lang-btn');

    expect(useSidebar().mini).toBe(false);
    expect(collapse().attributes('aria-label')).toBe('Thu gọn');
    expect(collapse().attributes('title')).toBeUndefined();
    expect(themeBtn().attributes('title')).toBeUndefined();
    expect(langBtn().attributes('title')).toBeUndefined();

    await collapse().trigger('click');
    await nextTick();

    expect(useSidebar().mini).toBe(true);
    expect(collapse().attributes('aria-label')).toBe('Thu gọn');
    expect(collapse().attributes('title')).toBe('Mở rộng');
    expect(themeBtn().attributes('title')).toBe(SHELL_MESSAGES.vi.toDark);
    expect(langBtn().attributes('title')).toBe('English');
  });
});

describe('PublicHeader on mobile', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('renders both Sign in and Create account for signed-out visitors without hiding .sign-in on mobile', async () => {
    const { pinia, router } = await setup('/', { signedIn: false });
    wrapper = mount(PublicHeader, { global: { plugins: [pinia, router] } });
    await flushPromises();

    expect(wrapper.get('a.sign-in').attributes('href')).toBe('/sign-in');
    expect(PublicHeaderRaw).not.toMatch(/\.sign-in\s*\{\s*display:\s*none/);
  });
});
