import { describe, expect, it } from 'vitest';
import { createMemoryHistory } from 'vue-router';
import { createAppRouter } from '../router.js';
import { NAV, PUBLIC_NAV } from './nav.js';

const router = createAppRouter(createMemoryHistory());
const record = (name: string) => router.getRoutes().find((route) => route.name === name);

describe('navigation', () => {
  it.each(NAV.map((item) => [item.route, item]))('links %s to a page a signed-in student can open', (_name, item) => {
    const route = record(item.route);
    expect(route, `no route named ${item.route}`).toBeDefined();
    expect(route!.meta.auth).not.toBe('guest');
    expect(item.label.vi && item.label.en).toBeTruthy();
  });

  it('lists each page once', () => {
    expect(new Set(NAV.map((item) => item.route)).size).toBe(NAV.length);
  });

  it('shows visitors only pages they can read signed out', () => {
    for (const item of PUBLIC_NAV) expect(record(item.route)!.meta.auth).toBeUndefined();
  });
});
