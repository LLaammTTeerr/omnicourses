import { describe, expect, it } from 'vitest';
import { PLANNER_MESSAGES } from '../plans/messages.js';
import type { Term } from '../terms.js';
import { SHARING_MESSAGES } from './messages.js';
import type { SharedCurriculum, SharedPlan, SharedPlanCoverage, SharedPlanIssue } from './api.js';
import { buildRowViews, curriculumMeta, issueLists, orderedGroups, shortCount, withheldTitles, wordIssue } from './view.js';

const planner = PLANNER_MESSAGES.en;
const sharing = SHARING_MESSAGES.en;
const TERM: Term = { year: 2026, number: 1 };

function sharedIssue(overrides: Partial<SharedPlanIssue>): SharedPlanIssue {
  return {
    code: 'not_offered',
    kind: 'violation',
    term: TERM,
    position: null,
    courseCode: null,
    offeredTermNumbers: [],
    credits: null,
    limit: null,
    citation: 'Điều 10.1',
    message: 'm',
    ...overrides,
  };
}

function sharedPlan(overrides: Partial<SharedPlan> = {}): SharedPlan {
  return {
    name: 'Plan',
    ownerName: null,
    curriculum: curriculum(),
    updatedAt: '2026-11-25T14:20:00.000Z',
    terms: [
      {
        term: TERM,
        kind: 'main',
        credits: 8,
        caps: { min: 10, max: 22 },
        placements: [
          { kind: 'course', courseCode: 'ZZ101', nameVi: 'Môn một', nameEn: 'Course one', credits: 4, requirementGroupName: null },
          { kind: 'slot', courseCode: null, nameVi: null, nameEn: null, credits: 4, requirementGroupName: 'Tự chọn Computer Science (C)' },
        ],
      },
      { term: { year: 2026, number: 2 }, kind: 'summer', credits: 0, caps: null, placements: [] },
    ],
    issues: [],
    issueCodesNotShown: [],
    ...overrides,
  };
}

function curriculum(overrides: Partial<SharedCurriculum> = {}): SharedCurriculum {
  return {
    code: 'ZZ2024',
    cohortYear: 2024,
    nameVi: 'Cử nhân thử nghiệm',
    nameEn: 'Test bachelor',
    program: { code: 'ZZP', nameVi: 'Chương trình thử', nameEn: 'Test program' },
    ...overrides,
  };
}

describe('buildRowViews', () => {
  it('reads the cap from the engine issues of the term and the load from the term entry', () => {
    const plan = sharedPlan({ issues: [sharedIssue({ code: 'load_below_minimum', kind: 'flag', credits: 8, limit: 10 })] });
    const [row, summer] = buildRowViews(plan, 'en', planner);
    expect(row).toMatchObject({ key: '2026-1', credits: 8, maxCap: 22, summer: false, cap: 'under', tone: 'has-flag', atLeast: false });
    expect(row!.capsLabel).toBe(planner.caps(10, 22));
    expect(row!.meter).not.toBeNull();
    expect(summer).toMatchObject({ summer: true, maxCap: null, cap: '', meter: null, tone: '', capsLabel: planner.capsUnknown });
  });

  it('keeps whole-term issues on the row and position issues on their tile', () => {
    const plan = sharedPlan({
      issues: [
        sharedIssue({ code: 'load_not_checked', kind: 'flag' }),
        sharedIssue({ position: 0, courseCode: 'ZZ101' }),
        sharedIssue({ code: 'placed_twice', kind: 'flag', position: 1 }),
        sharedIssue({ term: { year: 2030, number: 1 } }),
      ],
    });
    const [row] = buildRowViews(plan, 'en', planner);
    expect(row!.atLeast).toBe(true);
    expect(row!.rowIssues.map((i) => i.code)).toEqual(['load_not_checked']);
    expect(row!.tiles.map((t) => t.issues.map((i) => i.code))).toEqual([['not_offered'], ['placed_twice']]);
    expect(row!.tone).toBe('has-violation');
  });

  it('lists violations before flags on a tile and sets unknowns aside', () => {
    const plan = sharedPlan({
      issues: [
        sharedIssue({ code: 'placed_twice', kind: 'flag', position: 0 }),
        sharedIssue({ code: 'prerequisites_not_recorded', kind: 'unknown', position: 0 }),
        sharedIssue({ code: 'not_offered', kind: 'violation', position: 0 }),
      ],
    });
    const tile = buildRowViews(plan, 'en', planner)[0]!.tiles[0]!;
    expect(tile.issues.map((i) => i.kind)).toEqual(['violation', 'flag']);
    expect(tile.unknowns.map((i) => i.code)).toEqual(['prerequisites_not_recorded']);
    expect(tile).toMatchObject({ tone: 'has-violation', bad: true });
  });

  it('does not colour a tile for an unknown alone', () => {
    const plan = sharedPlan({ issues: [sharedIssue({ code: 'prerequisites_not_recorded', kind: 'unknown', position: 0 })] });
    expect(buildRowViews(plan, 'en', planner)[0]!.tiles[0]).toMatchObject({ tone: '', bad: false });
  });

  it('titles a course by its code and a slot by its group, in the reader language', () => {
    const [course, slot] = buildRowViews(sharedPlan(), 'en', planner)[0]!.tiles;
    expect(course).toMatchObject({ title: 'ZZ101', name: 'Course one', slot: false, colour: null, credits: 4 });
    expect(slot).toMatchObject({ title: planner.slot('Tự chọn Computer Science (C)'), name: null, slot: true });
    expect(slot!.colour).not.toBeNull();
    expect(buildRowViews(sharedPlan(), 'vi', planner)[0]!.tiles[0]!.name).toBe('Môn một');
  });

  it('titles a slot with no group name as unknown', () => {
    const plan = sharedPlan();
    plan.terms[0]!.placements = [{ kind: 'slot', courseCode: null, nameVi: null, nameEn: null, credits: null, requirementGroupName: null }];
    expect(buildRowViews(plan, 'en', planner)[0]!.tiles[0]).toMatchObject({ title: planner.slot(planner.slotGroupUnknown), colour: null });
  });
});

describe('wordIssue', () => {
  const coverageIssue = (overrides: Partial<SharedPlanIssue>) => sharedIssue({ code: 'requirement_not_covered', kind: 'flag', term: null, credits: 3, limit: 9, ...overrides });

  it('names the requirement group the issue carries', () => {
    expect(wordIssue(planner, coverageIssue({ requirementGroupName: 'Core' }))).toContain('Core still short');
  });

  it('falls back to the combined minimum, then to the whole plan', () => {
    expect(wordIssue(planner, coverageIssue({ combinedMinimumName: 'Electives together' }))).toContain('Electives together still short');
    expect(wordIssue(planner, coverageIssue({}))).toContain('Total credits still short');
  });

  it('reads missing courses as none when the share omits them', () => {
    expect(wordIssue(planner, sharedIssue({ code: 'prerequisite_not_met', courseCode: 'ZZ101' }))).toBe(planner.issue.prerequisite_not_met({ ...sharedIssue({ courseCode: 'ZZ101' }), missingCourseCodes: [] }, { requirementName: () => null }));
    expect(wordIssue(planner, sharedIssue({ code: 'prerequisite_not_met', courseCode: 'ZZ101', missingCourseCodes: ['ZZ100'] }))).toContain('ZZ100');
  });
});

describe('curriculumMeta', () => {
  it('joins program, cohort, code and the curriculum name', () => {
    expect(curriculumMeta(curriculum(), 'en', sharing)).toBe(['Test program (ZZP)', sharing.cohort(2024), sharing.curriculumCode('ZZ2024'), 'Test bachelor'].join(' · '));
  });

  it('leaves out a curriculum name that repeats the program or the code', () => {
    const repeating = curriculum({ nameEn: 'ZZ2024 test program edition' });
    expect(curriculumMeta(repeating, 'en', sharing)).toBe(['Test program (ZZP)', sharing.cohort(2024), sharing.curriculumCode('ZZ2024')].join(' · '));
  });
});

describe('withheldTitles', () => {
  it('names each withheld check by its issue title', () => {
    expect(withheldTitles(sharedPlan({ issueCodesNotShown: ['not_offered', 'placed_twice'] }), planner)).toEqual([planner.issueTitle.not_offered, planner.issueTitle.placed_twice]);
  });
});

describe('issueLists', () => {
  it('counts only issues placed in a term and lists violations before flags', () => {
    const lists = issueLists([
      sharedIssue({ code: 'placed_twice', kind: 'flag' }),
      sharedIssue({ code: 'not_offered' }),
      sharedIssue({ code: 'prerequisites_not_recorded', kind: 'unknown' }),
      sharedIssue({ code: 'requirement_not_covered', kind: 'flag', term: null }),
    ]);
    expect(lists.listed.map((i) => i.code)).toEqual(['not_offered', 'placed_twice']);
    expect(lists.violationCount).toBe(1);
    expect(lists.byKind.unknown).toHaveLength(1);
  });
});

describe('coverage helpers', () => {
  const coverage: SharedPlanCoverage = {
    groups: [
      { name: 'Tự chọn Computer Science (C)', kind: 'elective', requiredCredits: 9, credits: 3, remainingCredits: 6, met: false },
      { name: 'Giáo dục đại cương', kind: 'compulsory', requiredCredits: 10, credits: 10, remainingCredits: 0, met: true },
    ],
    combinedMinimums: [{ name: 'Together', creditsMin: 5, credits: 1, remainingCredits: 4, met: false }],
    totalRequired: 19,
    totalCredits: 14,
    totalRemaining: 5,
    graduation: 'not_yet',
  };

  it('counts the groups and combined minimums not yet met', () => {
    expect(shortCount(coverage)).toBe(2);
    expect(shortCount({ ...coverage, groups: [coverage.groups[1]!], combinedMinimums: [] })).toBe(0);
  });

  it('orders groups as the curriculum pages do', () => {
    expect(orderedGroups(coverage).map((g) => g.name)).toEqual(['Giáo dục đại cương', 'Tự chọn Computer Science (C)']);
  });
});
