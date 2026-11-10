import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { defineComponent, h, ref } from 'vue';
import ModalDialog from './ModalDialog.vue';

// A parent like PlansView's delete dialog: it owns `open` and ignores `close` while its request is out.
const Busy = defineComponent({
  setup() {
    const open = ref(true);
    const busy = ref(false);
    const closes = ref(0);
    const close = () => {
      closes.value++;
      if (!busy.value) open.value = false;
    };
    return () =>
      h(ModalDialog, { open: open.value, labelledby: 'busy-title', onClose: close }, () => [
        h('h2', { id: 'busy-title' }, 'Xóa thử?'),
        h('button', { type: 'button', onClick: () => (busy.value = true) }, 'Xóa'),
        h('p', { 'data-test': 'closes' }, String(closes.value)),
      ]);
  },
});

describe('ModalDialog in a real browser', () => {
  let host: HTMLDivElement;
  let wrapper: VueWrapper | undefined;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    host.remove();
  });

  // Chrome lets a page prevent one Escape per user activation (HTML close watchers); the next one closes the
  // <dialog> whatever the page does. The parent still says open, so the dialog has to come back.
  it('stays open on repeated Escapes while the parent keeps it open', async () => {
    wrapper = mount(Busy, { attachTo: host });
    const dialog = page.getByRole('dialog', { name: 'Xóa thử?' });
    await expect.element(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Xóa' }).click();

    for (let i = 0; i < 3; i++) await userEvent.keyboard('{Escape}');

    // The parent heard each close it was asked for, and ignored it.
    await expect.poll(() => Number(host.querySelector('[data-test="closes"]')?.textContent)).toBeGreaterThanOrEqual(2);
    await expect.poll(() => host.querySelector('dialog')!.open).toBe(true);
    await expect.element(dialog).toBeVisible();
    // Modal again, not merely shown: the page behind stays inert.
    expect(host.querySelector('dialog')!.matches(':modal')).toBe(true);
  });
});
