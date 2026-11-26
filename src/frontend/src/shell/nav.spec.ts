import { describe, expect, it } from 'vitest';
import { createMemoryHistory } from 'vue-router';
import { createAppRouter } from '../router.js';
import { listed, NAV, PHONE_MORE, PHONE_TABS, PUBLIC_NAV } from './nav.js';

const router = createAppRouter(createMemoryHistory());
const record = (name: string) => router.getRoutes().find((route) => route.name === name);

describe('navigation', () => {
  it.each(NAV.map((item) => [item.route, item]))('links %s to a page a signed-in student can open', (_name, item) => {
    const route = record(item.route);
    expect(route, `no route named ${item.route}`).toBeDefined();
    expect(route!.meta.auth).not.toBe('guest');
    expect(item.label.vi && item.label.en).toBeTruthy();
  });

  it('lists the pages in route order, and the phone tabs in their own order', () => {
    expect(NAV.map((item) => item.route)).toEqual(['dashboard', 'calendar', 'audit', 'transcript', 'explorer', 'plans', 'guides', 'settings', 'admin']);
    expect(PHONE_TABS.map((item) => item.route)).toEqual(['dashboard', 'plans', 'audit', 'explorer']);
    expect(PUBLIC_NAV.map((item) => item.route)).toEqual(['guides']);
  });

  it('gives each page its section and icon', () => {
    expect(NAV.map(({ route, section, icon }) => ({ route, section, icon }))).toEqual([
      { route: 'dashboard', section: 'main', icon: 'home' },
      { route: 'calendar', section: 'main', icon: 'calendar' },
      { route: 'audit', section: 'main', icon: 'audit' },
      { route: 'transcript', section: 'main', icon: 'file' },
      { route: 'explorer', section: 'main', icon: 'graph' },
      { route: 'plans', section: 'main', icon: 'columns' },
      { route: 'guides', section: 'main', icon: 'book' },
      { route: 'settings', section: 'account', icon: 'sliders' },
      { route: 'admin', section: 'account', icon: 'db' },
    ]);
  });

  it('lists each page once', () => {
    expect(new Set(NAV.map((item) => item.route)).size).toBe(NAV.length);
  });

  it('puts every page on the phone once: four tabs, the rest under More', () => {
    expect(PHONE_TABS).toHaveLength(4);
    const phone = [...PHONE_TABS, ...PHONE_MORE];
    expect(phone.every(Boolean)).toBe(true);
    expect(phone.map((item) => item.route).sort()).toEqual(NAV.map((item) => item.route).sort());
  });

  it('lists Administration only for a user who holds a grant (ADR 0011)', () => {
    expect(NAV.filter((item) => item.grant).map((item) => item.route)).toEqual(['admin']);
    expect(listed(NAV, false).map((item) => item.route)).not.toContain('admin');
    expect(listed(NAV, true).map((item) => item.route)).toEqual(NAV.map((item) => item.route));
    expect(listed(PHONE_MORE, false).map((item) => item.route)).toEqual(['calendar', 'transcript', 'guides', 'settings']);
    expect(listed(PHONE_MORE, true).at(-1)!.route).toBe('admin');
    expect(record('admin')!.meta.auth).toBe('required');
  });

  it('shows visitors only pages they can read signed out', () => {
    for (const item of PUBLIC_NAV) expect(record(item.route)!.meta.auth).toBeUndefined();
  });
});
