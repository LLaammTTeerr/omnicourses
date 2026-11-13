import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLocale } from '../locale.js';
import LoadState from './LoadState.vue';

const props = { failed: 'Could not load.', retry: 'Try again' };

describe('LoadState', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('says it is loading, when given the words', () => {
    expect(mount(LoadState, { props: { ...props, status: 'loading', loading: 'Loading…' } }).html()).toBe('<p class="t3">Loading…</p>');
    expect(mount(LoadState, { props: { ...props, status: 'loading' } }).text()).toBe('');
  });

  it('draws nothing once loaded', () => {
    expect(mount(LoadState, { props: { ...props, status: 'loaded', loading: 'Loading…' } }).text()).toBe('');
  });

  it('says a failure as an alert with a retry, and puts attributes on it', async () => {
    const wrapper = mount(LoadState, { props: { ...props, status: 'failed', tone: 'warn', small: true }, attrs: { 'data-test': 'failed' } });
    const callout = wrapper.get('[data-test="failed"]');
    expect(callout.classes()).toEqual(['callout', 'warn', 'small']);
    expect(callout.attributes('role')).toBe('alert');
    expect(callout.get('.icon').classes()).toContain('sm');
    expect(callout.get('p').text()).toBe('Could not load.');
    await callout.get('button').trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
  });

  it('lets the screen word a failure its own way, or add an action after the retry', () => {
    const own = mount(LoadState, { props: { ...props, status: 'failed' }, slots: { default: '<div><p>Not found.</p></div>' } });
    expect(own.text()).toBe('Not found.');
    expect(own.find('button').exists()).toBe(false);
    const more = mount(LoadState, { props: { ...props, status: 'failed' }, slots: { actions: '<a>Back</a>' } });
    expect(more.get('.callout > div').element.lastElementChild!.tagName).toBe('A');
  });

  it('says "try again" in the language on screen unless the screen words its retry', () => {
    useLocale().set('en');
    expect(mount(LoadState, { props: { status: 'failed', failed: 'Could not load.' } }).get('button').text()).toBe('Try again');
    useLocale().set('vi');
    expect(mount(LoadState, { props: { status: 'failed', failed: 'Không tải được.' } }).get('button').text()).toBe('Thử lại');
  });
});
