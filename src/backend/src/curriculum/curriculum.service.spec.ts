import { NotFoundException } from '@nestjs/common';
import type { ObjectLiteral, Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { CourseRules } from '../rules/inputs.js';
import type { Term } from '../terms/term.js';
import type { Course } from './course.entity.js';
import type { CourseRulesService } from './course-rules.service.js';
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
  // Answers like the database: the stored curriculum for its program and cohort only, and an error
  // for a cohort the integer column cannot hold.
  const stored = overrides.curriculum === undefined ? curriculum : overrides.curriculum;
  const findOne = async ({ where }: { where: { cohortYear: number; program: { code: string } } }) => {
    if (!Number.isInteger(where.cohortYear)) throw new Error('invalid input syntax for type integer');
    return where.program.code === 'ZZ' && where.cohortYear === 2030 ? stored : null;
  };
  const findOneBy = vi.fn().mockResolvedValue(overrides.course === undefined ? course('ZZ001') : overrides.course);
  const programs = repo<Program>({
    find: vi.fn().mockResolvedValue([
      { ...program, code: 'ZZB', curriculums: [{ cohortYear: 2031 }, { cohortYear: 2030 }] },
      { ...program, code: 'ZZA', curriculums: [] },
    ]),
  });
  const links = repo<RequirementGroupCourse>({ find: vi.fn().mockResolvedValue(overrides.links ?? []) });
  const rulesFor = async (id: string) => (id === 'c1' && overrides.rules) || { prerequisites: new Map(), offeringTerms: new Map() };
  return {
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
    const result = await service().svc.getCurriculum('ZZ', 2030);
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
    const rules = { prerequisites: new Map([['ZZ001', []], ['ZZ002', ['ZZ001']]]), offeringTerms: new Map([['ZZ002', [1, 3] as Term['number'][]]]) };
    const result = await service({ rules }).svc.getCurriculum('ZZ', 2030);
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
    await expect(svc.findCurriculum('ZZ', 2030)).resolves.toBeNull();
    await expect(svc.getCurriculum('ZZ', 2030)).rejects.toBeInstanceOf(NotFoundException);
    // Another cohort, or another program, is not this curriculum.
    await expect(service().svc.getCurriculum('ZZ', 2031)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service().svc.getCurriculum('ZY', 2030)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('answers null for a cohort that is not a whole year, which the integer column cannot hold', async () => {
    await expect(service().svc.findCurriculum('ZZ', 2030.5)).resolves.toBeNull();
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

  it('gives 404 for an unknown course and null for a malformed code, though the catalog would find one', async () => {
    const unknown = service({ course: null });
    await expect(unknown.svc.getCourse('ZZ999')).rejects.toBeInstanceOf(NotFoundException);
    const malformed = service();
    await expect(malformed.svc.findCourse('csc10001')).resolves.toBeNull();
    await expect(malformed.svc.findCourse('CSC.10001')).resolves.toBeNull();
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
