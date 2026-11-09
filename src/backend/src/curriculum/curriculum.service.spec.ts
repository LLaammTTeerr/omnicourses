import { NotFoundException } from '@nestjs/common';
import type { ObjectLiteral, Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { Course } from './course.entity.js';
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

function service(overrides: { curriculum?: Curriculum | null; course?: Course | null; links?: RequirementGroupCourse[] } = {}) {
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
  return {
    findOne,
    findOneBy,
    svc: new CurriculumService(programs, repo<Curriculum>({ findOne }), repo<Course>({ findOneBy }), links),
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
    });
  });

  it('claims nothing it does not store: no prerequisite or offering-term field', async () => {
    const result = await service().svc.getCurriculum('ZZ', 2030);
    // An empty list would read as "none"; the data is missing, not empty (test plan, data gaps).
    expect(JSON.stringify(result)).not.toMatch(/prereq|offering/i);
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
