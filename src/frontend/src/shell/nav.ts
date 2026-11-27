import type { RouteRecordRaw } from 'vue-router';
import { routes } from '../router.js';
import type { MenuEntry } from '../route-meta.js';

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

export const listed = (items: readonly NavItem[], holdsGrant: boolean): readonly NavItem[] =>
  items.filter((item) => !item.grant || holdsGrant);

export const PHONE_TABS: readonly NavItem[] = NAV.filter((item) => item.phoneTab !== undefined).sort((a, b) => a.phoneTab! - b.phoneTab!);
export const PHONE_MORE: readonly NavItem[] = NAV.filter((item) => item.phoneTab === undefined);

export const PUBLIC_NAV: readonly NavItem[] = NAV.filter((item) => item.visitors);
