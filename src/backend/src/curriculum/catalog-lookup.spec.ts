import type { FindOperator, ObjectLiteral, Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { CatalogLookup } from './catalog-lookup.js';
import type { Course } from './course.entity.js';
import type { Curriculum } from './curriculum.entity.js';

// Synthetic catalog only (AGENTS.md hard rule 3).
const course = (code: string, credits = 4): Course =>
  ({ code, nameVi: `Học phần ${code}`, nameEn: null, credits, theoryPeriods: 45, labPeriods: null, exercisePeriods: 0, projectPeriods: 0 }) as Course;

describe('CatalogLookup: bulk reads for plans', () => {
  const repo = <T extends ObjectLiteral>(methods: Record<string, unknown>) => methods as unknown as Repository<T>;
  const CATALOG = [course('ZZ001'), course('ZZ002', 3)];
  // Each fake answers like the database: the curriculum of program ZZ, cohort 2030 only, an error
  // for a cohort the integer column cannot hold, and the catalog rows whose code is in the list.
  function bulk(found: { curriculum?: Partial<Curriculum> | null } = {}) {
    const stored = found.curriculum === undefined ? { id: 'c1', requirementGroups: [{ id: 'g1' }, { id: 'g2' }] } : found.curriculum;
    const findOne = async ({ where }: { where: { id?: string; cohortYear?: number; program?: { code: string } } }) => {
      if (where.id !== undefined) return where.id === 'c1' ? stored : null;
      if (!Number.isInteger(where.cohortYear)) throw new Error('invalid input syntax for type integer');
      return where.program?.code === 'ZZ' && where.cohortYear === 2030 ? stored : null;
    };
    const find = vi.fn(async ({ where }: { where: { code: FindOperator<string[]> } }) => CATALOG.filter((c) => where.code.value.includes(c.code)));
    return { svc: new CatalogLookup(repo<Curriculum>({ findOne }), repo<Course>({ find })), find };
  }

  it('finds the id of a cohort’s curriculum, or null', async () => {
    await expect(bulk().svc.curriculumIdOf('ZZ', 2030)).resolves.toBe('c1');
    await expect(bulk().svc.curriculumIdOf('ZZ', 2031)).resolves.toBeNull();
    await expect(bulk().svc.curriculumIdOf('ZY', 2030)).resolves.toBeNull();
    await expect(bulk({ curriculum: null }).svc.curriculumIdOf('ZZ', 2030)).resolves.toBeNull();
    await expect(bulk().svc.curriculumIdOf('ZZ', 2030.5)).resolves.toBeNull();
  });

  it('answers which codes the catalog has, and their credits, in one query for the whole list', async () => {
    const { svc, find } = bulk();
    expect(await svc.knownCourseCodes(['ZZ001', 'ZZ009', 'ZZ001', 'zz002'])).toEqual(new Set(['ZZ001']));
    expect(find).toHaveBeenCalledTimes(1);
    expect(await svc.courseCredits(['ZZ002', 'ZZ001', 'ZZ009', 'ZZ002'])).toEqual(new Map([['ZZ001', 4], ['ZZ002', 3]]));
    expect(await svc.knownCourseCodes(['bad code'])).toEqual(new Set());
    expect(await svc.courseCredits([])).toEqual(new Map());
  });

  it('lists the requirement group ids of a curriculum, none for an unknown one', async () => {
    expect(await bulk().svc.requirementGroupIds('c1')).toEqual(new Set(['g1', 'g2']));
    expect(await bulk().svc.requirementGroupIds('c9')).toEqual(new Set());
    expect(await bulk({ curriculum: null }).svc.requirementGroupIds('c1')).toEqual(new Set());
  });
});
