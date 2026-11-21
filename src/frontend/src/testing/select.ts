import type { DOMWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';

type Trigger = Pick<DOMWrapper<Element>, 'attributes' | 'trigger' | 'element'>;

// Drives SelectMenu (components/SelectMenu.vue) the way a student does: open the list, click an option.

const listOf = (trigger: Trigger) => {
  const list = trigger.element.closest('.ui-select')?.querySelector('[role="listbox"]');
  if (!list) throw new Error('No list next to this select: is it a SelectMenu?');
  return list;
};

export function optionsOf(trigger: Trigger): string[] {
  return [...listOf(trigger).querySelectorAll('[role="option"]')].map((o) => o.textContent?.trim() ?? '');
}

export async function chooseOption(trigger: Trigger, label: string): Promise<void> {
  if (trigger.attributes('aria-expanded') !== 'true') await trigger.trigger('click');
  const option = [...listOf(trigger).querySelectorAll<HTMLElement>('[role="option"]')].find((o) => o.textContent?.trim() === label);
  if (!option) throw new Error(`No option "${label}"; options: ${optionsOf(trigger).join(', ')}`);
  option.click();
  await nextTick();
}
