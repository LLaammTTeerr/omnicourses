import type { RouteRecordRaw } from 'vue-router';
import type { GroupId } from '../groups.js';
import type { Lang } from '../locale.js';
import { routes } from '../router.js';
import type { IconName } from './icons.js';

export interface MenuEntry {
  icon: IconName;
  label: Record<Lang, string>;
  tab?: Record<Lang, string>;
  group: GroupId;
  section: 'main' | 'account';
  phoneTab?: number;
  visitors?: true;
  grant?: true;
}

export interface NavItem extends MenuEntry {
  route: string;
}

function menusIn(records: readonly RouteRecordRaw[]): NavItem[] {
  return records.flatMap((record) => {
    const own = record.meta?.menu && typeof record.name === 'string' ? [{ route: record.name, ...record.meta.menu }] : [];
    return [...own, ...menusIn(record.children ?? [])];
  });
}

export const NAV: readonly NavItem[] = menusIn(routes);

export const listed = (items: readonly NavItem[], holdsGrant: boolean): readonly NavItem[] => items.filter((item) => !item.grant || holdsGrant);

export const PHONE_TABS: readonly NavItem[] = NAV.filter((item) => item.phoneTab).sort((a, b) => a.phoneTab! - b.phoneTab!);
export const PHONE_MORE: readonly NavItem[] = NAV.filter((item) => !item.phoneTab);

export const PUBLIC_NAV: readonly NavItem[] = NAV.filter((item) => item.visitors);
