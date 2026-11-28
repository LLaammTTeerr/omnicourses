import { NotFoundException } from '@nestjs/common';
import { QueryFailedError, type DataSource } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { CurriculumService } from '../curriculum/curriculum.service.js';
import type { PlanDto } from '../plans/plans.dto.js';
import type { PlansService } from '../plans/plans.service.js';
import type { RulesService } from '../rules/rules.service.js';
import type { PlanIssuesReport } from '../rules/types.js';
import { isShareToken, newShareToken, SharingService } from './sharing.service.js';

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
    catalogCourses: vi.fn().mockResolvedValue(new Map([['ZZ001', { nameVi: 'Học phần thử', nameEn: null, credits: 4 }]])),
    curriculumLabels: vi.fn().mockResolvedValue(found.labels === undefined ? labels : found.labels),
  };
  const issues = { issuesFor: vi.fn().mockResolvedValue(report), issuesForBoards: vi.fn() };
  const svc = new SharingService(db as unknown as DataSource, plans as unknown as PlansService, catalog as unknown as CurriculumService, issues as unknown as RulesService);
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

  it('reads a link only of an account with no deletion waiting', async () => {
    const { svc, db } = service({ share: null });
    await expect(svc.read(newShareToken())).rejects.toEqual(NOT_SHARED);
    expect(db.query.mock.calls[0][0]).toContain('WHERE s."share_token" = $1 AND u."deletion_requested_at" IS NULL');
  });

  it('answers "not shared" when the plan is gone by the time it is read', async () => {
    const { svc, issues } = service({ plan: null });
    await expect(svc.read(newShareToken())).rejects.toEqual(NOT_SHARED);
    expect(issues.issuesFor).not.toHaveBeenCalled();
  });

  it('never selects every column, the password hash, the email or the Google ID of the owner’s account', async () => {
    const { svc, db } = service();
    await svc.read(newShareToken());
    expect(db.query.mock.calls[0]![0]).not.toMatch(/\*|password_hash|email|google_sub/);
  });

  it('asks the rule engine about the plan it shows, read through the owner the link names, and without the transcript', async () => {
    const { svc, plans, issues, catalog } = service({ share: { planId: 'p1', userId: 'u1', ownerName: 'Test Student' } });
    const body = await svc.read(newShareToken());
    expect(plans.find).toHaveBeenCalledExactlyOnceWith('u1', 'p1');
    expect(issues.issuesFor).toHaveBeenCalledExactlyOnceWith(plan, null);
    expect(issues.issuesFor.mock.calls[0]![0]).toBe(plan);
    expect(issues.issuesForBoards).not.toHaveBeenCalled();
    expect(catalog.catalogCourses).toHaveBeenCalledWith(['ZZ001']);
    expect(catalog.curriculumLabels).toHaveBeenCalledWith('c1');
    expect(body).toMatchObject({ name: 'Main plan', ownerName: 'Test Student', terms: [{ credits: 4, placements: [{ courseCode: 'ZZ001', nameVi: 'Học phần thử', credits: 4 }] }] });
  });

  it('adds the transcript’s checks and the coverage only when the link says the owner chose them', async () => {
    const chosen = service({ share: { planId: 'p1', userId: 'u1', ownerName: null, showTranscriptChecks: true } });
    const on = await chosen.svc.read(newShareToken());
    expect(on.coverage).toEqual({ groups: [], combinedMinimums: [], totalRequired: null, totalCredits: 0, totalRemaining: null, graduation: 'not_yet' });
    expect(on.issueCodesNotShown).toEqual([]);
    expect(chosen.issues.issuesFor).toHaveBeenCalledExactlyOnceWith(plan, 'u1');
    expect(chosen.issues.issuesFor.mock.calls[0]![0]).toBe(plan);

    for (const value of [false, undefined, null, 'true', 1]) {
      const notChosen = service({ share: { planId: 'p1', userId: 'u1', ownerName: null, showTranscriptChecks: value } });
      const off = await notChosen.svc.read(newShareToken());
      expect(Object.keys(off), String(value)).not.toContain('coverage');
      expect(off.issueCodesNotShown, String(value)).toEqual(['prerequisite_not_met', 'already_passed', 'already_in_progress', 'requirement_not_covered']);
      expect(notChosen.issues.issuesFor, String(value)).toHaveBeenCalledExactlyOnceWith(plan, null);
    }
  });

  it('fails loudly, not with a half answer, when the plan’s curriculum is missing', async () => {
    await expect(service({ labels: null }).svc.read(newShareToken())).rejects.toThrow('The curriculum of a shared plan is missing');
  });
});

describe('SharingService, the owner’s side', () => {
  const row = { share_token: newShareToken(), show_name: false, show_transcript_checks: false, created_at: new Date('2030-01-03T00:00:00Z') };

  it('checks that the plan is the student’s before anything else, on every route', async () => {
    const { svc, db, plans } = service();
    plans.get.mockRejectedValue(NO_PLAN);
    await expect(svc.shareOf('u2', 'p1')).rejects.toEqual(NO_PLAN);
    await expect(svc.share('u2', 'p1', { showName: true, showTranscriptChecks: true })).rejects.toEqual(NO_PLAN);
    await expect(svc.stop('u2', 'p1')).rejects.toEqual(NO_PLAN);
    expect(plans.get).toHaveBeenCalledTimes(3);
    expect(plans.get).toHaveBeenCalledWith('u2', 'p1');
    expect(db.query).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('shares with a new 32-byte token, scoped to the student, with both choices off unless asked', async () => {
    const { svc, tx } = service();
    tx.query.mockResolvedValueOnce([{}]).mockResolvedValueOnce([row]);
    await expect(svc.share('u1', 'p1')).resolves.toEqual({ token: row.share_token, showName: false, showTranscriptChecks: false, createdAt: row.created_at });
    const [sql, params] = tx.query.mock.calls[1]!;
    expect(sql).toContain('WHERE "plan_shares"."user_id" = EXCLUDED."user_id"');
    expect(params).toEqual(['p1', 'u1', expect.stringMatching(/^[A-Za-z0-9_-]{43}$/), null, null]);
  });

  it('passes on each choice exactly as it was sent, and nothing for a choice left out', async () => {
    const sent = async (choices: { showName?: boolean; showTranscriptChecks?: boolean }) => {
      const { svc, tx } = service();
      tx.query.mockResolvedValueOnce([{}]).mockResolvedValueOnce([row]);
      await svc.share('u1', 'p1', choices);
      return (tx.query.mock.calls[1]![1] as unknown[]).slice(3);
    };
    expect(await sent({})).toEqual([null, null]);
    expect(await sent({ showName: true })).toEqual([true, null]);
    expect(await sent({ showTranscriptChecks: true })).toEqual([null, true]);
    expect(await sent({ showName: false, showTranscriptChecks: false })).toEqual([false, false]);
    expect(await sent({ showName: undefined, showTranscriptChecks: true })).toEqual([null, true]);
  });

  it('tells the owner both choices of the live link', async () => {
    const { svc, db } = service();
    db.query.mockResolvedValueOnce([{ ...row, show_name: true, show_transcript_checks: true }]);
    await expect(svc.shareOf('u1', 'p1')).resolves.toEqual({ token: row.share_token, showName: true, showTranscriptChecks: true, createdAt: row.created_at });
  });

  it('shares nothing for an account waiting for deletion', async () => {
    const { svc, tx } = service();
    tx.query.mockResolvedValueOnce([]);
    await expect(svc.share('u1', 'p1', { showTranscriptChecks: true })).rejects.toEqual(NO_PLAN);
    expect(tx.query).toHaveBeenCalledTimes(1);
  });

  it('locks the account row FOR SHARE, only while no deletion is waiting, before it writes the link', async () => {
    const { svc, tx } = service();
    tx.query.mockResolvedValueOnce([{}]).mockResolvedValueOnce([row]);
    await svc.share('u1', 'p1');
    expect(tx.query.mock.calls[0]).toEqual(['SELECT 1 FROM "users" WHERE "id" = $1 AND "deletion_requested_at" IS NULL FOR SHARE', ['u1']]);
    expect(tx.query).toHaveBeenCalledTimes(2);
  });

  it('answers 404 when the plan is deleted while it is being shared, and lets any other failure through', async () => {
    const deleted = service();
    deleted.tx.query.mockResolvedValueOnce([{}]).mockRejectedValueOnce(new QueryFailedError('INSERT', [], Object.assign(new Error('fk'), { code: '23503' })));
    await expect(deleted.svc.share('u1', 'p1')).rejects.toEqual(NO_PLAN);

    const down = service();
    down.tx.query.mockResolvedValueOnce([{}]).mockRejectedValueOnce(new Error('db down'));
    await expect(down.svc.share('u1', 'p1')).rejects.toThrow('db down');
  });

  it('stops every link of an account inside the transaction it is given', async () => {
    const manager = { delete: vi.fn() };
    await service().svc.stopAllWithin(manager as never, 'u1');
    expect(manager.delete).toHaveBeenCalledExactlyOnceWith(expect.anything(), { userId: 'u1' });
  });
});

describe('share token', () => {
  it('holds 32 random bytes in base64url', () => {
    const token = newShareToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(isShareToken(token)).toBe(true);
  });

  it('is new each time', () => {
    const tokens = new Set(Array.from({ length: 200 }, newShareToken));
    expect(tokens.size).toBe(200);
  });

  it('refuses anything that is not a whole token', () => {
    const token = newShareToken();
    for (const value of ['', 'abc', token.slice(1), `${token}A`, `${token.slice(0, 42)}=`, `${token.slice(0, 42)}/`, `${token}\n`, 'x'.repeat(5000), undefined, null, 42, [token]]) {
      expect(isShareToken(value), String(value).slice(0, 50)).toBe(false);
    }
  });
});
