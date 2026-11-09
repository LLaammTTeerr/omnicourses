import { describe, expect, it } from 'vitest';
import type { RequirementGroup, RequirementGroupKind } from './api.js';
import { fold, groupColour, matches, orderGroups } from './present.js';

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

describe('fold and matches', () => {
  it('drops diacritics and case, đ included', () => {
    expect(fold('Học Máy ĐẠI CƯƠNG')).toBe('hoc may dai cuong');
  });

  it('finds a course by code or name, typed without diacritics, word by word', () => {
    expect(matches('hoc may', 'ZZ414', 'Học máy')).toBe(true);
    expect(matches('may hoc', 'ZZ414', 'Học máy')).toBe(true);
    expect(matches('zz41', 'ZZ414', 'Học máy')).toBe(true);
    expect(matches('machine', 'ZZ414', 'Học máy', 'Machine learning')).toBe(true);
    expect(matches('hoc mat', 'ZZ414', 'Học máy')).toBe(false);
    expect(matches('  ', 'ZZ414', null)).toBe(true);
  });
});

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
