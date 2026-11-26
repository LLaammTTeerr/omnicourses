import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { CurriculumService } from '../curriculum/curriculum.service.js';
import type { OnboardingService } from '../onboarding/onboarding.service.js';
import type { BoardTerm, Placement } from '../rules/types.js';
import type { PlanPlacement } from './plan-placement.entity.js';
import type { Plan } from './plan.entity.js';
import { PlansService } from './plans.service.js';

const course = (courseCode: string): Placement => ({ kind: 'course', courseCode, requirementGroupId: null, credits: null });
const slot = (requirementGroupId: string): Placement => ({ kind: 'slot', courseCode: null, requirementGroupId, credits: 3 });
const board = (...placements: Placement[]): BoardTerm[] => [{ term: { year: 2030, number: 1 }, placements }];

const storedPlan = {
  id: 'p1',
  userId: 'u1',
  name: 'Main plan',
  curriculum: { id: 'c1', code: 'ZZ2030', cohortYear: 2030, program: { code: 'ZZ' } },
  createdAt: new Date('2030-01-01T00:00:00Z'),
  updatedAt: new Date('2030-01-02T00:00:00Z'),
} as unknown as Plan;

function service(found: { curriculumId?: string | null; plan?: Plan | null; affected?: number; offered?: boolean } = {}) {
  const tx = {
    insert: vi.fn().mockResolvedValue({ identifiers: [{ id: 'p1' }] }),
    delete: vi.fn(),
    query: vi.fn().mockResolvedValue([{ curriculum_id: 'c1', name: 'Main plan', program_code: 'ZZ', cohort_year: 2030 }]),
  };
  const db = { transaction: vi.fn((work: (t: typeof tx) => unknown) => work(tx)) } as unknown as DataSource;
  const plans = {
    find: vi.fn().mockResolvedValue([storedPlan]),
    findOne: vi.fn().mockResolvedValue(found.plan === undefined ? storedPlan : found.plan),
    update: vi.fn().mockResolvedValue({ affected: found.affected ?? 1 }),
    delete: vi.fn().mockResolvedValue({ affected: found.affected ?? 1 }),
  };
  const placements = { find: vi.fn().mockResolvedValue([]) };
  const curriculum = {
    findCurriculumId: vi.fn().mockResolvedValue(found.curriculumId === undefined ? 'c1' : found.curriculumId),
    catalogCourses: vi.fn().mockResolvedValue(new Map(['ZZ001', 'ZZ002'].map((code) => [code, { nameVi: code, nameEn: null, credits: 4 }]))),
    requirementGroupIds: vi.fn().mockResolvedValue(new Set(['g1'])),
  };
  const onboarding = { offers: vi.fn().mockReturnValue(found.offered ?? true) };
  const svc = new PlansService(
    db,
    plans as unknown as Repository<Plan>,
    placements as unknown as Repository<PlanPlacement>,
    curriculum as unknown as CurriculumService,
    onboarding as unknown as OnboardingService,
  );
  return { svc, tx, plans, curriculum, onboarding };
}

const create = (svc: PlansService, terms?: BoardTerm[]) => svc.create('u1', { name: 'Main plan', programCode: 'ZZ', cohortYear: 2030, terms });

describe('PlansService', () => {
  it('creates a plan with its placements against the cohort’s curriculum', async () => {
    const { svc, tx } = service();
    const plan = await create(svc, board(course('ZZ001'), slot('g1')));
    expect(tx.insert).toHaveBeenNthCalledWith(1, expect.anything(), { userId: 'u1', curriculumId: 'c1', name: 'Main plan' });
    expect(tx.insert.mock.calls[1][1]).toHaveLength(2);
    expect(plan).toEqual({
      id: 'p1',
      name: 'Main plan',
      curriculum: { id: 'c1', code: 'ZZ2030', programCode: 'ZZ', cohortYear: 2030 },
      createdAt: storedPlan.createdAt,
      updatedAt: storedPlan.updatedAt,
      terms: [],
    });
  });

  it('inserts no placement row for an empty plan', async () => {
    const { svc, tx } = service();
    await create(svc);
    expect(tx.insert).toHaveBeenCalledTimes(1);
  });

  it('refuses an unknown curriculum, an unknown course, another curriculum’s group and a course placed twice, writing nothing', async () => {
    const cases: [ReturnType<typeof service>, BoardTerm[] | undefined, RegExp][] = [
      [service({ curriculumId: null }), undefined, /No curriculum/],
      [service(), board(course('ZZ001'), course('ZZ009')), /ZZ009/],
      [service(), board(slot('g9')), /g9 is not in the plan's curriculum/],
      [service(), [...board(course('ZZ001')), { term: { year: 2030, number: 2 }, placements: [course('ZZ001')] }], /./],
    ];
    for (const [{ svc, tx }, terms, message] of cases) {
      const error = await create(svc, terms).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      expect(JSON.stringify((error as BadRequestException).getResponse())).toMatch(message);
      expect(tx.insert).not.toHaveBeenCalled();
    }
  });

  it('refuses a new plan for a cohort onboarding does not offer, before it reads the catalog or writes anything', async () => {
    const { svc, tx, curriculum, onboarding } = service({ offered: false });
    const error = await create(svc, board(course('ZZ001'))).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(JSON.stringify((error as BadRequestException).getResponse())).toMatch(/Onboarding does not offer ZZ 2030/);
    expect(onboarding.offers).toHaveBeenCalledWith('ZZ', 2030);
    expect(curriculum.findCurriculumId).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('refuses to copy a plan whose cohort onboarding does not offer, since a copy is a new plan, writing nothing', async () => {
    const { svc, tx, onboarding } = service({ offered: false });
    await expect(svc.duplicate('u1', 'p1')).rejects.toBeInstanceOf(BadRequestException);
    expect(onboarding.offers).toHaveBeenCalledWith('ZZ', 2030);
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('keeps reading, renaming, filling and deleting a saved plan whose cohort onboarding does not offer', async () => {
    const { svc, tx, onboarding } = service({ offered: false });
    await expect(svc.get('u1', 'p1')).resolves.toMatchObject({ id: 'p1' });
    await expect(svc.list('u1')).resolves.toHaveLength(1);
    await expect(svc.rename('u1', 'p1', 'Renamed')).resolves.toMatchObject({ id: 'p1' });
    await expect(svc.replacePlacements('u1', 'p1', board(course('ZZ001')))).resolves.toMatchObject({ id: 'p1' });
    await expect(svc.delete('u1', 'p1')).resolves.toBeUndefined();
    expect(tx.insert).toHaveBeenCalledTimes(1);
    expect(onboarding.offers).not.toHaveBeenCalled();
  });

  it('asks the catalog nothing about groups when the board has no slot, and allows a course outside the curriculum', async () => {
    const { svc, curriculum } = service();
    await create(svc, board(course('ZZ002')));
    expect(curriculum.requirementGroupIds).not.toHaveBeenCalled();
  });

  it('finds an owned plan, or null for one that is missing or someone else’s, writing nothing', async () => {
    const owned = service();
    await expect(owned.svc.find('u1', 'p1')).resolves.toMatchObject({ id: 'p1', name: 'Main plan', terms: [] });
    expect(owned.plans.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p1', userId: 'u1' } }));
    const missing = service({ plan: null });
    await expect(missing.svc.find('u2', 'p1')).resolves.toBeNull();
    expect(missing.plans.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p1', userId: 'u2' } }));
    for (const { tx, plans } of [owned, missing]) {
      expect(tx.insert).not.toHaveBeenCalled();
      expect(tx.delete).not.toHaveBeenCalled();
      expect(plans.update).not.toHaveBeenCalled();
      expect(plans.delete).not.toHaveBeenCalled();
    }
  });

  it('answers 404 for a plan that is missing or someone else’s', async () => {
    const missing = service({ plan: null, affected: 0 });
    await expect(missing.svc.get('u2', 'p1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(missing.svc.rename('u2', 'p1', 'x')).rejects.toBeInstanceOf(NotFoundException);
    await expect(missing.svc.delete('u2', 'p1')).rejects.toBeInstanceOf(NotFoundException);
    expect(missing.plans.update).toHaveBeenCalledWith({ id: 'p1', userId: 'u2' }, { name: 'x' });
    expect(missing.plans.delete).toHaveBeenCalledWith({ id: 'p1', userId: 'u2' });

    const locked = service();
    locked.tx.query.mockResolvedValue([]);
    await expect(locked.svc.replacePlacements('u2', 'p1', [])).rejects.toBeInstanceOf(NotFoundException);
    await expect(locked.svc.duplicate('u2', 'p1')).rejects.toBeInstanceOf(NotFoundException);
    expect(locked.tx.delete).not.toHaveBeenCalled();
    expect(locked.tx.insert).not.toHaveBeenCalled();
  });

  it('replaces the placements of an owned plan and marks it changed', async () => {
    const { svc, tx } = service();
    await svc.replacePlacements('u1', 'p1', board(course('ZZ001')));
    expect(tx.query.mock.calls[0]).toEqual([expect.stringContaining('FOR NO KEY UPDATE'), ['p1', 'u1']]);
    expect(tx.delete).toHaveBeenCalledWith(expect.anything(), { planId: 'p1' });
    expect(tx.insert.mock.calls[0][1]).toEqual([expect.objectContaining({ planId: 'p1', userId: 'u1', courseCode: 'ZZ001', position: 0 })]);
    expect(tx.query.mock.calls.at(-1)?.[0]).toMatch(/SET "updated_at" = now\(\)/);
  });

  it('copies a plan under the original name unless given one', async () => {
    const { svc, tx } = service();
    await svc.duplicate('u1', 'p1');
    expect(tx.insert).toHaveBeenCalledWith(expect.anything(), { userId: 'u1', curriculumId: 'c1', name: 'Main plan' });
    await svc.duplicate('u1', 'p1', 'What if');
    expect(tx.insert).toHaveBeenLastCalledWith(expect.anything(), { userId: 'u1', curriculumId: 'c1', name: 'What if' });
  });
});
