import type { Lang } from './locale.js';

// Words every screen says the same way. A screen that words one of these differently (a longer "loading", a
// specific "save") keeps its own in its messages file.
export const COMMON_MESSAGES = {
  vi: { retry: 'Thử lại', loading: 'Đang tải…', cancel: 'Hủy', close: 'Đóng', working: 'Đang xử lý…' },
  en: { retry: 'Try again', loading: 'Loading…', cancel: 'Cancel', close: 'Close', working: 'Working…' },
} satisfies Record<Lang, Record<string, string>>;
