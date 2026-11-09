// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GROUP_IDS, GROUPS, groupClass } from './groups.js';

// Read from disk: Vitest does not load CSS, so a ?raw import comes back empty.
const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

describe('requirement groups', () => {
  it('lists each group once, in the design order', () => {
    expect(GROUPS.map((g) => g.id)).toEqual([...GROUP_IDS]);
  });

  it('gives every group its own glyph, so colour is never the only cue', () => {
    expect(new Set(GROUPS.map((g) => g.glyph)).size).toBe(GROUPS.length);
  });

  it.each(GROUP_IDS)('has colour tokens for %s in the stylesheet', (id) => {
    expect(css).toContain(`--${id}: #`);
    expect(css).toContain(`.${groupClass(id)} { --c:`);
  });
});
