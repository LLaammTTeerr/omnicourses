import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../src/database/data-source.js';

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)('curriculum schema migration', () => {
  it('applies migrations and enforces cohort/catalog constraints', async () => {
    const dataSource = new DataSource({ ...dataSourceOptions, url: databaseUrl });
    await dataSource.initialize();
    const suffix = randomUUID().replace(/-/g, '').slice(0, 8);
    const programCode = `P${suffix}`.toUpperCase();
    const courseCode = `CS${suffix.slice(0, 6)}`.toUpperCase();
    try {
      await dataSource.runMigrations({ transaction: 'each' });

      const programId = (
        await dataSource.query(
          `INSERT INTO programs (code, name_vi, faculty) VALUES ($1,$2,$3) RETURNING id`,
          [programCode, 'Test Program', 'FIT'],
        )
      )[0].id as string;

      const curriculum1 = (
        await dataSource.query(
          `INSERT INTO curriculums (program_id, cohort_year, code, name_vi) VALUES ($1,$2,$3,$4) RETURNING id`,
          [programId, 2024, programCode, 'Curriculum 2024'],
        )
      )[0].id as string;

      const curriculum2 = (
        await dataSource.query(
          `INSERT INTO curriculums (program_id, cohort_year, code, name_vi) VALUES ($1,$2,$3,$4) RETURNING id`,
          [programId, 2025, programCode, 'Curriculum 2025'],
        )
      )[0].id as string;

      expect(curriculum1).toBeTruthy();
      expect(curriculum2).toBeTruthy();

      await expect(
        dataSource.query(
          `INSERT INTO curriculums (program_id, cohort_year, code, name_vi) VALUES ($1,$2,$3,$4)`,
          [programId, 2024, programCode, 'Curriculum 2024 dup'],
        ),
      ).rejects.toThrow(/uq_curriculums_program_cohort/);

      const group1 = (
        await dataSource.query(
          `INSERT INTO requirement_groups (curriculum_id, name, kind, credits_total_min) VALUES ($1,$2,$3,$4) RETURNING id`,
          [curriculum1, 'Core', 'compulsory', 50],
        )
      )[0].id as string;

      const group2 = (
        await dataSource.query(
          `INSERT INTO requirement_groups (curriculum_id, name, kind) VALUES ($1,$2,$3) RETURNING id`,
          [curriculum1, 'Electives', 'elective'],
        )
      )[0].id as string;

      await expect(
        dataSource.query(
          `INSERT INTO requirement_groups (curriculum_id, name, kind) VALUES ($1,$2,$3)`,
          [curriculum1, 'Core', 'compulsory'],
        ),
      ).rejects.toThrow(/uq_requirement_groups_curriculum_name/);

      await dataSource.query(
        `INSERT INTO courses (code, name_vi, credits) VALUES ($1,$2,$3)`,
        [courseCode, 'Test Course', 4],
      );

      await dataSource.query(
        `INSERT INTO requirement_group_courses (requirement_group_id, course_code) VALUES ($1,$2)`,
        [group1, courseCode],
      );

      await expect(
        dataSource.query(
          `INSERT INTO requirement_group_courses (requirement_group_id, course_code) VALUES ($1,$2)`,
          [group1, courseCode],
        ),
      ).rejects.toThrow(/requirement_group_courses_pkey|uq_/);

      await expect(
        dataSource.query(`INSERT INTO courses (code, name_vi, credits) VALUES ($1,$2,$3)`, [
          `BAD${suffix.slice(0, 4)}`,
          'Bad',
          0,
        ]),
      ).rejects.toThrow(/ck_courses_credits_positive/);

      await dataSource.query(
        `INSERT INTO requirement_group_courses (requirement_group_id, course_code) VALUES ($1,$2)`,
        [group2, courseCode],
      );
    } finally {
      await dataSource.query(`DELETE FROM requirement_group_courses WHERE course_code = $1`, [courseCode]);
      await dataSource.query(`DELETE FROM courses WHERE code = $1`, [courseCode]);
      await dataSource.query(`DELETE FROM requirement_groups WHERE curriculum_id IN (SELECT id FROM curriculums WHERE program_id IN (SELECT id FROM programs WHERE code = $1))`, [programCode]);
      await dataSource.query(`DELETE FROM curriculums WHERE program_id IN (SELECT id FROM programs WHERE code = $1)`, [programCode]);
      await dataSource.query(`DELETE FROM programs WHERE code = $1`, [programCode]);
      await dataSource.destroy();
    }
  });
});
