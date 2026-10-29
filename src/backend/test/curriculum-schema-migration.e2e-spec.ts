import { describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../src/database/data-source.js';

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)('curriculum schema migration', () => {
  it('applies migrations and enforces cohort/catalog constraints', async () => {
    const dataSource = new DataSource({ ...dataSourceOptions, url: databaseUrl });
    await dataSource.initialize();
    try {
      await dataSource.runMigrations({ transaction: 'each' });

      const programId = (
        await dataSource.query(
          `INSERT INTO programs (code, name_vi, faculty) VALUES ($1,$2,$3) RETURNING id`,
          ['APCS', 'Cử nhân Khoa học Máy tính - Chương trình Tiên tiến', 'FIT'],
        )
      )[0].id as string;

      const curriculum1 = (
        await dataSource.query(
          `INSERT INTO curriculums (program_id, cohort_year, code, name_vi) VALUES ($1,$2,$3,$4) RETURNING id`,
          [programId, 2024, 'APCS', 'APCS 2024'],
        )
      )[0].id as string;

      const curriculum2 = (
        await dataSource.query(
          `INSERT INTO curriculums (program_id, cohort_year, code, name_vi) VALUES ($1,$2,$3,$4) RETURNING id`,
          [programId, 2025, 'APCS', 'APCS 2025'],
        )
      )[0].id as string;

      expect(curriculum1).toBeTruthy();
      expect(curriculum2).toBeTruthy();

      await expect(
        dataSource.query(
          `INSERT INTO curriculums (program_id, cohort_year, code, name_vi) VALUES ($1,$2,$3,$4)`,
          [programId, 2024, 'APCS', 'APCS 2024 dup'],
        ),
      ).rejects.toThrow();

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

      await dataSource.query(
        `INSERT INTO courses (code, name_vi, credits) VALUES ($1,$2,$3)`,
        ['CS160', 'Nhập môn Tin học', 4],
      );

      await dataSource.query(
        `INSERT INTO requirement_group_courses (requirement_group_id, course_code, compulsory) VALUES ($1,$2,$3)`,
        [group1, 'CS160', true],
      );

      await expect(
        dataSource.query(
          `INSERT INTO requirement_group_courses (requirement_group_id, course_code, compulsory) VALUES ($1,$2,$3)`,
          [group1, 'CS160', true],
        ),
      ).rejects.toThrow();

      await expect(
        dataSource.query(`INSERT INTO courses (code, name_vi, credits) VALUES ($1,$2,$3)`, [
          'BAD001',
          'Bad',
          0,
        ]),
      ).rejects.toThrow();

      await dataSource.query(
        `INSERT INTO requirement_group_courses (requirement_group_id, course_code, compulsory) VALUES ($1,$2,$3)`,
        [group2, 'CS160', false],
      );
    } finally {
      await dataSource.destroy();
    }
  });

  it('rejects malformed course codes and duplicate group names in one curriculum', async () => {
    const dataSource = new DataSource({ ...dataSourceOptions, url: databaseUrl });
    await dataSource.initialize();
    // Random program code so the test can run again on the same database.
    const programCode = `TEST${Date.now()}${Math.floor(Math.random() * 1000)}`;
    let programId: string | undefined;
    try {
      await dataSource.runMigrations({ transaction: 'each' });

      for (const code of ['cs160', 'A', 'CS 160', 'CS-160', 'A'.repeat(21)]) {
        await expect(
          dataSource.query(`INSERT INTO courses (code, name_vi, credits) VALUES ($1,$2,$3)`, [
            code,
            'Bad code',
            4,
          ]),
        ).rejects.toThrow(/ck_courses_code|value too long/);
      }

      programId = (
        await dataSource.query(`INSERT INTO programs (code, name_vi) VALUES ($1,$2) RETURNING id`, [
          programCode,
          'Test program',
        ])
      )[0].id as string;
      const curriculumId = (
        await dataSource.query(
          `INSERT INTO curriculums (program_id, cohort_year, code, name_vi) VALUES ($1,$2,$3,$4) RETURNING id`,
          [programId, 2024, programCode, 'Test 2024'],
        )
      )[0].id as string;

      await dataSource.query(
        `INSERT INTO requirement_groups (curriculum_id, name, kind) VALUES ($1,$2,$3)`,
        [curriculumId, 'Core', 'compulsory'],
      );
      await expect(
        dataSource.query(
          `INSERT INTO requirement_groups (curriculum_id, name, kind) VALUES ($1,$2,$3)`,
          [curriculumId, 'Core', 'elective'],
        ),
      ).rejects.toThrow(/uq_requirement_groups_curriculum_name/);
    } finally {
      if (programId) {
        await dataSource.query(`DELETE FROM curriculums WHERE program_id = $1`, [programId]);
        await dataSource.query(`DELETE FROM programs WHERE id = $1`, [programId]);
      }
      await dataSource.destroy();
    }
  });
});
