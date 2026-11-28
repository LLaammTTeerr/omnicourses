// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GROUP_IDS, GROUPS, groupClass, groupGlyph, groupShort } from './groups.js';

const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

describe('requirement groups', () => {
  it('lists each group once, in the design order', () => {
    expect(GROUPS.map((g) => g.id)).toEqual([...GROUP_IDS]);
  });

  it('gives every group its own glyph, so colour is never the only cue', () => {
    expect(new Set(GROUPS.map((g) => g.glyph)).size).toBe(GROUPS.length);
  });

  it.each([
    ['core', '</>', 'Cốt lõi', 'Core'],
    ['math', '∑', 'Toán', 'Maths'],
    ['phys', 'ℏ', 'Vật lý', 'Physics'],
    ['eng', 'Aa', 'Anh văn', 'English'],
    ['pol', '§', 'Chính trị', 'Politics'],
    ['gen', '&', 'Kỹ năng', 'Skills'],
    ['elec', '★', 'Tự chọn', 'Electives'],
    ['thesis', '∎', 'Khóa luận', 'Thesis'],
  ] as const)('looks up the glyph and the short name of %s', (id, glyph, vi, en) => {
    expect(groupGlyph(id)).toBe(glyph);
    expect(groupShort(id, 'vi')).toBe(vi);
    expect(groupShort(id, 'en')).toBe(en);
  });

  it.each(GROUP_IDS)('has colour tokens for %s in the stylesheet', (id) => {
    expect(css).toContain(`--${id}: #`);
    expect(css).toContain(`.${groupClass(id)} { --c:`);
  });
});
