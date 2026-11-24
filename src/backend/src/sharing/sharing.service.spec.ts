import { NotFoundException } from '@nestjs/common';
import { QueryFailedError, type DataSource } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { CurriculumService } from '../curriculum/curriculum.service.js';
import type { PlanIssuesProvider, PlanIssuesReport } from '../plans/plan-issues.js';
import type { PlanDto } from '../plans/plans.dto.js';
import type { PlansService } from '../plans/plans.service.js';
import { newShareToken } from './share-token.js';
import { SharingService } from './sharing.service.js';

// The database is faked: the e2e suite (test/plan-sharing.e2e-spec.ts) covers the SQL. This covers
// what the service answers before, between and after its queries. Synthetic data only.
const NOT_SHARED = new NotFoundException('This plan is not shared');
const NO_PLAN = new NotFoundException('No plan with this id');

const plan: PlanDto = {
  id: 'p1',
  name: 'Main plan',
  curriculum: { id: 'c1', code: 'ZZ2030', programCode: 'ZZ', cohortYear: 2030 },
  createdAt: new Date('2030-01-01T00:00:00Z'),
  updatedAt: new Date('2030-01-02T00:00:00Z'),
  terms: [{ term: { year: 2030, number: 1 }, placements: [{ kind: 'course', courseCode: 'ZZ001', requirementGroupId: null, credits: null }] }],
};
const report: PlanIssuesReport = {
  planId: 'p1',
  trainingType: 'advanced',
  terms: [{ term: { year: 2030, number: 1 }, kind: 'main', credits: 4, caps: { min: 10, max: 22 } }],
  issues: [],
  coverage: { groups: [], combinedMinimums: [], totalRequired: null, totalCredits: 0, totalRemaining: null, graduation: 'not_yet' },
};
const labels = { code: 'ZZ2030', cohortYear: 2030, nameVi: 'CTĐT thử', nameEn: null, program: { code: 'ZZ', nameVi: 'Chương trình thử', nameEn: null }, groupNames: new Map<string, string>() };

function service(found: { share?: Record<string, unknown> | null; plan?: PlanDto | null; labels?: typeof labels | null } = {}) {
  const share = found.share === undefined ? { planId: 'p1', userId: 'u1', ownerName: null } : found.share;
  const tx = { query: vi.fn() };
  const db = { query: vi.fn().mockResolvedValue(share ? [share] : []), transaction: vi.fn((work: (t: typeof tx) => unknown) => work(tx)) };
  const plans = { find: vi.fn().mockResolvedValue(found.plan === undefined ? plan : found.plan), get: vi.fn().mockResolvedValue(plan) };
  const catalog = {
    courseSummaries: vi.fn().mockResolvedValue(new Map([['ZZ001', { nameVi: 'Học phần thử', nameEn: null, credits: 4 }]])),
    curriculumLabels: vi.fn().mockResolvedValue(found.labels === undefined ? labels : found.labels),
  };
  const issues = { issuesFor: vi.fn().mockResolvedValue(report), issuesForBoards: vi.fn() };
  const svc = new SharingService(db as unknown as DataSource, plans as unknown as PlansService, catalog as unknown as CurriculumService, issues as unknown as PlanIssuesProvider);
  return { svc, db, tx, plans, catalog, issues };
}

describe('SharingService.read', () => {
  it('never looks up something that is not a whole token', async () => {
    const { svc, db, plans } = service();
    const token = newShareToken();
    for (const bad of ['', 'x', token.slice(1), `${token}A`, "' OR 1=1 --", 'A'.repeat(5000)]) await expect(svc.read(bad)).rejects.toEqual(NOT_SHARED);
    expect(db.query).not.toHaveBeenCalled();
    expect(plans.find).not.toHaveBeenCalled();
  });

  it('answers "not shared" for a token no live link has, without reading any plan', async () => {
    const { svc, db, plans, issues } = service({ share: null });
    const token = newShareToken();
    await expect(svc.read(token)).rejects.toEqual(NOT_SHARED);
    expect(db.query).toHaveBeenCalledExactlyOnceWith(expect.any(String), [token]);
    expect(plans.find).not.toHaveBeenCalled();
    expect(issues.issuesFor).not.toHaveBeenCalled();
  });

  // The plan was deleted after its link was found: the same answer, not the plans module's 404.
  it('answers "not shared" when the plan is gone by the time it is read', async () => {
    const { svc, issues } = service({ plan: null });
    await expect(svc.read(newShareToken())).rejects.toEqual(NOT_SHARED);
    expect(issues.issuesFor).not.toHaveBeenCalled();
  });

  // The read uses no column of users but display_name, and that one only when the owner chose it (AGENTS.md: never read password_hash).
  it('reads the link, the owner’s display name and nothing else of the account', async () => {
    const { svc, db } = service();
    await svc.read(newShareToken());
    const sql = db.query.mock.calls[0]![0] as string;
    expect(sql).toContain('CASE WHEN s."show_name" THEN u."display_name" END');
    expect(sql).toContain('u."deletion_requested_at" IS NULL');
    expect(sql).not.toMatch(/\*|password_hash|email|google_sub/);
  });

  // The issues are the rule engine's, asked for the very plan that is shown and for its owner: the board and its issues cannot disagree.
  it('asks the rule engine about the plan it shows, read through the owner the link names', async () => {
    const { svc, plans, issues, catalog } = service({ share: { planId: 'p1', userId: 'u1', ownerName: 'Test Student' } });
    const body = await svc.read(newShareToken());
    expect(plans.find).toHaveBeenCalledExactlyOnceWith('u1', 'p1');
    expect(issues.issuesFor).toHaveBeenCalledExactlyOnceWith('u1', plan);
    expect(issues.issuesFor.mock.calls[0]![1]).toBe(plan);
    expect(catalog.courseSummaries).toHaveBeenCalledWith(['ZZ001']);
    expect(catalog.curriculumLabels).toHaveBeenCalledWith('c1');
    expect(body).toMatchObject({ name: 'Main plan', ownerName: 'Test Student', terms: [{ credits: 4, placements: [{ courseCode: 'ZZ001', nameVi: 'Học phần thử', credits: 4 }] }] });
  });

  it('fails loudly, not with a half answer, when the plan’s curriculum is missing', async () => {
    await expect(service({ labels: null }).svc.read(newShareToken())).rejects.toThrow('The curriculum of a shared plan is missing');
  });
});

describe('SharingService, the owner’s side', () => {
  const row = { share_token: newShareToken(), show_name: false, created_at: new Date('2030-01-03T00:00:00Z') };

  it('checks that the plan is the student’s before anything else, on every route', async () => {
    const { svc, db, plans } = service();
    plans.get.mockRejectedValue(NO_PLAN);
    await expect(svc.shareOf('u2', 'p1')).rejects.toEqual(NO_PLAN);
    await expect(svc.share('u2', 'p1', true)).rejects.toEqual(NO_PLAN);
    await expect(svc.stop('u2', 'p1')).rejects.toEqual(NO_PLAN);
    expect(plans.get).toHaveBeenCalledTimes(3);
    expect(plans.get).toHaveBeenCalledWith('u2', 'p1');
    expect(db.query).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('shares with a new 32-byte token, scoped to the student, name hidden unless asked', async () => {
    const { svc, tx } = service();
    tx.query.mockResolvedValueOnce([{}]).mockResolvedValueOnce([row]);
    await expect(svc.share('u1', 'p1', false)).resolves.toEqual({ token: row.share_token, showName: false, createdAt: row.created_at });
    const [sql, params] = tx.query.mock.calls[1]!;
    expect(sql).toContain('ON CONFLICT ("plan_id") DO UPDATE SET "show_name" = EXCLUDED."show_name" WHERE "plan_shares"."user_id" = EXCLUDED."user_id"');
    expect(params).toEqual(['p1', 'u1', expect.stringMatching(/^[A-Za-z0-9_-]{43}$/), false]);
  });

  it('shares nothing for an account waiting for deletion', async () => {
    const { svc, tx } = service();
    tx.query.mockResolvedValueOnce([]);
    await expect(svc.share('u1', 'p1', false)).rejects.toEqual(NO_PLAN);
    expect(tx.query).toHaveBeenCalledTimes(1);
  });

  it('answers 404 when the plan is deleted while it is being shared, and lets any other failure through', async () => {
    const deleted = service();
    deleted.tx.query.mockResolvedValueOnce([{}]).mockRejectedValueOnce(new QueryFailedError('INSERT', [], Object.assign(new Error('fk'), { code: '23503' })));
    await expect(deleted.svc.share('u1', 'p1', false)).rejects.toEqual(NO_PLAN);

    const down = service();
    down.tx.query.mockResolvedValueOnce([{}]).mockRejectedValueOnce(new Error('db down'));
    await expect(down.svc.share('u1', 'p1', false)).rejects.toThrow('db down');
  });

  it('stops every link of an account inside the transaction it is given', async () => {
    const manager = { delete: vi.fn() };
    await service().svc.stopAllWithin(manager as never, 'u1');
    expect(manager.delete).toHaveBeenCalledExactlyOnceWith(expect.anything(), { userId: 'u1' });
  });
});
