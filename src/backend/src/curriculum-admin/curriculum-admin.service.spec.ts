import { ConflictException } from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';
import { QueryFailedError } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import type { AdminWriteService } from '../admin-access/admin-write.service.js';
import { CurriculumAdminService, isPlanSlotRefusal } from './curriculum-admin.service.js';

const SLOT_KEY = 'plan_placements_requirement_group_id_fkey';
const refused = (code: string, constraint = SLOT_KEY) =>
  new QueryFailedError('DELETE', [], Object.assign(new Error('synthetic refusal'), { code, constraint, detail: 'Key (id)=(synthetic-id) is referenced' }));

function serviceWith(answers: {
  links?: string[];
  plans?: number;
  overflows?: { from_group_id: string; to_group_id: string }[];
  combinedMinimums?: { combined_minimum_id: string }[];
  unlinkRow?: { counts_toward_total: boolean; counts_toward_gpa: boolean } | null;
  deleteFails?: unknown;
}) {
  const sql: string[] = [];
  const query = vi.fn(async (text: string) => {
    sql.push(text);
    if (text.startsWith('SELECT 1 FROM "curriculums"')) return [{}];
    if (text.startsWith('SELECT "counts_toward_total"')) return answers.unlinkRow === undefined ? [{ counts_toward_total: true, counts_toward_gpa: true }] : answers.unlinkRow ? [answers.unlinkRow] : [];
    if (text.includes('FROM "requirement_group_courses"')) return (answers.links ?? []).map((course_code) => ({ course_code }));
    if (text.includes('FROM "plan_placements"')) return [{ n: answers.plans ?? 0 }];
    if (text.includes('FROM "requirement_group_overflows"')) return answers.overflows ?? [];
    if (text.includes('FROM "combined_minimum_groups"')) return answers.combinedMinimums ?? [];
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
  it('locks the group row before it counts the plans that use it', async () => {
    const { service, sql } = serviceWith({});
    await deleteGroup(service);
    expect(sql.findIndex((s) => s.includes('FOR UPDATE'))).toBeLessThan(sql.findIndex((s) => s.includes('plan_placements')));
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

  it('refuses a group referenced by overflow or combined-minimum rules with 409 referenced_item before DELETE', async () => {
    const overflowFrom = serviceWith({ overflows: [{ from_group_id: 'g', to_group_id: 'g2' }] });
    expect(await bodyOf(deleteGroup(overflowFrom.service))).toEqual({
      statusCode: 409,
      code: 'referenced_item',
      message: 'Curriculum rules still reference this requirement group; keep it while overflow or combined-minimum rules name it',
      references: ['1 overflow rules name it'],
    });
    expect(overflowFrom.sql.some((s) => s.startsWith('DELETE'))).toBe(false);

    const combined = serviceWith({ combinedMinimums: [{ combined_minimum_id: 'm1' }] });
    expect(await bodyOf(deleteGroup(combined.service))).toEqual({
      statusCode: 409,
      code: 'referenced_item',
      message: 'Curriculum rules still reference this requirement group; keep it while overflow or combined-minimum rules name it',
      references: ['1 combined-minimum rules name it'],
    });
    expect(combined.sql.some((s) => s.startsWith('DELETE'))).toBe(false);

    const both = serviceWith({
      overflows: [{ from_group_id: 'g1', to_group_id: 'g' }],
      combinedMinimums: [{ combined_minimum_id: 'm1' }, { combined_minimum_id: 'm2' }],
    });
    expect(await bodyOf(deleteGroup(both.service))).toEqual({
      statusCode: 409,
      code: 'referenced_item',
      message: 'Curriculum rules still reference this requirement group; keep it while overflow or combined-minimum rules name it',
      references: ['1 overflow rules name it', '2 combined-minimum rules name it'],
    });
    expect(both.sql.some((s) => s.startsWith('DELETE'))).toBe(false);
  });

  it('maps concurrent overflow or combined-minimum FK refusals on DELETE to 409 referenced_item', async () => {
    for (const [constraint, expectedRef] of [
      ['requirement_group_overflows_from_group_id_fkey', 'overflow rules name it'],
      ['requirement_group_overflows_to_group_id_fkey', 'overflow rules name it'],
      ['combined_minimum_groups_requirement_group_id_fkey', 'combined-minimum rules name it'],
    ] as const) {
      const { service } = serviceWith({ deleteFails: refused('23503', constraint) });
      const body = await bodyOf(deleteGroup(service));
      expect(body).toEqual({
        statusCode: 409,
        code: 'referenced_item',
        message: 'Curriculum rules still reference this requirement group; keep it while overflow or combined-minimum rules name it',
        references: [expectedRef],
      });
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

describe('CurriculumAdminService.unlinkCourse', () => {
  it('refuses to unlink a course carrying non-default credit or GPA counting rules before DELETE', async () => {
    for (const [code, unlinkRow] of [
      ['BAA00021', { counts_toward_total: false, counts_toward_gpa: false }],
      ['BAA00022', { counts_toward_total: false, counts_toward_gpa: true }],
      ['BAA00030', { counts_toward_total: true, counts_toward_gpa: false }],
    ] as const) {
      const { service, sql } = serviceWith({ unlinkRow });
      expect(await bodyOf(service.unlinkCourse('caller', 'program', 'cohort', 'g', code))).toEqual({
        statusCode: 409,
        code: 'referenced_item',
        message: `${code} carries non-default GPA or credit-counting rules that cannot be re-entered through administration yet`,
        references: [`counting_rule:${code}`],
      });
      expect(sql.some((s) => s.startsWith('DELETE'))).toBe(false);
    }
  });

  it('unlinks a course whose counting flags are default true when no curriculum rules reference it', async () => {
    const { service, sql } = serviceWith({ unlinkRow: { counts_toward_total: true, counts_toward_gpa: true } });
    await expect(service.unlinkCourse('caller', 'program', 'cohort', 'g', 'CSC10001')).resolves.toBeUndefined();
    expect(sql.some((s) => s.startsWith('DELETE FROM "requirement_group_courses"'))).toBe(true);
  });
});

describe('isPlanSlotRefusal', () => {
  it('is true only for a restrict or foreign-key refusal on the plan-slot key', () => {
    expect([isPlanSlotRefusal(refused('23001')), isPlanSlotRefusal(refused('23503'))]).toEqual([true, true]);
    expect([isPlanSlotRefusal(refused('23505')), isPlanSlotRefusal(refused('23503', 'other')), isPlanSlotRefusal(new Error('x')), isPlanSlotRefusal(null)]).toEqual([false, false, false, false]);
  });
});
