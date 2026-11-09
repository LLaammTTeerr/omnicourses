import { NotFoundException } from '@nestjs/common';
import type { ObjectLiteral, Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { Course } from './course.entity.js';
import type { CourseRules, CourseRulesService } from './course-rules.service.js';
import { CurriculumController } from './curriculum.controller.js';
import type { Curriculum } from './curriculum.entity.js';
import { CurriculumService } from './curriculum.service.js';
import type { Program } from './program.entity.js';
import type { RequirementGroupCourse } from './requirement-group-course.entity.js';
import type { RequirementGroup } from './requirement-group.entity.js';

// Synthetic catalog: no real curriculum is needed to check the shapes and the order.
const course = (code: string, credits = 4): Course =>
  ({ code, nameVi: `Học phần ${code}`, nameEn: null, credits, theoryPeriods: 45, labPeriods: null, exercisePeriods: 0, projectPeriods: 0 }) as Course;

const program = { id: 'p1', code: 'ZZ', nameVi: 'Chương trình thử', nameEn: 'Test program', faculty: null } as Program;

const group = (id: string, name: string, kind: 'compulsory' | 'elective', codes: string[]): RequirementGroup =>
  ({
    id,
    name,
    kind,
    creditsTotal: kind === 'compulsory' ? 8 : null,
    creditsTotalMin: kind === 'elective' ? 4 : null,
    officialNotes: null,
    courseLinks: codes.map((code) => ({ courseCode: code, course: course(code) })),
  }) as unknown as RequirementGroup;

const curriculum = {
  id: 'c1',
  code: 'ZZ2030',
  program,
  cohortYear: 2030,
  nameVi: 'Chương trình đào tạo thử',
  nameEn: null,
  language: 'en',
  totalCreditsMin: 12,
  requirementGroups: [group('g2', 'Tự chọn', 'elective', ['ZZ003', 'ZZ001']), group('g1', 'Bắt buộc', 'compulsory', ['ZZ002', 'ZZ001'])],
} as unknown as Curriculum;

function service(overrides: { curriculum?: Curriculum | null; course?: Course | null; links?: RequirementGroupCourse[]; rules?: CourseRules } = {}) {
  const repo = <T extends ObjectLiteral>(methods: Record<string, unknown>) => methods as unknown as Repository<T>;
  const findOne = vi.fn().mockResolvedValue(overrides.curriculum === undefined ? curriculum : overrides.curriculum);
  const findOneBy = vi.fn().mockResolvedValue(overrides.course === undefined ? course('ZZ001') : overrides.course);
  const programs = repo<Program>({
    find: vi.fn().mockResolvedValue([
      { ...program, code: 'ZZB', curriculums: [{ cohortYear: 2031 }, { cohortYear: 2030 }] },
      { ...program, code: 'ZZA', curriculums: [] },
    ]),
  });
  const links = repo<RequirementGroupCourse>({ find: vi.fn().mockResolvedValue(overrides.links ?? []) });
  const rulesFor = vi.fn().mockResolvedValue(overrides.rules ?? { prerequisites: new Map(), offeringTerms: new Map() });
  return {
    findOne,
    findOneBy,
    rulesFor,
    svc: new CurriculumService(programs, repo<Curriculum>({ findOne }), repo<Course>({ findOneBy }), links, { rulesFor } as unknown as CourseRulesService),
  };
}

describe('CurriculumService', () => {
  it('lists programs by code with their cohorts oldest first', async () => {
    const programs = await service().svc.listPrograms();
    expect(programs.map((p) => [p.code, p.cohortYears])).toEqual([
      ['ZZA', []],
      ['ZZB', [2030, 2031]],
    ]);
    expect(programs[0]).toEqual({ code: 'ZZA', nameVi: 'Chương trình thử', nameEn: 'Test program', faculty: null, cohortYears: [] });
  });

  it('returns a curriculum with its groups by name and each group’s courses by code', async () => {
    const { svc, findOne } = service();
    const result = await svc.getCurriculum('ZZ', 2030);
    expect(findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { cohortYear: 2030, program: { code: 'ZZ' } } }));
    expect(result.program).toEqual({ code: 'ZZ', nameVi: 'Chương trình thử', nameEn: 'Test program', faculty: null });
    expect(result.requirementGroups.map((g) => [g.name, g.kind, g.creditsTotal, g.creditsTotalMin, g.courses.map((c) => c.code)])).toEqual([
      ['Bắt buộc', 'compulsory', 8, null, ['ZZ001', 'ZZ002']],
      ['Tự chọn', 'elective', null, 4, ['ZZ001', 'ZZ003']],
    ]);
    // The same course may sit in two groups; the catalog fields come through untouched, nulls kept.
    expect(result.requirementGroups[0].courses[0]).toEqual({
      code: 'ZZ001',
      nameVi: 'Học phần ZZ001',
      nameEn: null,
      credits: 4,
      theoryPeriods: 45,
      labPeriods: null,
      exercisePeriods: 0,
      projectPeriods: 0,
      prerequisites: null,
      offeringTerms: null,
    });
  });

  it('reads prerequisites and offering terms nothing recorded as null, never as none', async () => {
    const result = await service().svc.getCurriculum('ZZ', 2030);
    // An empty list would read as "none"; the data is missing, not empty (test plan, data gaps).
    const courses = result.requirementGroups.flatMap((g) => g.courses);
    expect(courses.every((c) => c.prerequisites === null && c.offeringTerms === null)).toBe(true);
  });

  it('serves the rules recorded for this curriculum, in every group the course sits in', async () => {
    const rules = { prerequisites: new Map([['ZZ001', []], ['ZZ002', ['ZZ001']]]), offeringTerms: new Map([['ZZ002', [1, 3]]]) };
    const { svc, rulesFor } = service({ rules });
    const result = await svc.getCurriculum('ZZ', 2030);
    expect(rulesFor).toHaveBeenCalledWith('c1');
    const rows = result.requirementGroups.flatMap((g) => g.courses.map((c) => [g.name, c.code, c.prerequisites, c.offeringTerms]));
    expect(rows).toEqual([
      ['Bắt buộc', 'ZZ001', [], null],
      ['Bắt buộc', 'ZZ002', ['ZZ001'], [1, 3]],
      ['Tự chọn', 'ZZ001', [], null],
      ['Tự chọn', 'ZZ003', null, null],
    ]);
  });

  it('answers null, then 404, for an unknown curriculum', async () => {
    const { svc } = service({ curriculum: null });
    await expect(svc.findCurriculum('ZZ', 1999)).resolves.toBeNull();
    await expect(svc.getCurriculum('ZZ', 1999)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('never queries for a cohort that is not an integer', async () => {
    const { svc, findOne } = service();
    await expect(svc.findCurriculum('ZZ', 2030.5)).resolves.toBeNull();
    expect(findOne).not.toHaveBeenCalled();
  });

  it('returns a course with its memberships by program, cohort, then group', async () => {
    const membership = (programCode: string, cohortYear: number, id: string, name: string) =>
      ({
        requirementGroup: { id, name, kind: 'elective', curriculum: { code: `${programCode}${cohortYear}`, cohortYear, program: { code: programCode } } },
      }) as unknown as RequirementGroupCourse;
    const { svc } = service({
      links: [membership('ZZB', 2030, 'g3', 'A'), membership('ZZA', 2031, 'g2', 'B'), membership('ZZA', 2030, 'g4', 'C'), membership('ZZA', 2031, 'g1', 'A')],
    });
    const result = await svc.getCourse('ZZ001');
    expect(result.code).toBe('ZZ001');
    expect(result.memberships.map((m) => m.requirementGroupId)).toEqual(['g4', 'g1', 'g2', 'g3']);
    expect(result.memberships[0]).toEqual({
      programCode: 'ZZA',
      cohortYear: 2030,
      curriculumCode: 'ZZA2030',
      requirementGroupId: 'g4',
      requirementGroupName: 'C',
      kind: 'elective',
    });
  });

  it('gives 404 for an unknown course and does not query a malformed code', async () => {
    const unknown = service({ course: null });
    await expect(unknown.svc.getCourse('ZZ999')).rejects.toBeInstanceOf(NotFoundException);
    const malformed = service();
    await expect(malformed.svc.findCourse('csc10001')).resolves.toBeNull();
    await expect(malformed.svc.findCourse('CSC.10001')).resolves.toBeNull();
    expect(malformed.findOneBy).not.toHaveBeenCalled();
  });
});

describe('CurriculumService bulk reads for plans', () => {
  const repo = <T extends ObjectLiteral>(methods: Record<string, unknown>) => methods as unknown as Repository<T>;
  function bulk(found: { curriculum?: Partial<Curriculum> | null; courses?: Course[] } = {}) {
    const findOne = vi.fn().mockResolvedValue(found.curriculum === undefined ? { id: 'c1', requirementGroups: [{ id: 'g1' }, { id: 'g2' }] } : found.curriculum);
    const find = vi.fn().mockResolvedValue(found.courses ?? []);
    const svc = new CurriculumService(repo<Program>({}), repo<Curriculum>({ findOne }), repo<Course>({ find }), repo<RequirementGroupCourse>({}), {} as CourseRulesService);
    return { svc, findOne, find };
  }

  it('finds the id of a cohort’s curriculum, or null', async () => {
    await expect(bulk().svc.findCurriculumId('ZZ', 2030)).resolves.toBe('c1');
    await expect(bulk({ curriculum: null }).svc.findCurriculumId('ZZ', 2030)).resolves.toBeNull();
    const { svc, findOne } = bulk();
    await expect(svc.findCurriculumId('ZZ', 2030.5)).resolves.toBeNull();
    expect(findOne).not.toHaveBeenCalled();
  });

  it('answers which codes the catalog has in one query, never asking about a malformed or repeated code', async () => {
    const { svc, find } = bulk({ courses: [course('ZZ001')] });
    expect(await svc.knownCourseCodes(['ZZ001', 'ZZ002', 'ZZ001', 'zz003'])).toEqual(new Set(['ZZ001']));
    expect(find).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(find.mock.calls[0][0].where.code)).toContain('["ZZ001","ZZ002"]');
    const none = bulk();
    expect(await none.svc.knownCourseCodes(['bad code'])).toEqual(new Set());
    expect(none.find).not.toHaveBeenCalled();
  });

  it('lists the requirement group ids of a curriculum, none for an unknown one', async () => {
    expect(await bulk().svc.requirementGroupIds('c1')).toEqual(new Set(['g1', 'g2']));
    expect(await bulk({ curriculum: null }).svc.requirementGroupIds('c9')).toEqual(new Set());
  });
});

describe('CurriculumController', () => {
  it('answers 404 for a cohort that is not a 4-digit year, without asking the service', async () => {
    const getCurriculum = vi.fn();
    const controller = new CurriculumController({ getCurriculum } as unknown as CurriculumService);
    for (const cohort of ['abc', '24', '20245', '2024.0', ' 2024']) {
      expect(() => controller.getCurriculum('ZZ', cohort)).toThrow(NotFoundException);
    }
    expect(getCurriculum).not.toHaveBeenCalled();
  });

  it('passes a 4-digit cohort to the service as a number', async () => {
    const getCurriculum = vi.fn().mockResolvedValue({});
    const controller = new CurriculumController({ getCurriculum } as unknown as CurriculumService);
    await controller.getCurriculum('ZZ', '2030');
    expect(getCurriculum).toHaveBeenCalledWith('ZZ', 2030);
  });
});
