import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { useLocale } from '../locale.js';
import ExternalLink from './ExternalLink.vue';

describe('ExternalLink', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('opens in a new tab without giving the site a handle on OmniCourse', () => {
    const a = mount(ExternalLink, { props: { href: 'https://example.com/portal' }, slots: { default: 'Portal' } }).get('a');
    expect(a.attributes('href')).toBe('https://example.com/portal');
    expect(a.attributes('target')).toBe('_blank');
    expect(a.attributes('rel')?.split(' ').sort()).toEqual(['noopener', 'noreferrer']);
  });

  it('tells a screen reader it opens a new tab, in the screen language', async () => {
    const w = mount(ExternalLink, { props: { href: 'https://example.com' }, slots: { default: 'Portal' } });
    expect(w.text()).toBe('Portal (mở ở tab mới)');
    useLocale().set('en');
    await nextTick();
    expect(w.text()).toBe('Portal (opens in a new tab)');
  });
});
