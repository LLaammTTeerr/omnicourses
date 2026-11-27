import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLocale } from '../locale.js';
import { SHELL_MESSAGES } from '../shell/messages.js';
import ModalDialog from './ModalDialog.vue';

const status = (props: Record<string, unknown>) => {
  const pinia = createPinia();
  setActivePinia(pinia);
  const w = mount(ModalDialog, { props: { open: true, labelledby: 'zz-title', ...props }, global: { plugins: [pinia] } });
  return w.find('[role="status"]');
};

describe('ModalDialog busy text', () => {
  beforeEach(() => localStorage.clear());

  it('says the shell working text while busy, in the screen language', () => {
    expect(status({ busy: true }).text()).toBe(SHELL_MESSAGES.vi.working);
    useLocale().set('en');
    expect(status({ busy: true }).text()).toBe(SHELL_MESSAGES.en.working);
  });

  it('keeps the status line empty and hidden from sight while idle', () => {
    const line = status({ busy: false });
    expect(line.text()).toBe('');
    expect(line.classes()).toContain('sr-only');
  });

  it('says the text it is given instead of the default', () => {
    expect(status({ busy: true, busyText: 'zz-custom' }).text()).toBe('zz-custom');
  });

  it('has no status line for a dialog that is never busy', () => {
    expect(status({}).exists()).toBe(false);
  });
});
