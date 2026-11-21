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
  /** A shorter label for the phone tab bar, when `label` does not fit there. */
  tab?: Record<Lang, string>;
  /** Colours the icon of the current page. */
  group: GroupId;
  /** `main` under the brand, `account` under the "Account" label. */
  section: 'main' | 'account';
}

export const NAV: readonly NavItem[] = [
  { route: 'dashboard', icon: 'home', label: { vi: 'Tổng quan', en: 'Dashboard' }, group: 'core', section: 'main' },
  { route: 'calendar', icon: 'calendar', label: { vi: 'Lịch', en: 'Calendar' }, group: 'pol', section: 'main' },
  { route: 'audit', icon: 'audit', label: { vi: 'Xét tốt nghiệp', en: 'Degree audit' }, tab: { vi: 'Tốt nghiệp', en: 'Audit' }, group: 'gen', section: 'main' },
  { route: 'transcript', icon: 'file', label: { vi: 'Bảng điểm', en: 'Transcript' }, group: 'gen', section: 'main' },
  { route: 'explorer', icon: 'graph', label: { vi: 'Chương trình', en: 'Curriculum' }, group: 'phys', section: 'main' },
  { route: 'plans', icon: 'columns', label: { vi: 'Lộ trình', en: 'Plans' }, group: 'elec', section: 'main' },
  { route: 'guides', icon: 'book', label: { vi: 'Hướng dẫn', en: 'Guides' }, group: 'math', section: 'main' },
  { route: 'settings', icon: 'sliders', label: { vi: 'Cài đặt', en: 'Settings' }, group: 'thesis', section: 'account' },
];

const pick = (...routes: string[]): readonly NavItem[] => routes.map((route) => NAV.find((item) => item.route === route)!);

/**
 * The phone tab bar: four tabs, then "More" for the rest, since all seven do not fit at 400 px in English. The bar
 * takes the UI prototypes' look (ui-prototypes/assets/shell.js), not their list of tabs. Every NAV item is in one of
 * the two lists (nav.spec.ts); the desktop sidebar lists them all.
 */
export const PHONE_TABS: readonly NavItem[] = pick('dashboard', 'plans', 'audit', 'explorer');
export const PHONE_MORE: readonly NavItem[] = pick('calendar', 'transcript', 'guides', 'settings');

/** The pages a visitor who is not signed in can open from the public header. */
export const PUBLIC_NAV: readonly NavItem[] = NAV.filter((item) => item.route === 'guides');
