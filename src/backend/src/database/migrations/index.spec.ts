import { readdirSync } from 'node:fs';
import type { QueryRunner } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { HardenConstraintsAndIndexes1795600000000 } from './1795600000000-harden-constraints-and-indexes.js';
import { MIGRATIONS } from './index.js';

describe('MIGRATIONS', () => {
  const timestamp = (name: string) => /(\d{13})$/.exec(name)?.[1];

  it('gives every migration a name that is its class name and ends in a timestamp', () => {
    for (const Migration of MIGRATIONS) {
      expect(timestamp(Migration.name), Migration.name).toBeDefined();
      expect(new Migration().name).toBe(Migration.name);
    }
  });

  it('gives every migration a timestamp of its own, since TypeORM would run two with one timestamp in list order without a warning', () => {
    const timestamps = MIGRATIONS.map((Migration) => timestamp(Migration.name));
    expect(timestamps.filter((t, i) => timestamps.indexOf(t) !== i)).toEqual([]);
  });

  it('lists every migration file in the folder', async () => {
    const files = readdirSync(__dirname).filter((name) => /^\d{13}-.+\.ts$/.test(name));
    for (const name of files) {
      const exported: unknown[] = Object.values(await import(`./${name}`));
      expect(MIGRATIONS.some((Migration) => exported.includes(Migration)), name).toBe(true);
    }
    expect(files).toHaveLength(MIGRATIONS.length);
  });
});

describe('HardenConstraintsAndIndexes1795600000000', () => {
  it('switches group rule FKs to ON DELETE NO ACTION with curriculum cascade on overflows, adds the five missing indexes, and reverses cleanly', async () => {
    const upSql: string[] = [];
    const downSql: string[] = [];
    const migration = new HardenConstraintsAndIndexes1795600000000();

    await migration.up({ query: vi.fn(async (sql: string) => upSql.push(sql)) } as unknown as QueryRunner);
    await migration.down({ query: vi.fn(async (sql: string) => downSql.push(sql)) } as unknown as QueryRunner);

    const joinedUp = upSql.join('\n');
    expect(joinedUp).toContain('requirement_group_overflows_curriculum_id_fkey');
    expect(joinedUp).toContain('requirement_group_overflows_from_group_id_fkey');
    expect(joinedUp).toContain('requirement_group_overflows_to_group_id_fkey');
    expect(joinedUp).toContain('combined_minimum_groups_requirement_group_id_fkey');
    expect(joinedUp).toContain('ON DELETE NO ACTION');
    expect(joinedUp).not.toContain('ON DELETE RESTRICT');
    expect(joinedUp).not.toContain('uq_curriculums_code');
    for (const indexName of [
      'idx_transcript_rows_course_code',
      'idx_plan_placements_course_code',
      'idx_onboarding_answers_program_code',
      'idx_academic_calendar_starts_on_kind',
      'idx_notifications_unread',
    ]) {
      expect(joinedUp).toContain(`CREATE INDEX IF NOT EXISTS "${indexName}"`);
      expect(downSql.join('\n')).toContain(`DROP INDEX IF EXISTS "${indexName}"`);
    }
    expect(downSql.join('\n')).toContain('DROP COLUMN "curriculum_id"');
    expect(downSql.join('\n')).toContain('ON DELETE CASCADE');
  });
});
