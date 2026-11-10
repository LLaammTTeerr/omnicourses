import type { GroupId } from '../groups.js';
import type { Lang } from '../locale.js';
import type { IconName } from './icons.js';

// The pages the sidebar and the phone tab bar list, in order. A screen joins this list once its API exists and
// the screen works end to end; nothing here may lead to a mock-up or invented data.

export interface NavItem {
  /** A route name in router.ts (nav.spec.ts checks it). */
  route: string;
  icon: IconName;
  label: Record<Lang, string>;
  /** Colours the icon of the current page. */
  group: GroupId;
  /** `main` under the brand, `account` under the "Account" label. */
  section: 'main' | 'account';
}

export const NAV: readonly NavItem[] = [
  { route: 'transcript', icon: 'file', label: { vi: 'Bảng điểm', en: 'Transcript' }, group: 'gen', section: 'main' },
  { route: 'explorer', icon: 'graph', label: { vi: 'Chương trình', en: 'Curriculum' }, group: 'phys', section: 'main' },
  { route: 'plans', icon: 'columns', label: { vi: 'Lộ trình', en: 'Plans' }, group: 'elec', section: 'main' },
  { route: 'guides', icon: 'book', label: { vi: 'Hướng dẫn', en: 'Guides' }, group: 'math', section: 'main' },
  { route: 'settings', icon: 'sliders', label: { vi: 'Cài đặt', en: 'Settings' }, group: 'thesis', section: 'account' },
];

/** The pages a visitor who is not signed in can open from the public header. */
export const PUBLIC_NAV: readonly NavItem[] = NAV.filter((item) => item.route === 'guides');
