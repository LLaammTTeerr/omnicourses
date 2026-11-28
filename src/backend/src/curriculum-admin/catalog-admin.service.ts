import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { conflict, notFound } from '../common/api-errors.js';
import { changedFields, trimmedOrNull } from '../common/field-validators.js';
import { Course } from '../curriculum/course.entity.js';
import type { CourseDto } from '../curriculum/curriculum.dto.js';
import { courseDto } from '../curriculum/curriculum.service.js';
import { AffectedCurriculumDto, referencedItem } from './admin-errors.js';
import { courseCodeOr400, noCatalogCode } from './admin-lookups.js';
import { AdminWriteService } from './admin-write.service.js';
import { COURSE_FIELDS, type CourseField, CreateCourseDto, UpdateCourseDto } from './curriculum-admin.dto.js';
import { type CountedReference, REFERENCES } from './references.js';

export type CourseValues = Pick<Course, CourseField>;

export interface CourseChange {
  proposed: CourseValues;
  changed: CourseField[];
}

export function impactVersion(code: string, current: CourseValues, proposed: CourseValues, affected: AffectedCurriculumDto[]): string {
  return reviewHash(code, courseValuesInOrder(current), courseValuesInOrder(proposed), affected.map((curriculum) => curriculum.curriculumId));
}

export const reviewHash = (...parts: unknown[]): string => createHash('sha256').update(JSON.stringify(parts)).digest('base64url');

export const courseValuesInOrder = (values: CourseValues): unknown[] => COURSE_FIELDS.map((field) => values[field]);

const COURSE_REFERENCE_COUNTS: { table: string; column: string; what: CountedReference }[] = [
  { table: 'course_prerequisite_lists', column: 'course_code', what: 'prerequisiteLists' },
  { table: 'course_prerequisites', column: 'prerequisite_code', what: 'requiredBy' },
  { table: 'course_offering_terms', column: 'course_code', what: 'offeringTerms' },
  { table: 'transcript_rows', column: 'course_code', what: 'transcriptRows' },
  { table: 'plan_placements', column: 'course_code', what: 'plans' },
];

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
      if (!course) throw notFound(noCatalogCode(code));
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

  async insertCourse(em: EntityManager, code: string, values: CourseValues): Promise<void> {
    await em.getRepository(Course).insert({ code, ...values });
  }

  async reviewChange(em: EntityManager, code: string, current: CourseValues, proposed: CourseValues): Promise<{ affected: AffectedCurriculumDto[]; reviewVersion: string }> {
    const affected = await affectedCurricula(em, code);
    return { affected, reviewVersion: impactVersion(code, current, proposed, affected) };
  }

  async saveChange(em: EntityManager, code: string, change: CourseChange): Promise<void> {
    await em.getRepository(Course).update({ code }, Object.fromEntries(change.changed.map((f) => [f, change.proposed[f]])));
  }

  deleteCourse(callerId: string, rawCode: string): Promise<void> {
    const code = courseCodeOr400(rawCode);
    return this.writes.run(callerId, { permission: 'catalog_maintainer' }, async (em) => {
      if (!(await em.getRepository(Course).existsBy({ code }))) throw notFound(noCatalogCode(code));
      const references = [...(await affectedCurricula(em, code)).map((curriculum) => REFERENCES.linkedIn(curriculum.curriculumCode)), ...(await countedReferences(em, code))];
      if (references.length) throw referencedItem(`${code} is still referenced`, references);
      await em.getRepository(Course).delete({ code });
    });
  }
}

async function affectedCurricula(em: EntityManager, code: string): Promise<AffectedCurriculumDto[]> {
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
  return rows.map((row) => ({ curriculumId: row.curriculum_id, curriculumCode: row.curriculum_code, programCode: row.program_code, cohortYear: row.cohort_year }));
}

async function countedReferences(em: EntityManager, code: string): Promise<string[]> {
  const references: string[] = [];
  for (const { table, column, what } of COURSE_REFERENCE_COUNTS) {
    const [{ n: count }]: { n: number }[] = await em.query(`SELECT count(*)::int AS "n" FROM "${table}" WHERE "${column}" = $1`, [code]);
    if (count) references.push(REFERENCES.counted(count, what));
  }
  return references;
}

export function newCourseValues(dto: CreateCourseDto): CourseValues {
  return {
    nameVi: dto.nameVi,
    nameEn: trimmedOrNull(dto.nameEn),
    credits: dto.credits,
    theoryPeriods: dto.theoryPeriods ?? 0,
    labPeriods: dto.labPeriods ?? 0,
    exercisePeriods: dto.exercisePeriods ?? 0,
    projectPeriods: dto.projectPeriods ?? 0,
  };
}

export function courseChange(course: CourseValues, fields: Partial<CourseValues>): CourseChange {
  const changes = changedFields(COURSE_FIELDS, course, fields, { nameEn: trimmedOrNull });
  const stored = Object.fromEntries(COURSE_FIELDS.map((field) => [field, course[field]])) as CourseValues;
  return { proposed: { ...stored, ...changes } as CourseValues, changed: COURSE_FIELDS.filter((field) => field in changes) };
}
