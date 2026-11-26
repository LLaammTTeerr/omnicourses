import { ConflictException } from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';
import { QueryFailedError } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { AdminWriteService } from './admin-write.service.js';
import { CurriculumAdminService, isPlanSlotRefusal } from './curriculum-admin.service.js';

const SLOT_KEY = 'plan_placements_requirement_group_id_fkey';
const refused = (code: string, constraint = SLOT_KEY) =>
  new QueryFailedError('DELETE', [], Object.assign(new Error('synthetic refusal'), { code, constraint, detail: 'Key (id)=(synthetic-id) is referenced' }));

// The group exists in the path's cohort; each query answers by its SQL. `deleteFails` is what the DELETE throws.
function serviceWith(answers: { links?: string[]; plans?: number; deleteFails?: unknown }) {
  const sql: string[] = [];
  const query = vi.fn(async (text: string) => {
    sql.push(text);
    if (text.startsWith('SELECT 1 FROM "curriculums"')) return [{}];
    if (text.includes('FROM "requirement_group_courses"')) return (answers.links ?? []).map((course_code) => ({ course_code }));
    if (text.includes('FROM "plan_placements"')) return [{ n: answers.plans ?? 0 }];
    if (text.startsWith('DELETE') && answers.deleteFails) throw answers.deleteFails;
    return [];
  });
  const em = { query, getRepository: () => ({ findOneBy: async () => ({ id: 'g' }) }) } as unknown as EntityManager;
  const writes = { run: (_caller: string, _need: unknown, write: (em: EntityManager) => Promise<unknown>) => write(em) } as unknown as AdminWriteService;
  return { service: new CurriculumAdminService({} as DataSource, writes), sql };
}
const deleteGroup = (service: CurriculumAdminService) => service.deleteGroup('caller', 'program', 'cohort', 'g');
const bodyOf = async (promise: Promise<unknown>) => {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(ConflictException);
  return (error as ConflictException).getResponse();
};

describe('CurriculumAdminService.deleteGroup', () => {
  it('deletes an empty group no plan uses, after locking its row', async () => {
    const { service, sql } = serviceWith({});
    await deleteGroup(service);
    expect(sql.findIndex((s) => s.includes('FOR UPDATE'))).toBeLessThan(sql.findIndex((s) => s.includes('plan_placements')));
    expect(sql.at(-1)).toBe('DELETE FROM "requirement_groups" WHERE "id" = $1');
  });

  it('refuses a group that saved plans use with 409 referenced_item and a count only (#171)', async () => {
    const { service, sql } = serviceWith({ plans: 2 });
    expect(await bodyOf(deleteGroup(service))).toEqual({ statusCode: 409, code: 'referenced_item', message: 'Saved plans use the group; it stays while they name it', references: ['2 saved plans use it'] });
    expect(sql.some((s) => s.startsWith('DELETE'))).toBe(false);
  });

  it('still answers the links refusal first, word for word', async () => {
    const { service } = serviceWith({ links: ['CS420'], plans: 1 });
    expect(await bodyOf(deleteGroup(service))).toEqual({ statusCode: 409, code: 'referenced_item', message: 'The group still links courses; remove them from it first', references: ['links CS420'] });
  });

  it("maps the database's refusal of the plan-slot key to 409, without its IDs", async () => {
    for (const code of ['23001', '23503']) {
      const { service } = serviceWith({ deleteFails: refused(code) });
      const body = await bodyOf(deleteGroup(service));
      expect(body).toEqual({ statusCode: 409, code: 'referenced_item', message: 'Saved plans use the group; it stays while they name it', references: ['saved plans use it'] });
      expect(JSON.stringify(body)).not.toContain('synthetic-id');
    }
  });

  it('lets any other database failure through as it is', async () => {
    for (const error of [refused('23001', 'some_other_fkey'), refused('40001'), new Error('connection lost')]) {
      const { service } = serviceWith({ deleteFails: error });
      await expect(deleteGroup(service)).rejects.toBe(error);
    }
  });
});

describe('isPlanSlotRefusal', () => {
  it('is true only for a restrict or foreign-key refusal on the plan-slot key', () => {
    expect([isPlanSlotRefusal(refused('23001')), isPlanSlotRefusal(refused('23503'))]).toEqual([true, true]);
    expect([isPlanSlotRefusal(refused('23505')), isPlanSlotRefusal(refused('23503', 'other')), isPlanSlotRefusal(new Error('x')), isPlanSlotRefusal(null)]).toEqual([false, false, false, false]);
  });
});
