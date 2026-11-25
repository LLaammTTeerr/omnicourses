import { describe, expect, it } from 'vitest';
import type { CourseSummary, CurriculumLabels } from '../curriculum/curriculum.service.js';
import type { BoardTerm, Placement } from '../plans/plan-board.js';
import { PLAN_ISSUE_CODES, type PlanIssue, type PlanIssuesReport } from '../plans/plan-issues.js';
import type { PlanDto } from '../plans/plans.dto.js';
import { checkPlan } from '../rules/plan-issues.js';
import { graded, term, ungraded, zzCurriculum } from '../rules/testing/fixtures.js';
import type { Term } from '../terms/term.js';
import type { TranscriptEntry } from '../transcript/transcript-entry.js';
import { SHARED_ISSUE_CODES, sharedPlan, TRANSCRIPT_ISSUE_CODES, WITHHELD_ISSUE_CODES } from './shared-plan.js';

// Synthetic curriculum, plan and transcripts only (AGENTS.md hard rule 3). The report comes from
// the real rule engine (checkPlan), so these tests see what a reader would get, not a hand-made report.

const course = (courseCode: string): Placement => ({ kind: 'course', courseCode, requirementGroupId: null, credits: null });
const slot = (requirementGroupId: string, credits: number): Placement => ({ kind: 'slot', courseCode: null, requirementGroupId, credits });
const at = (t: Term, ...placements: Placement[]): BoardTerm => ({ term: t, placements });

const rules = zzCurriculum();
const ALL_CODES = rules.groups.flatMap((g) => g.courses.map((c) => c.code));
// ZZB1 needs ZZA1; ZZC1 is taught in term 1 only; ZZT1 has nothing recorded.
const recorded = ALL_CODES.filter((c) => c !== 'ZZT1');
const courseRules = {
  prerequisites: new Map(recorded.map((c) => [c, c === 'ZZB1' ? ['ZZA1'] : []])),
  offeringTerms: new Map(recorded.map((c) => [c, c === 'ZZC1' ? [1] : [1, 2, 3]])),
};

// 2025-1: 4 credits, below the minimum of 10; ZZB1's prerequisite ZZA1 is not placed. 2025-2: a
// course taught in term 1 only, one outside the curriculum and gone from the catalog, one with
// nothing recorded, and a slot.
const BOARD = [at(term(2025, 1), course('ZZB1')), at(term(2025, 2), course('ZZC1'), course('ZZGONE'), course('ZZT1'), course('ZZA2'), slot('c', 3))];

const plan: PlanDto = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Main plan',
  curriculum: { id: '22222222-2222-4222-8222-222222222222', code: 'ZZPROG2024', programCode: 'ZZPROG', cohortYear: 2024 },
  createdAt: new Date('2030-01-01T00:00:00Z'),
  updatedAt: new Date('2030-02-03T04:05:06Z'),
  terms: BOARD,
};

const labels: CurriculumLabels = {
  code: 'ZZPROG2024',
  cohortYear: 2024,
  nameVi: 'Chương trình đào tạo thử',
  nameEn: 'Test curriculum',
  program: { code: 'ZZPROG', nameVi: 'Chương trình thử', nameEn: null },
  groupNames: new Map(rules.groups.map((g) => [g.id, g.name])),
};

const catalog = new Map<string, CourseSummary>(rules.groups.flatMap((g) => g.courses.map((c) => [c.code, { nameVi: c.nameVi, nameEn: c.nameEn, credits: c.credits }] as const)));

const reportWith = (transcript: TranscriptEntry[]) => checkPlan({ planId: plan.id, rules, courseRules, transcript, terms: BOARD, catalogCredits: new Map() });
const shared = (transcript: TranscriptEntry[] = [], ownerName: string | null = null) => sharedPlan({ plan, report: reportWith(transcript), courses: catalog, curriculum: labels, ownerName });

/** A transcript that changes what the engine says of BOARD in every way it can: passed, in progress, failed and retaken courses. */
const RICH_TRANSCRIPT = [
  graded('ZZA1', 4, 8.5, term(2024, 1)), // the prerequisite of ZZB1, passed
  graded('ZZC1', 4, 9, term(2024, 1)), // placed again: a grade improvement
  ungraded('ZZA2', 4, 'in_progress', term(2024, 3)), // placed again while in progress
  graded('ZZN1', 4, 3, term(2024, 1)), // failed
  graded('ZZN1', 4, 6, term(2024, 2)), // retaken and passed
  graded('ZZT1', 10, 7, term(2024, 2)),
  graded('ZZB1', 4, 6.4, term(2025, 1)), // an attempt in the very term the plan places the course
  ungraded('ZZC2', 4, 'in_progress', term(2025, 2)), // a course the plan does not place, in one of the plan's terms
  graded('ZZC3', 4, 9.9, term(2026, 1)), // after the plan's last term
];

describe('the issue codes a reader sees', () => {
  // A code the engine gains later is in neither list a person wrote: it stays hidden, and this fails until someone decides.
  it('classifies every code of the rule engine, and withholds exactly the four the transcript decides', () => {
    expect([...SHARED_ISSUE_CODES, ...WITHHELD_ISSUE_CODES].sort()).toEqual([...PLAN_ISSUE_CODES].sort());
    expect([...WITHHELD_ISSUE_CODES].sort()).toEqual(['already_in_progress', 'already_passed', 'prerequisite_not_met', 'requirement_not_covered']);
    expect(new Set(SHARED_ISSUE_CODES).size).toBe(SHARED_ISSUE_CODES.length);
  });

  // The codes the owner may choose to show are a list a person wrote too, not "whatever the engine reports".
  it('lists the four transcript codes one by one, so every code is in exactly one of the two lists', () => {
    expect([...TRANSCRIPT_ISSUE_CODES].sort()).toEqual([...WITHHELD_ISSUE_CODES].sort());
    expect([...SHARED_ISSUE_CODES, ...TRANSCRIPT_ISSUE_CODES].sort()).toEqual([...PLAN_ISSUE_CODES].sort());
    expect(new Set([...SHARED_ISSUE_CODES, ...TRANSCRIPT_ISSUE_CODES]).size).toBe(PLAN_ISSUE_CODES.length);
  });
});

describe('sharedPlan', () => {
  it('gives the plan, its terms with names, credits and loads, and the issues of the plan alone', () => {
    const body = shared();
    expect(body).toEqual({
      name: 'Main plan',
      ownerName: null,
      curriculum: { code: 'ZZPROG2024', cohortYear: 2024, nameVi: 'Chương trình đào tạo thử', nameEn: 'Test curriculum', program: { code: 'ZZPROG', nameVi: 'Chương trình thử', nameEn: null } },
      updatedAt: plan.updatedAt,
      terms: [
        {
          term: { year: 2025, number: 1 },
          kind: 'main',
          credits: 4,
          caps: { min: 10, max: 22 },
          placements: [{ kind: 'course', courseCode: 'ZZB1', nameVi: 'Học phần ZZB1', nameEn: null, credits: 4, requirementGroupName: null }],
        },
        {
          term: { year: 2025, number: 2 },
          kind: 'main',
          // ZZC1 4 + ZZT1 10 + ZZA2 4 + the slot 3; ZZGONE has no credits to count.
          credits: 21,
          caps: { min: 10, max: 22 },
          placements: [
            { kind: 'course', courseCode: 'ZZC1', nameVi: 'Học phần ZZC1', nameEn: null, credits: 4, requirementGroupName: null },
            { kind: 'course', courseCode: 'ZZGONE', nameVi: null, nameEn: null, credits: null, requirementGroupName: null },
            { kind: 'course', courseCode: 'ZZT1', nameVi: 'Học phần ZZT1', nameEn: null, credits: 10, requirementGroupName: null },
            { kind: 'course', courseCode: 'ZZA2', nameVi: 'Học phần ZZA2', nameEn: null, credits: 4, requirementGroupName: null },
            { kind: 'slot', courseCode: null, nameVi: null, nameEn: null, credits: 3, requirementGroupName: 'Group c' },
          ],
        },
      ],
      issues: expect.any(Array),
      issueCodesNotShown: ['prerequisite_not_met', 'already_passed', 'already_in_progress', 'requirement_not_covered'],
    });
    expect(body.issues.map((i) => [i.code, i.kind, i.courseCode, i.term && `${i.term.year}-${i.term.number}`, i.position])).toEqual([
      ['load_below_minimum', 'flag', null, '2025-1', null],
      ['load_not_checked', 'unknown', null, '2025-2', null],
      ['not_offered', 'violation', 'ZZC1', '2025-2', 0],
      ['credits_not_recorded', 'unknown', 'ZZGONE', '2025-2', 1],
      ['not_in_curriculum', 'flag', 'ZZGONE', '2025-2', 1],
      ['prerequisites_not_recorded', 'unknown', 'ZZGONE', '2025-2', 1],
      ['offering_terms_not_recorded', 'unknown', 'ZZGONE', '2025-2', 1],
      ['prerequisites_not_recorded', 'unknown', 'ZZT1', '2025-2', 2],
      ['offering_terms_not_recorded', 'unknown', 'ZZT1', '2025-2', 2],
    ]);
    expect(body.issues[0]).toEqual({
      code: 'load_below_minimum',
      kind: 'flag',
      term: { year: 2025, number: 1 },
      position: null,
      courseCode: null,
      offeredTermNumbers: [],
      credits: 4,
      limit: 10,
      citation: 'QĐ 1175/QĐ-KHTN Điều 7.2',
      message: expect.stringContaining('below the minimum of 10'),
    });
    expect(body.issues[2]).toMatchObject({ offeredTermNumbers: [1], citation: 'QĐ 1175/QĐ-KHTN Điều 6.5, 7.1.a' });
  });

  // UC-09 §7: the transcript never appears. The engine's own report changes with the transcript;
  // what a reader gets does not, so nothing in it can tell a reader what the owner passed or failed.
  it('is the same whatever the transcript holds', () => {
    const before = reportWith([]);
    const after = reportWith(RICH_TRANSCRIPT);
    const codes = (r: typeof before) => r.issues.map((i) => i.code);
    expect(codes(before)).toContain('prerequisite_not_met');
    expect(codes(before)).toContain('requirement_not_covered');
    expect(codes(after)).not.toContain('prerequisite_not_met');
    expect(codes(after)).toContain('already_passed');
    expect(codes(after)).toContain('already_in_progress');
    expect(after.coverage).not.toEqual(before.coverage);

    expect(shared(RICH_TRANSCRIPT)).toEqual(shared([]));
    const text = JSON.stringify(shared(RICH_TRANSCRIPT));
    for (const leaked of ['8.5', '6.4', '9.9', 'ZZN1', 'ZZA1', 'ZZC2', 'ZZC3', '"in_progress"', 'graded', 'Course ZZ', 'coverage', 'graduation']) expect(text).not.toContain(leaked);
  });

  it('holds exactly the listed fields, and no id', () => {
    const body = shared(RICH_TRANSCRIPT, 'Test Student');
    expect(Object.keys(body).sort()).toEqual(['curriculum', 'issueCodesNotShown', 'issues', 'name', 'ownerName', 'terms', 'updatedAt']);
    expect(Object.keys(body.curriculum).sort()).toEqual(['code', 'cohortYear', 'nameEn', 'nameVi', 'program']);
    expect(Object.keys(body.curriculum.program).sort()).toEqual(['code', 'nameEn', 'nameVi']);
    for (const t of body.terms) {
      expect(Object.keys(t).sort()).toEqual(['caps', 'credits', 'kind', 'placements', 'term']);
      for (const p of t.placements) expect(Object.keys(p).sort()).toEqual(['courseCode', 'credits', 'kind', 'nameEn', 'nameVi', 'requirementGroupName']);
    }
    for (const i of body.issues) expect(Object.keys(i).sort()).toEqual(['citation', 'code', 'courseCode', 'credits', 'kind', 'limit', 'message', 'offeredTermNumbers', 'position', 'term']);
    const text = JSON.stringify(body);
    expect(text).not.toContain(plan.id);
    expect(text).not.toContain(plan.curriculum.id);
  });

  it("shows the owner's name only when it is given", () => {
    expect(shared([]).ownerName).toBeNull();
    expect(shared([], 'Test Student').ownerName).toBe('Test Student');
  });

  it('shows an empty plan as no terms and no issues', () => {
    const empty = { ...plan, terms: [] };
    const report = checkPlan({ planId: plan.id, rules, courseRules, transcript: RICH_TRANSCRIPT, terms: [], catalogCredits: new Map() });
    expect(sharedPlan({ plan: empty, report, courses: catalog, curriculum: labels, ownerName: null })).toMatchObject({ terms: [], issues: [] });
  });

  // A report of another board is a bug in the caller: a wrong load must never be shown as the engine's.
  it('refuses a report that is not of this board', () => {
    const report = checkPlan({ planId: plan.id, rules, courseRules, transcript: [], terms: [BOARD[0]!], catalogCredits: new Map() });
    expect(() => sharedPlan({ plan, report, courses: catalog, curriculum: labels, ownerName: null })).toThrow(/no load for term 2025-2/);
  });
});

// The owner's choice for a link (ADR 0010, amended 25 November 2026): with it on, a reader also gets
// the checks the engine decides from the transcript, and the coverage. Never a grade, a transcript
// row or an id.
describe('sharedPlan when the owner shows the checks that come from their transcript', () => {
  const sharedWith = (transcript: TranscriptEntry[], ownerName: string | null = null) =>
    sharedPlan({ plan, report: reportWith(transcript), courses: catalog, curriculum: labels, ownerName, showTranscriptChecks: true });
  const groupName = (id: string | null) => (id === null ? null : `Group ${id}`);
  /** The owner's own issue as a reader gets it: every field, with a group or combined minimum by name instead of by id. */
  const asReader = ({ requirementGroupId, combinedMinimumId, ...rest }: PlanIssue) => ({
    ...rest,
    requirementGroupName: groupName(requirementGroupId),
    combinedMinimumName: combinedMinimumId === null ? null : 'B + C',
  });
  const allKeys = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.flatMap(allKeys);
    if (value && typeof value === 'object' && !(value instanceof Date)) return Object.entries(value).flatMap(([k, v]) => [k, ...allKeys(v)]);
    return [];
  };

  it("gives every issue the owner sees, in the engine's order, and names no code as not shown", () => {
    for (const transcript of [[], RICH_TRANSCRIPT]) {
      const report = reportWith(transcript);
      const body = sharedWith(transcript);
      expect(body.issues).toEqual(report.issues.map(asReader));
      expect(body.issueCodesNotShown).toEqual([]);
    }
    const codes = (transcript: TranscriptEntry[]) => sharedWith(transcript).issues.map((i) => i.code);
    expect(codes([])).toEqual(expect.arrayContaining(['prerequisite_not_met', 'requirement_not_covered']));
    expect(codes(RICH_TRANSCRIPT)).toEqual(expect.arrayContaining(['already_passed', 'already_in_progress', 'requirement_not_covered']));
  });

  // requirement_not_covered has three forms; the owner's route tells them apart by which id is set, a reader by which name is.
  it('names the requirement group or the combined minimum of a requirement that is not covered, and neither for the cohort total', () => {
    const uncovered = sharedWith([]).issues.filter((i) => i.code === 'requirement_not_covered');
    const form = (i: (typeof uncovered)[number]) => [i.requirementGroupName, i.combinedMinimumName, i.credits, i.limit, i.missingCourseCodes];
    // With no transcript: group a-bb (ZZA1, ZZA2) has ZZA2 placed and still needs ZZA1; B + C has ZZB1 4 + ZZC1 4 + the slot 3 = 11 of 12.
    expect(uncovered.map(form)).toContainEqual(['Group a-bb', null, 4, 8, ['ZZA1']]);
    expect(uncovered.map(form)).toContainEqual([null, 'B + C', 11, 12, []]);
    const total = uncovered.filter((i) => i.requirementGroupName === null && i.combinedMinimumName === null);
    expect(total).toHaveLength(1);
    expect(total[0]).toMatchObject({ limit: 38, term: null, courseCode: null });
    expect(sharedWith([]).issues.find((i) => i.code === 'prerequisite_not_met')).toMatchObject({ courseCode: 'ZZB1', missingCourseCodes: ['ZZA1'], requirementGroupName: null, combinedMinimumName: null });
  });

  it("gives the engine's coverage and graduation status by name, with no id", () => {
    const report = reportWith(RICH_TRANSCRIPT);
    const { coverage } = sharedWith(RICH_TRANSCRIPT);
    expect(coverage).toEqual({
      groups: report.coverage.groups.map(({ id: _id, ...rest }) => rest),
      combinedMinimums: report.coverage.combinedMinimums.map(({ id: _id, ...rest }) => rest),
      totalRequired: report.coverage.totalRequired,
      totalCredits: report.coverage.totalCredits,
      totalRemaining: report.coverage.totalRemaining,
      graduation: report.coverage.graduation,
    });
    expect(coverage).toMatchObject({ totalRequired: 38, graduation: 'not_yet' });
    expect(coverage!.groups.map((g) => g.name)).toEqual(report.coverage.groups.map((g) => `Group ${g.id}`));
    expect(coverage!.combinedMinimums.map((m) => m.name)).toEqual(['B + C']);
  });

  it('holds exactly the fields of the answer without the choice, plus the coverage and three fields on each issue', () => {
    const body = sharedWith(RICH_TRANSCRIPT, 'Test Student');
    expect(Object.keys(body).sort()).toEqual(['coverage', 'curriculum', 'issueCodesNotShown', 'issues', 'name', 'ownerName', 'terms', 'updatedAt']);
    expect(body.issues.length).toBeGreaterThan(0);
    for (const i of body.issues) {
      expect(Object.keys(i).sort()).toEqual(['citation', 'code', 'combinedMinimumName', 'courseCode', 'credits', 'kind', 'limit', 'message', 'missingCourseCodes', 'offeredTermNumbers', 'position', 'requirementGroupName', 'term']);
    }
    expect(Object.keys(body.coverage!).sort()).toEqual(['combinedMinimums', 'graduation', 'groups', 'totalCredits', 'totalRemaining', 'totalRequired']);
    for (const g of body.coverage!.groups) expect(Object.keys(g).sort()).toEqual(['credits', 'kind', 'met', 'name', 'remainingCredits', 'requiredCredits']);
    for (const m of body.coverage!.combinedMinimums) expect(Object.keys(m).sort()).toEqual(['credits', 'creditsMin', 'met', 'name', 'remainingCredits']);
    // The rest of the answer is the same as without the choice.
    const { coverage: _coverage, issues: _issues, issueCodesNotShown: _notShown, ...rest } = body;
    const { issues: _offIssues, issueCodesNotShown: _offNotShown, ...offRest } = shared(RICH_TRANSCRIPT, 'Test Student');
    expect(rest).toEqual(offRest);
    // No key that could carry an id, a grade or a transcript row, at any depth.
    const everyKey = new Set(allKeys(body));
    for (const key of ['id', 'planId', 'requirementGroupId', 'combinedMinimumId', 'grade', 'result', 'courseName', 'userId', 'email']) expect(everyKey, key).not.toContain(key);
  });

  // The limit of the choice: a reader can tell which courses were passed, failed or are in progress, and nothing more of the transcript.
  it('holds no grade, no transcript row and no id, whatever the transcript holds', () => {
    const text = JSON.stringify(sharedWith(RICH_TRANSCRIPT, 'Test Student'));
    // The distinctive grades of RICH_TRANSCRIPT, the transcript's own course names, and the ids of the plan and its curriculum.
    for (const leaked of ['8.5', '6.4', '9.9', 'Course ZZ', '"grade"', '"graded"', '"in_progress"', '"result"', plan.id, plan.curriculum.id]) expect(text, leaked).not.toContain(leaked);
    // Every term in an issue is a term of the plan, never the term of a transcript row (2024-1 … 2026-1 here).
    for (const i of sharedWith(RICH_TRANSCRIPT).issues) if (i.term) expect(BOARD.map((b) => b.term)).toContainEqual(i.term);
  });

  it('leaves the answer without the choice exactly as it was', () => {
    const off = sharedPlan({ plan, report: reportWith(RICH_TRANSCRIPT), courses: catalog, curriculum: labels, ownerName: null, showTranscriptChecks: false });
    expect(off).toEqual(shared(RICH_TRANSCRIPT));
    expect(off).toEqual(shared([]));
    expect(Object.keys(off)).not.toContain('coverage');
  });

  // A code the engine gains later is in neither list: no reader sees it, with or without the choice, until a person classifies it.
  it('hides a code that nobody has classified, with or without the choice', () => {
    const report = reportWith([]);
    const future = { ...report.issues[0]!, code: 'graded_below_five' } as unknown as PlanIssue;
    const withFuture: PlanIssuesReport = { ...report, issues: [future, ...report.issues] };
    for (const showTranscriptChecks of [false, true]) {
      const body = sharedPlan({ plan, report: withFuture, courses: catalog, curriculum: labels, ownerName: null, showTranscriptChecks });
      expect(body.issues.map((i) => i.code as string)).not.toContain('graded_below_five');
      expect(body.issues).toHaveLength(sharedPlan({ plan, report, courses: catalog, curriculum: labels, ownerName: null, showTranscriptChecks }).issues.length);
    }
  });

  // A name that cannot be found must not become null: null means "the cohort total".
  it('refuses an issue of a group or combined minimum that the coverage does not list', () => {
    const report = reportWith([]);
    const stray = (field: 'requirementGroupId' | 'combinedMinimumId'): PlanIssuesReport => ({
      ...report,
      issues: report.issues.map((i) => (i.code === 'requirement_not_covered' && i.requirementGroupId === null && i.combinedMinimumId === null ? { ...i, [field]: 'no-such-id' } : i)),
    });
    const build = (r: PlanIssuesReport, showTranscriptChecks: boolean) => () => sharedPlan({ plan, report: r, courses: catalog, curriculum: labels, ownerName: null, showTranscriptChecks });
    expect(build(stray('requirementGroupId'), true)).toThrow(/requirement group that its coverage does not list/);
    expect(build(stray('combinedMinimumId'), true)).toThrow(/combined minimum that its coverage does not list/);
    expect(build(stray('requirementGroupId'), false)).not.toThrow();
  });
});
