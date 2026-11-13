import type { ObjectLiteral, Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { CatalogLookup } from './catalog-lookup.js';
import type { Course } from './course.entity.js';
import type { Curriculum } from './curriculum.entity.js';

// Synthetic catalog only (AGENTS.md hard rule 3).
const course = (code: string, credits = 4): Course =>
  ({ code, nameVi: `Học phần ${code}`, nameEn: null, credits, theoryPeriods: 45, labPeriods: null, exercisePeriods: 0, projectPeriods: 0 }) as Course;

describe('CatalogLookup: bulk reads for plans', () => {
  const repo = <T extends ObjectLiteral>(methods: Record<string, unknown>) => methods as unknown as Repository<T>;
  function bulk(found: { curriculum?: Partial<Curriculum> | null; courses?: Course[] } = {}) {
    const findOne = vi.fn().mockResolvedValue(found.curriculum === undefined ? { id: 'c1', requirementGroups: [{ id: 'g1' }, { id: 'g2' }] } : found.curriculum);
    const find = vi.fn().mockResolvedValue(found.courses ?? []);
    const svc = new CatalogLookup(repo<Curriculum>({ findOne }), repo<Course>({ find }));
    return { svc, findOne, find };
  }

  it('finds the id of a cohort’s curriculum, or null', async () => {
    await expect(bulk().svc.curriculumIdOf('ZZ', 2030)).resolves.toBe('c1');
    await expect(bulk({ curriculum: null }).svc.curriculumIdOf('ZZ', 2030)).resolves.toBeNull();
    const { svc, findOne } = bulk();
    await expect(svc.curriculumIdOf('ZZ', 2030.5)).resolves.toBeNull();
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
