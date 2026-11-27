import { describe, expect, it } from 'vitest';
import { CURRICULUM_SEEDS } from '../../../backend/src/curriculum/seeds/index.js';
import type { GroupId } from '../groups.js';
import type { RequirementGroupKind } from './api.js';
import { groupColour } from './present.js';

const SEEDED_COLOURS: [string, RequirementGroupKind, GroupId][] = [
  ['Kiến thức Computer Science (A): bắt buộc', 'compulsory', 'core'],
  ['Kiến thức Computer Science (A): tự chọn', 'elective', 'elec'],
  ['Kiến thức Non Computer Science', 'compulsory', 'gen'],
  ['Kiến thức Math', 'compulsory', 'math'],
  ['Kiến thức Physics', 'compulsory', 'phys'],
  ['Tự chọn Math (B)', 'elective', 'math'],
  ['Tự chọn Computer Science (C)', 'elective', 'elec'],
  ['Kiến thức tốt nghiệp', 'elective', 'thesis'],
  ['Lý luận chính trị - Pháp luật', 'compulsory', 'pol'],
  ['Khoa học xã hội - Kinh tế - Kỹ năng', 'elective', 'elec'],
  ['Toán - Khoa học tự nhiên - Công nghệ - Môi trường: bắt buộc', 'compulsory', 'math'],
  ['Toán - Khoa học tự nhiên - Công nghệ - Môi trường: chọn 01 học phần toán học', 'elective', 'math'],
  ['Toán - Khoa học tự nhiên - Công nghệ - Môi trường: chọn học 08 tín chỉ', 'elective', 'math'],
  ['Tin học', 'compulsory', 'core'],
  ['Giáo dục thể chất', 'compulsory', 'core'],
  ['Giáo dục quốc phòng - An ninh', 'compulsory', 'core'],
  ['Kiến thức cơ sở ngành', 'compulsory', 'core'],
  ['Kiến thức bắt buộc chuyên ngành', 'elective', 'elec'],
  ['Kiến thức tự chọn chuyên ngành', 'elective', 'elec'],
  ['Kiến thức tự chọn tự do', 'elective', 'elec'],
];

const keyOf = (name: string, kind: string): string => `${kind}: ${name}`;

const seededGroups = new Map(CURRICULUM_SEEDS.flatMap((seed) => seed.groups).map((group) => [keyOf(group.name, group.kind), group]));

describe('the colour of the seeded requirement groups', () => {
  it.each(SEEDED_COLOURS)('puts %s (%s) in the %s colour', (name, kind, colour) => {
    expect(groupColour({ name, kind })).toBe(colour);
  });

  it('lists every seeded group, so a renamed or new group is looked at here', () => {
    const listed = new Set(SEEDED_COLOURS.map(([name, kind]) => keyOf(name, kind)));
    expect([...seededGroups.keys()].filter((key) => !listed.has(key))).toEqual([]);
  });

  it('lists only groups that are still seeded', () => {
    expect(SEEDED_COLOURS.map(([name, kind]) => keyOf(name, kind)).filter((key) => !seededGroups.has(key))).toEqual([]);
  });
});
