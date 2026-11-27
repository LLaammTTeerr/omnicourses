import { describe, expect, it } from 'vitest';
import { clc2025AtttGroups } from './clc-2025-attt.groups.js';
import { clc2025CntthucGroups } from './clc-2025-cntthuc.groups.js';
import { clc2025CnttinGroups } from './clc-2025-cnttin.groups.js';
import { clc2025HtttGroups } from './clc-2025-httt.groups.js';
import { clc2025KhdlGroups } from './clc-2025-khdl.groups.js';
import { clc2025KhmtGroups } from './clc-2025-khmt.groups.js';
import { clc2025KtpmGroups } from './clc-2025-ktpm.groups.js';
import { clc2025MmtGroups } from './clc-2025-mmt.groups.js';
import { clc2025TgmtGroups } from './clc-2025-tgmt.groups.js';
import { CLC_2025_COMMON_GROUPS, CLC_2025_COURSES, type ClcMember, type ClcOwnGroups } from './clc-2025-courses.js';
import { CLC_2025_SEEDS } from './clc-2025.js';

const COURSE_COUNT = 187;
const ROWS_PER_SPECIALISATION = 187;
const CREDITS_PER_SPECIALISATION = 726;

type Tally = [rows: number, credits: number];

const SPECIALISATIONS: { key: string; groups: ClcOwnGroups; bbcn: Tally; tccn: Tally; free: Tally; tn: Tally }[] = [
  { key: 'MMT', groups: clc2025MmtGroups, bbcn: [8, 32], tccn: [9, 36], free: [118, 478], tn: [7, 42] },
  { key: 'HTTT', groups: clc2025HtttGroups, bbcn: [5, 20], tccn: [16, 60], free: [115, 470], tn: [6, 38] },
  { key: 'KTPM', groups: clc2025KtpmGroups, bbcn: [9, 36], tccn: [16, 60], free: [110, 450], tn: [7, 42] },
  { key: 'KHMT', groups: clc2025KhmtGroups, bbcn: [15, 60], tccn: [17, 65], free: [102, 417], tn: [8, 46] },
  { key: 'CNTTHUC', groups: clc2025CntthucGroups, bbcn: [12, 48], tccn: [16, 60], free: [106, 430], tn: [8, 50] },
  { key: 'TGMT', groups: clc2025TgmtGroups, bbcn: [5, 20], tccn: [9, 36], free: [122, 494], tn: [6, 38] },
  { key: 'ATTT', groups: clc2025AtttGroups, bbcn: [6, 24], tccn: [12, 48], free: [119, 480], tn: [5, 36] },
  { key: 'KHDL', groups: clc2025KhdlGroups, bbcn: [6, 24], tccn: [12, 48], free: [118, 478], tn: [6, 38] },
  { key: 'CNTTIN', groups: clc2025CnttinGroups, bbcn: [17, 68], tccn: [28, 112], free: [68, 268], tn: [29, 140] },
];

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const creditsOf = (members: ClcMember[]) => sum(members.map(([code]) => CLC_2025_COURSES[code].credits));
const membersOf = (groups: ClcOwnGroups): ClcMember[] => [...Object.values(CLC_2025_COMMON_GROUPS), ...Object.values(groups)].flat();

describe('CLC 2025 course table', () => {
  it('holds each course once', () => {
    expect(Object.keys(CLC_2025_COURSES)).toHaveLength(COURSE_COUNT);
  });
});

describe.each(SPECIALISATIONS)('CLC 2025 $key group membership', ({ key, groups, ...tallies }) => {
  const members = membersOf(groups);

  it('lists only courses that exist in the course table', () => {
    for (const [code] of members) expect(CLC_2025_COURSES[code], code).toBeDefined();
  });

  it('lists no course twice', () => {
    const codes = members.map(([code]) => code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("keeps today's row count and credit total", () => {
    expect(members).toHaveLength(ROWS_PER_SPECIALISATION);
    expect(creditsOf(members)).toBe(CREDITS_PER_SPECIALISATION);
  });

  it("keeps today's size and credit total of each specialisation group", () => {
    for (const group of ['bbcn', 'tccn', 'free', 'tn'] as const) {
      expect([groups[group].length, creditsOf(groups[group])], group).toEqual(tallies[group]);
    }
  });

  it('builds a seed with the same rows', () => {
    const seed = CLC_2025_SEEDS.find((each) => each.program.code === `CNTT-TCTA-${key}`);
    expect(seed?.groups.flatMap((group) => group.rows.map((row) => row.code)).sort()).toEqual(members.map(([code]) => code).sort());
  });
});
