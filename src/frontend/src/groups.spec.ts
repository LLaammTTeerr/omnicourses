// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RequirementGroup, RequirementGroupKind } from './curriculum/api.js';
import { GROUP_IDS, GROUPS, groupClass, groupColour, groupOf, orderGroups } from './groups.js';

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

const group = (name: string, kind: RequirementGroupKind = 'compulsory'): RequirementGroup => ({
  id: name,
  name,
  kind,
  creditsTotal: null,
  creditsTotalMin: null,
  officialNotes: null,
  courses: [],
});

// The headings of the APCS 2024 and 2025 curricula, as src/backend/src/database/seeds prints them.
const APCS: [string, RequirementGroupKind, string][] = [
  ['Kiến thức Computer Science (A): bắt buộc', 'compulsory', 'core'],
  ['Kiến thức Computer Science (A): tự chọn', 'elective', 'elec'],
  ['Kiến thức Math', 'compulsory', 'math'],
  ['Kiến thức Non Computer Science', 'compulsory', 'gen'],
  ['Kiến thức Physics', 'compulsory', 'phys'],
  ['Kiến thức tốt nghiệp', 'elective', 'thesis'],
  ['Tự chọn Computer Science (C)', 'elective', 'elec'],
  ['Tự chọn Math (B)', 'elective', 'math'],
];

describe('groupColour', () => {
  it.each(APCS)('colours %j (%s) as %s', (name, kind, colour) => {
    expect(groupColour(group(name, kind))).toBe(colour);
  });

  it('falls back on the kind for a heading it does not know', () => {
    expect(groupColour(group('Nhóm khác', 'compulsory'))).toBe('core');
    expect(groupColour(group('Nhóm khác', 'elective'))).toBe('elec');
  });
});

describe('orderGroups', () => {
  it('follows the design order of colours, compulsory first, then the heading', () => {
    const ordered = orderGroups(APCS.map(([name, kind]) => group(name, kind))).map((g) => g.name);
    expect(ordered).toEqual([
      'Kiến thức Computer Science (A): bắt buộc',
      'Kiến thức Math',
      'Tự chọn Math (B)',
      'Kiến thức Physics',
      'Kiến thức Non Computer Science',
      'Kiến thức Computer Science (A): tự chọn',
      'Tự chọn Computer Science (C)',
      'Kiến thức tốt nghiệp',
    ]);
  });
});

describe('groupOf', () => {
  it('finds a group of the design by id', () => {
    expect(groupOf('math')).toBe(GROUPS[1]);
  });
});
