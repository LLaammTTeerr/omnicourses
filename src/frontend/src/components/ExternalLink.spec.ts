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

  it('allows http:// as well as https://', () => {
    const a = mount(ExternalLink, { props: { href: 'HTTP://example.com/docs' }, slots: { default: 'Docs' } }).get('a');
    expect(a.attributes('href')).toBe('HTTP://example.com/docs');
  });

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'ftp://example.com/file',
    '//evil.example.com/phish',
    '/\t/evil.example.com/phish',
    '/ /evil.example.com/phish',
    'https://example.com/bad\nline',
    '',
  ])('renders a disabled span without an unsafe href for %j', (href) => {
    const w = mount(ExternalLink, { props: { href }, slots: { default: 'Portal' } });
    expect(w.find('a').exists()).toBe(false);
    const span = w.get('span.link');
    expect(span.attributes('aria-disabled')).toBe('true');
    expect(span.attributes('href')).toBeUndefined();
    expect(span.text()).toBe('Portal');
  });
});
