import { defineStore } from 'pinia';
import { ref } from 'vue';
import { readStored, writeStored } from '../storage.js';

// The sidebar narrows to icons (UI prototypes): the button at its foot, or the `[` key. Remembered per browser.

const SIDEBAR_STORAGE_KEY = 'omnicourse.sidebar';

export const useSidebar = defineStore('sidebar', () => {
  const mini = ref(readStored(SIDEBAR_STORAGE_KEY) === 'mini');

  function toggle(): void {
    mini.value = !mini.value;
    writeStored(SIDEBAR_STORAGE_KEY, mini.value ? 'mini' : 'full');
  }

  return { mini, toggle };
});

/** True when `[` should toggle the sidebar: no modifier, and the student is not typing. */
export function isSidebarKey(event: KeyboardEvent): boolean {
  if (event.key !== '[' || event.ctrlKey || event.metaKey || event.altKey) return false;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return true;
  return !(target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}
