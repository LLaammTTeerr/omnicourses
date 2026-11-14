import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { chooseOption, optionsOf } from '../testing/select.js';
import SelectMenu from './SelectMenu.vue';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo', disabled: true },
  { value: 'c', label: 'Charlie' },
];

let wrapper: VueWrapper | undefined;
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

function render(start: string | null = 'a', attrs: Record<string, unknown> = {}) {
  const value = ref<string | null>(start);
  const changes: string[] = [];
  const Host = defineComponent(() => () =>
    h('label', [
      h('span', 'Pick one'),
      h(SelectMenu, {
        modelValue: value.value,
        options: OPTIONS,
        placeholder: 'Choose',
        'onUpdate:modelValue': (v: string | number) => {
          value.value = String(v);
          changes.push(String(v));
        },
        ...attrs,
      }),
    ]),
  );
  wrapper = mount(Host, { attachTo: document.body });
  return { w: wrapper, value, changes, trigger: () => wrapper!.get('[role="combobox"]') };
}

describe('SelectMenu', () => {
  it('shows the chosen option on a combobox and keeps its list closed', () => {
    const { trigger, w } = render('c', { 'data-test': 'pick', 'aria-invalid': true });
    expect(trigger().text()).toBe('Charlie');
    expect(trigger().attributes('aria-expanded')).toBe('false');
    expect(trigger().attributes('data-test')).toBe('pick');
    expect(trigger().attributes('aria-invalid')).toBe('true');
    expect(w.find('[role="listbox"]').isVisible()).toBe(false);
  });

  it('shows the placeholder when nothing is chosen', () => {
    const { trigger } = render(null);
    expect(trigger().text()).toBe('Choose');
  });

  it('opens on click, marks the chosen option, and picks another with a click', async () => {
    const { trigger, w, changes } = render('a');
    await trigger().trigger('click');
    expect(trigger().attributes('aria-expanded')).toBe('true');
    const options = w.findAll('[role="option"]');
    expect(options.map((o) => [o.text(), o.attributes('aria-selected')])).toEqual([
      ['Alpha', 'true'],
      ['Bravo', 'false'],
      ['Charlie', 'false'],
    ]);
    await options[2]!.trigger('click');
    expect(changes).toEqual(['c']);
    expect(trigger().attributes('aria-expanded')).toBe('false');
    expect(trigger().text()).toBe('Charlie');
  });

  it('ignores a disabled option', async () => {
    const { trigger, w, changes } = render('a');
    await trigger().trigger('click');
    await w.findAll('[role="option"]')[1]!.trigger('click');
    expect(changes).toEqual([]);
    expect(trigger().attributes('aria-expanded')).toBe('true');
  });

  it('works from the keyboard: arrows skip disabled options, Enter picks, Escape closes', async () => {
    const { trigger, changes } = render('a');
    await trigger().trigger('keydown', { key: 'ArrowDown' });
    expect(trigger().attributes('aria-expanded')).toBe('true');
    const active = () => document.getElementById(trigger().attributes('aria-activedescendant')!)?.textContent;
    expect(active()).toBe('Alpha');
    await trigger().trigger('keydown', { key: 'ArrowDown' });
    expect(active()).toBe('Charlie');
    await trigger().trigger('keydown', { key: 'Enter' });
    expect(changes).toEqual(['c']);
    await trigger().trigger('keydown', { key: 'ArrowDown' });
    await trigger().trigger('keydown', { key: 'Escape' });
    expect(trigger().attributes('aria-expanded')).toBe('false');
    expect(changes).toEqual(['c']);
  });

  it('jumps to an option by its first letter', async () => {
    const { trigger, changes } = render('a');
    await trigger().trigger('keydown', { key: 'ArrowDown' });
    await trigger().trigger('keydown', { key: 'c' });
    await trigger().trigger('keydown', { key: ' ' });
    expect(changes).toEqual(['c']);
  });

  it('closes when the pointer goes down outside it', async () => {
    const { trigger } = render('a');
    await trigger().trigger('click');
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await wrapper!.vm.$nextTick();
    expect(trigger().attributes('aria-expanded')).toBe('false');
  });

  it('is driven by the testing helpers the other screens use', async () => {
    const { w, changes } = render('a', { 'data-test': 'pick' });
    expect(optionsOf(w.get('[data-test="pick"]'))).toEqual(['Alpha', 'Bravo', 'Charlie']);
    await chooseOption(w.get('[data-test="pick"]'), 'Charlie');
    expect(changes).toEqual(['c']);
  });
});
