import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogLookup } from '../curriculum/catalog-lookup.js';
import type { BoardTerm, Placement } from '../rules/inputs.js';
import type { PlanPlacement } from './plan-placement.entity.js';
import type { Plan } from './plan.entity.js';
import { PlanIdPipe } from './plans.controller.js';
import { planNotFound, PlansService } from './plans.service.js';

// Synthetic catalog only (AGENTS.md hard rule 3). The database is faked: test/plans.e2e-spec.ts
// covers what is stored; this covers what the service refuses before it writes anything.
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

/** A service whose database holds `storedPlan` for its owner, or nothing (`owned: false`). */
function service(found: { curriculumId?: string | null; owned?: boolean } = {}) {
  const owned = found.owned ?? true;
  const tx = {
    insert: vi.fn().mockResolvedValue({ identifiers: [{ id: 'p1' }] }),
    delete: vi.fn(),
    find: vi.fn().mockResolvedValue([]),
    query: vi.fn().mockResolvedValue(owned ? [{ curriculum_id: 'c1', name: 'Main plan' }] : []),
  };
  const transaction = vi.fn((work: (t: typeof tx) => unknown) => work(tx));
  const plans = {
    findOne: vi.fn().mockResolvedValue(owned ? storedPlan : null),
    update: vi.fn().mockResolvedValue({ affected: owned ? 1 : 0 }),
    delete: vi.fn().mockResolvedValue({ affected: owned ? 1 : 0 }),
  };
  const catalog = {
    curriculumIdOf: vi.fn().mockResolvedValue(found.curriculumId === undefined ? 'c1' : found.curriculumId),
    knownCourseCodes: vi.fn().mockResolvedValue(new Set(['ZZ001', 'ZZ002'])),
    requirementGroupIds: vi.fn().mockResolvedValue(new Set(['g1'])),
  };
  const svc = new PlansService(
    { transaction } as unknown as DataSource,
    plans as unknown as Repository<Plan>,
    { find: vi.fn().mockResolvedValue([]) } as unknown as Repository<PlanPlacement>,
    catalog as unknown as CatalogLookup,
  );
  return { svc, transaction };
}

const create = (svc: PlansService, terms?: BoardTerm[]) => svc.create('u1', { name: 'Main plan', programCode: 'ZZ', cohortYear: 2030, terms });

describe('PlansService', () => {
  it('answers a new plan with its curriculum', async () => {
    expect(await create(service().svc, board(course('ZZ001'), slot('g1')))).toEqual({
      id: 'p1',
      name: 'Main plan',
      curriculum: { id: 'c1', code: 'ZZ2030', programCode: 'ZZ', cohortYear: 2030 },
      createdAt: storedPlan.createdAt,
      updatedAt: storedPlan.updatedAt,
      terms: [],
    });
  });

  it('refuses an unknown curriculum, an unknown course, another curriculum’s group and a course placed twice, writing nothing', async () => {
    const cases: [ReturnType<typeof service>, BoardTerm[] | undefined, RegExp][] = [
      [service({ curriculumId: null }), undefined, /No curriculum/],
      [service(), board(course('ZZ001'), course('ZZ009')), /ZZ009/],
      [service(), board(slot('g9')), /g9 is not in the plan's curriculum/],
      [service(), [...board(course('ZZ001')), { term: { year: 2030, number: 2 }, placements: [course('ZZ001')] }], /./],
    ];
    for (const [{ svc, transaction }, terms, message] of cases) {
      const error = await create(svc, terms).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      expect(JSON.stringify((error as BadRequestException).getResponse())).toMatch(message);
      expect(transaction).not.toHaveBeenCalled();
    }
  });

  it('answers 404 for a plan that is missing or someone else’s', async () => {
    const { svc } = service({ owned: false });
    await expect(svc.get('u2', 'p1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.rename('u2', 'p1', 'x')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.delete('u2', 'p1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.replacePlacements('u2', 'p1', [])).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.duplicate('u2', 'p1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PlanIdPipe', () => {
  it('answers 404 for a malformed plan id, as for an unknown one, and lower-cases a valid one', () => {
    const pipe = new PlanIdPipe();
    for (const id of ['not-a-uuid', '1', "' OR 1=1 --"]) expect(() => pipe.transform(id)).toThrow(NotFoundException);
    // The same body as an unknown plan, so the answer can't tell a malformed id from another student's.
    expect(() => pipe.transform('1')).toThrow(expect.objectContaining({ response: planNotFound().getResponse() }));
    expect(pipe.transform('3F2B8C1E-0D4A-4C6B-9E1F-2A3B4C5D6E7F')).toBe('3f2b8c1e-0d4a-4c6b-9e1f-2a3b4c5d6e7f');
  });
});
