import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Course } from '../curriculum/course.entity.js';
import type { CourseDto } from '../curriculum/curriculum.dto.js';
import { courseDto } from '../curriculum/curriculum.service.js';
import { AffectedCurriculumDto, conflict, notFound, referencedItem } from './admin-errors.js';
import { AdminWriteService } from './admin-write.service.js';
import { COURSE_FIELDS, type CourseField, CreateCourseDto, UpdateCourseDto } from './curriculum-admin.dto.js';
import { courseCodeOr400 } from './curriculum-admin.service.js';

export type CourseValues = Pick<Course, CourseField>;

/** A change to one stored course: the values it would have, and the fields that differ. */
export interface CourseChange {
  proposed: CourseValues;
  changed: CourseField[];
}

/**
 * The version of a shared-course change that a catalog maintainer reviews (ADR 0011): the
 * current and proposed values and every affected curriculum. Any change to one of them
 * between the warning and the confirmation gives another version, so a stale confirmation
 * cannot apply.
 */
export function impactVersion(code: string, current: CourseValues, proposed: CourseValues, affected: AffectedCurriculumDto[]): string {
  const values = (v: CourseValues) => COURSE_FIELDS.map((f) => v[f]);
  const payload = JSON.stringify([code, values(current), values(proposed), affected.map((a) => a.curriculumId)]);
  return createHash('sha256').update(payload).digest('base64url');
}

// Catalog maintainer writes (ADR 0011, UC-11 A8). The catalog is shared: a course's values
// are read by every curriculum that links it, so changing a linked course needs an explicit
// confirmation of exactly which curricula it reaches. Codes never change here.
@Injectable()
export class CatalogAdminService {
  constructor(private readonly writes: AdminWriteService) {}

  createCourse(callerId: string, dto: CreateCourseDto): Promise<CourseDto> {
    const code = courseCodeOr400(dto.code, 'code');
    return this.writes.run(callerId, { permission: 'catalog_maintainer' }, async (em) => {
      if (await em.getRepository(Course).existsBy({ code })) throw conflict('duplicate_code', `The catalog already has ${code}`);
      await this.insertCourse(em, code, newCourseValues(dto));
      return courseDto(await em.getRepository(Course).findOneByOrFail({ code }));
    });
  }

  updateCourse(callerId: string, rawCode: string, dto: UpdateCourseDto): Promise<CourseDto> {
    const code = courseCodeOr400(rawCode);
    return this.writes.run(callerId, { permission: 'catalog_maintainer' }, async (em) => {
      const course = await em.getRepository(Course).findOneBy({ code });
      if (!course) throw notFound(`No catalog course has the code ${code}`);
      const change = courseChange(course, dto);
      if (!change.changed.length) return courseDto(course);

      const { affected, reviewVersion } = await this.reviewChange(em, code, course, change.proposed);
      if (affected.length) {
        if (dto.confirmImpact === undefined) {
          throw conflict('impact_confirmation_required', `${code} is shared: the change reaches every curriculum listed; confirm with confirmImpact`, {
            affectedCurricula: affected,
            reviewVersion,
          });
        }
        if (dto.confirmImpact !== reviewVersion) {
          throw conflict('impact_changed', `${code} or the curricula linking it changed since the review; review again`, { affectedCurricula: affected, reviewVersion });
        }
      }
      await this.saveChange(em, code, change);
      return courseDto(await em.getRepository(Course).findOneByOrFail({ code }));
    });
  }

  // The steps of a catalog write, inside the caller's transaction. Manual entry above and the
  // CSV import (csv-import.service.ts) both go through them, so a course is reviewed and
  // saved one way (ADR 0011: "Manual entry and CSV confirmation use the same transactional
  // write/validation services").

  /** Saves a course the catalog does not have yet. */
  async insertCourse(em: EntityManager, code: string, values: CourseValues): Promise<void> {
    await em.getRepository(Course).insert({ code, ...values });
  }

  /** What a maintainer reviews before a stored course changes: who reads it, and the version of that review. */
  async reviewChange(em: EntityManager, code: string, current: CourseValues, proposed: CourseValues): Promise<{ affected: AffectedCurriculumDto[]; reviewVersion: string }> {
    const affected = await affectedCurricula(em, code);
    return { affected, reviewVersion: impactVersion(code, current, proposed, affected) };
  }

  /** Saves the changed fields. update() sets updated_at with the change (ADR 0011). */
  async saveChange(em: EntityManager, code: string, change: CourseChange): Promise<void> {
    await em.getRepository(Course).update({ code }, Object.fromEntries(change.changed.map((f) => [f, change.proposed[f]])));
  }

  /**
   * Only an unreferenced course (ADR 0011): no curriculum link or rule, no transcript row and no
   * saved plan placement, both of which name the course by plain code without a foreign key
   * (ADR 0007, ADR 0014).
   */
  deleteCourse(callerId: string, rawCode: string): Promise<void> {
    const code = courseCodeOr400(rawCode);
    return this.writes.run(callerId, { permission: 'catalog_maintainer' }, async (em) => {
      if (!(await em.getRepository(Course).existsBy({ code }))) throw notFound(`No catalog course has the code ${code}`);
      const references = [
        ...(await affectedCurricula(em, code)).map((c) => `linked in ${c.curriculumCode}`),
        ...(await countOf(em, code, 'course_prerequisite_lists', 'course_code', 'curricula record its prerequisites')),
        ...(await countOf(em, code, 'course_prerequisites', 'prerequisite_code', 'courses require it')),
        ...(await countOf(em, code, 'course_offering_terms', 'course_code', 'offering-term rows name it')),
        ...(await countOf(em, code, 'transcript_rows', 'course_code', 'transcript rows name it')),
        ...(await countOf(em, code, 'plan_placements', 'course_code', 'saved plans place it')),
      ];
      if (references.length) throw referencedItem(`${code} is still referenced`, references);
      await em.getRepository(Course).delete({ code });
    });
  }
}

/** Every curriculum with a group that links the course, by program code then cohort. */
export async function affectedCurricula(em: EntityManager, code: string): Promise<AffectedCurriculumDto[]> {
  const rows: { curriculum_id: string; curriculum_code: string; program_code: string; cohort_year: number }[] = await em.query(
    `SELECT DISTINCT c."id" AS "curriculum_id", c."code" AS "curriculum_code", p."code" AS "program_code", c."cohort_year"
     FROM "requirement_group_courses" l
     JOIN "requirement_groups" g ON g."id" = l."requirement_group_id"
     JOIN "curriculums" c ON c."id" = g."curriculum_id"
     JOIN "programs" p ON p."id" = c."program_id"
     WHERE l."course_code" = $1
     ORDER BY p."code", c."cohort_year", c."id"`,
    [code],
  );
  return rows.map((r) => ({ curriculumId: r.curriculum_id, curriculumCode: r.curriculum_code, programCode: r.program_code, cohortYear: r.cohort_year }));
}

async function countOf(em: EntityManager, code: string, table: string, column: string, words: string): Promise<string[]> {
  const [{ n }] = await em.query(`SELECT count(*)::int AS "n" FROM "${table}" WHERE "${column}" = $1`, [code]);
  return n ? [`${n} ${words}`] : [];
}

const blankToNull = (value: string | null | undefined): string | null => (value?.trim() ? value.trim() : null);

/** The values a new course is saved with: a blank English name is null, an absent period count is 0. */
export function newCourseValues(dto: CreateCourseDto): CourseValues {
  return {
    nameVi: dto.nameVi,
    nameEn: blankToNull(dto.nameEn),
    credits: dto.credits,
    theoryPeriods: dto.theoryPeriods ?? 0,
    labPeriods: dto.labPeriods ?? 0,
    exercisePeriods: dto.exercisePeriods ?? 0,
    projectPeriods: dto.projectPeriods ?? 0,
  };
}

/** The stored course with the given fields replaced; a field left undefined keeps its value. */
export function courseChange(course: CourseValues, fields: Partial<CourseValues>): CourseChange {
  const proposed: CourseValues = Object.fromEntries(COURSE_FIELDS.map((f) => [f, course[f]])) as CourseValues;
  for (const field of COURSE_FIELDS) {
    const value = fields[field];
    if (value !== undefined) (proposed as Record<CourseField, unknown>)[field] = field === 'nameEn' ? blankToNull(value as string | null) : value;
  }
  return { proposed, changed: COURSE_FIELDS.filter((f) => proposed[f] !== course[f]) };
}
