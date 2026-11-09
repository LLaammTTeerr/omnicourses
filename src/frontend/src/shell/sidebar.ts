import { defineStore } from 'pinia';
import { ref } from 'vue';

// The sidebar narrows to icons (UI prototypes): the button at its foot, or the `[` key. Remembered per browser.

const SIDEBAR_STORAGE_KEY = 'omnicourse.sidebar';

function storedMini(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'mini';
  } catch {
    return false;
  }
}

export const useSidebar = defineStore('sidebar', () => {
  const mini = ref(storedMini());

  function toggle(): void {
    mini.value = !mini.value;
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, mini.value ? 'mini' : 'full');
    } catch {}
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
