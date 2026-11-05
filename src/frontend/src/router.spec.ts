import { describe, expect, it } from 'vitest';
import type { RouteLocationNormalized } from 'vue-router';
import { scrollBehavior } from './router.js';

const route = (hash = '') => ({ path: '/guides', hash }) as RouteLocationNormalized;

describe('scrollBehavior', () => {
  it('opens a new page at the top', () => {
    expect(scrollBehavior(route(), route(), null)).toEqual({ top: 0 });
  });

  it('goes back to where the reader was on Back', () => {
    expect(scrollBehavior(route(), route(), { left: 0, top: 640 })).toEqual({ left: 0, top: 640 });
  });

  it('moves to the main content from the skip link', () => {
    expect(scrollBehavior(route('#main'), route(), null)).toEqual({ el: '#main' });
  });
});
