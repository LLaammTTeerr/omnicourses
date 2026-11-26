import { defineStore } from 'pinia';
import { ref } from 'vue';

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

export function isSidebarKey(event: KeyboardEvent): boolean {
  if (event.key !== '[' || event.ctrlKey || event.metaKey || event.altKey) return false;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return true;
  return !(target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}
