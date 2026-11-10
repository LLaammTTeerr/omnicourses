import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { defineComponent, h, nextTick, reactive } from 'vue';
import ModalDialog from './ModalDialog.vue';

// A parent like PlansView's delete dialog: it owns `open`, passes `busy` while its request is out, and accepts `close`.
// With `accept: 'native'` it ignores the close of an Escape the page could prevent, so a test reaches one it cannot.
const state = reactive({ open: true, busy: false, accept: true as boolean | 'native', closes: 0 });
const Parent = defineComponent({
  setup() {
    const close = () => {
      state.closes++;
      if (state.accept === true || (state.accept === 'native' && !document.querySelector('dialog')?.open)) state.open = false;
    };
    return () =>
      h(ModalDialog, { open: state.open, busy: state.busy, busyText: 'Đang xử lý…', labelledby: 'modal-title', onClose: close }, () => [
        h('h2', { id: 'modal-title' }, 'Xóa thử?'),
        h('button', { type: 'button', onClick: () => (state.busy = true) }, 'Xóa'),
      ]);
  },
});

describe('ModalDialog in a real browser', () => {
  let host: HTMLDivElement;
  let wrapper: VueWrapper | undefined;
  /** What reached the <dialog>: `cancel:<cancelable>` and `close`. */
  let events: string[];
  let showModal: ReturnType<typeof vi.spyOn>;

  async function render(errorHandler?: (e: unknown) => void): Promise<HTMLDialogElement> {
    wrapper = mount(Parent, { attachTo: host, global: { config: { errorHandler } } });
    await expect.element(page.getByRole('dialog', { name: 'Xóa thử?' })).toBeVisible();
    const el = host.querySelector('dialog')!;
    el.addEventListener('cancel', (e) => events.push(`cancel:${e.cancelable}`));
    el.addEventListener('close', () => events.push('close'));
    return el;
  }
  const settle = () => new Promise((resolve) => setTimeout(resolve, 100));

  beforeEach(() => {
    Object.assign(state, { open: true, busy: false, accept: true, closes: 0 });
    events = [];
    showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    host = document.createElement('div');
    document.body.append(host);
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    host.remove();
    vi.restoreAllMocks();
  });

  // Chrome lets a page prevent one Escape per user activation (HTML close watchers); without `closedby="none"` the
  // next one would close the <dialog> whatever the page does.
  it('refuses Escape while busy, without closing, telling the parent or reopening, and says it is working', async () => {
    const el = await render();
    await page.getByRole('button', { name: 'Xóa' }).click();

    for (let i = 0; i < 3; i++) await userEvent.keyboard('{Escape}');
    await settle();

    expect(state.closes).toBe(0);
    expect(events).toEqual([]);
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(el.open).toBe(true);
    // Modal, not merely shown: the page behind stays inert.
    expect(el.matches(':modal')).toBe(true);
    await expect.element(page.getByRole('status')).toHaveTextContent('Đang xử lý…');
  });

  it('emits close once for an Escape the page cannot prevent, and stays closed when the parent accepts it', async () => {
    state.accept = 'native';
    const el = await render();
    // Each cancelable cancel is prevented and reported; how many the page gets depends on its activation history.
    for (let i = 0; i < 6 && !events.includes('close'); i++) {
      await userEvent.keyboard('{Escape}');
      await settle();
    }

    const prevented = events.filter((e) => e === 'cancel:true').length;
    expect(events).toEqual([...Array<string>(prevented).fill('cancel:true'), 'cancel:false', 'close']);
    // One close per Escape: the cancel that could not be prevented adds none of its own.
    expect(state.closes).toBe(prevented + 1);
    expect(state.open).toBe(false);
    expect(el.open).toBe(false);
    // No flicker: it was never shown again.
    expect(showModal).toHaveBeenCalledTimes(1);
  });

  // A browser without `closedby` still closes a busy dialog on a second Escape.
  it('shows itself again, without telling the parent, when the browser closes it while busy', async () => {
    const el = await render();
    state.busy = true;
    await nextTick();
    el.close();

    await expect.poll(() => events).toEqual(['close']);
    expect(el.open).toBe(true);
    expect(el.matches(':modal')).toBe(true);
    await settle();
    expect(state.closes).toBe(0);
  });

  it('ignores a close event queued before the parent opened it again', async () => {
    const el = await render();
    state.open = false;
    await nextTick();
    // close() queued its event as a task; the parent reopens before it runs.
    state.open = true;
    await nextTick();

    await expect.poll(() => events).toEqual(['close']);
    expect(state.closes).toBe(0);
    expect(el.open).toBe(true);
  });

  it('reports a dialog it cannot show again, and lets the parent close it', async () => {
    const errors: unknown[] = [];
    const el = await render((e) => errors.push(e));
    state.busy = true;
    await nextTick();
    const failure = new DOMException('detached', 'InvalidStateError');
    showModal.mockImplementation(() => {
      throw failure;
    });
    el.close();

    await expect.poll(() => errors).toEqual([failure]);
    expect(state.closes).toBe(1);
    expect(state.open).toBe(false);
  });
});
