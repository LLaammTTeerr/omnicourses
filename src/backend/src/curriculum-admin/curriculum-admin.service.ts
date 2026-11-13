import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { byText } from '../common/by-text.js';
import { blankToNull } from '../common/transforms.js';
import { RequirementGroup } from '../curriculum/requirement-group.entity.js';
import { conflict, notFound, prerequisiteCycle, referencedItem, validationFailed } from './admin-errors.js';
import { courseCodeOr400 } from './admin-params.js';
import { AdminWriteService } from './admin-write.service.js';
import {
  AdminProgramDto,
  CreateRequirementGroupDto,
  OfferingTermsDto,
  PrerequisitesDto,
  RequirementGroupAdminDto,
  SetOfferingTermsDto,
  SetPrerequisitesDto,
  UpdateRequirementGroupDto,
} from './curriculum-admin.dto.js';
import { findPrerequisiteCycle } from './prerequisite-cycle.js';

// Program-administrator writes (ADR 0011): requirement groups, their course links, and the
// prerequisites and offering terms of a curriculum's courses. Every write runs under the F12
// lock with the caller's current grant for the path's program, and resolves the curriculum
// and group from stored relations: an ID from another program is a 404, never a write.
// Checks here are structural; academic consistency belongs to the rule engine.
@Injectable()
export class CurriculumAdminService {
  constructor(
    private readonly db: DataSource,
    private readonly writes: AdminWriteService,
  ) {}

  /** The programs the caller may administer, with their cohorts. */
  async editablePrograms(callerId: string): Promise<AdminProgramDto[]> {
    const rows: { id: string; code: string; name_vi: string; curriculum_id: string | null; curriculum_code: string | null; cohort_year: number | null }[] =
      await this.db.query(
        `SELECT p."id", p."code", p."name_vi", c."id" AS "curriculum_id", c."code" AS "curriculum_code", c."cohort_year"
         FROM "program_admin_grants" g
         JOIN "programs" p ON p."id" = g."program_id"
         LEFT JOIN "curriculums" c ON c."program_id" = p."id"
         WHERE g."user_id" = $1`,
        [callerId],
      );
    const programs = new Map<string, AdminProgramDto>();
    for (const r of rows) {
      const program = programs.get(r.id) ?? { id: r.id, code: r.code, nameVi: r.name_vi, curricula: [] };
      programs.set(r.id, program);
      if (r.curriculum_id) program.curricula.push({ id: r.curriculum_id, code: r.curriculum_code!, cohortYear: r.cohort_year! });
    }
    for (const p of programs.values()) p.curricula.sort((a, b) => a.cohortYear - b.cohortYear);
    return [...programs.values()].sort((a, b) => byText(a.code, b.code));
  }

  // ---- Requirement groups ------------------------------------------------------------------

  createGroup(callerId: string, programId: string, curriculumId: string, dto: CreateRequirementGroupDto): Promise<RequirementGroupAdminDto> {
    return this.writes.run(callerId, { program: programId }, async (em) => {
      await curriculumIn(em, programId, curriculumId);
      await assertGroupNameFree(em, curriculumId, dto.name);
      const saved = await em.getRepository(RequirementGroup).save({ curriculumId, name: dto.name, kind: dto.kind, officialNotes: blankToNull(dto.officialNotes) });
      return groupDto(await em.getRepository(RequirementGroup).findOneByOrFail({ id: saved.id }));
    });
  }

  updateGroup(callerId: string, programId: string, curriculumId: string, groupId: string, dto: UpdateRequirementGroupDto): Promise<RequirementGroupAdminDto> {
    return this.writes.run(callerId, { program: programId }, async (em) => {
      const group = await groupIn(em, programId, curriculumId, groupId);
      if (dto.name !== undefined && dto.name !== group.name) await assertGroupNameFree(em, curriculumId, dto.name);
      // A stored total means one thing for each kind (ADR 0005); totals are not editable yet.
      if (dto.kind !== undefined && dto.kind !== group.kind && (group.creditsTotal !== null || group.creditsTotalMin !== null)) {
        throw validationFailed('kind: cannot change while the group stores a credit total (ADR 0011: totals wait for the rule-engine handoff)');
      }
      const patch: Partial<RequirementGroup> = {};
      if (dto.name !== undefined) patch.name = dto.name;
      if (dto.kind !== undefined) patch.kind = dto.kind;
      if (dto.officialNotes !== undefined) patch.officialNotes = blankToNull(dto.officialNotes);
      // update() sets updated_at with the change (ADR 0011).
      if (Object.keys(patch).length) await em.getRepository(RequirementGroup).update({ id: groupId }, patch);
      return groupDto(await em.getRepository(RequirementGroup).findOneByOrFail({ id: groupId }));
    });
  }

  deleteGroup(callerId: string, programId: string, curriculumId: string, groupId: string): Promise<void> {
    return this.writes.run(callerId, { program: programId }, async (em) => {
      await groupIn(em, programId, curriculumId, groupId);
      const links: { course_code: string }[] = await em.query(
        'SELECT "course_code" FROM "requirement_group_courses" WHERE "requirement_group_id" = $1 ORDER BY "course_code"',
        [groupId],
      );
      // ADR 0011: unlink the courses explicitly first, so no rule loses its course silently.
      if (links.length) throw referencedItem('The group still links courses; remove them from it first', links.map((l) => `links ${l.course_code}`));
      await em.query('DELETE FROM "requirement_groups" WHERE "id" = $1', [groupId]);
    });
  }

  // ---- Group membership --------------------------------------------------------------------

  linkCourse(callerId: string, programId: string, curriculumId: string, groupId: string, rawCode: string): Promise<void> {
    const code = courseCodeOr400(rawCode);
    return this.writes.run(callerId, { program: programId }, async (em) => {
      await groupIn(em, programId, curriculumId, groupId);
      // Selecting a catalog course is not permission to change it (ADR 0011).
      const [course] = await em.query('SELECT 1 FROM "courses" WHERE "code" = $1', [code]);
      if (!course) throw notFound(`No catalog course has the code ${code}; a catalog maintainer adds it first`);
      await em.query(
        'INSERT INTO "requirement_group_courses" ("requirement_group_id", "course_code") VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [groupId, code],
      );
    });
  }

  unlinkCourse(callerId: string, programId: string, curriculumId: string, groupId: string, rawCode: string): Promise<void> {
    const code = courseCodeOr400(rawCode);
    return this.writes.run(callerId, { program: programId }, async (em) => {
      await groupIn(em, programId, curriculumId, groupId);
      const [link] = await em.query('SELECT 1 FROM "requirement_group_courses" WHERE "requirement_group_id" = $1 AND "course_code" = $2', [groupId, code]);
      if (!link) throw notFound(`${code} is not in this group`);
      const [elsewhere] = await em.query(
        `SELECT 1 FROM "requirement_group_courses" l JOIN "requirement_groups" g ON g."id" = l."requirement_group_id"
         WHERE g."curriculum_id" = $1 AND l."course_code" = $2 AND l."requirement_group_id" <> $3`,
        [curriculumId, code, groupId],
      );
      // Leaving the curriculum would strand rules that name the course (UC-11 A5, prototype).
      if (!elsewhere) {
        const references = await rulesNaming(em, curriculumId, code);
        if (references.length) throw referencedItem(`${code} would leave the curriculum while its rules still name it; clear them first`, references);
      }
      await em.query('DELETE FROM "requirement_group_courses" WHERE "requirement_group_id" = $1 AND "course_code" = $2', [groupId, code]);
    });
  }

  // ---- Prerequisites -----------------------------------------------------------------------

  setPrerequisites(callerId: string, programId: string, curriculumId: string, rawCode: string, dto: SetPrerequisitesDto): Promise<PrerequisitesDto> {
    const code = courseCodeOr400(rawCode);
    const prerequisites = dto.prerequisites.map((p, i) => courseCodeOr400(p, `prerequisites[${i}]`));
    const repeated = prerequisites.filter((p, i) => prerequisites.indexOf(p) !== i);
    if (repeated.length) throw validationFailed(`prerequisites: ${[...new Set(repeated)].join(', ')} listed more than once`);
    return this.writes.run(callerId, { program: programId }, async (em) => {
      await curriculumIn(em, programId, curriculumId);
      const courses = await coursesOf(em, curriculumId);
      if (!courses.has(code)) throw notFound(`${code} is not a course of this curriculum`);
      const outside = prerequisites.filter((p) => !courses.has(p));
      if (outside.length) throw validationFailed(`prerequisites: ${outside.join(', ')} not a course of this curriculum; link it to a group first`);

      const edges: { course_code: string; prerequisite_code: string }[] = await em.query(
        'SELECT "course_code", "prerequisite_code" FROM "course_prerequisites" WHERE "curriculum_id" = $1',
        [curriculumId],
      );
      const graph = new Map<string, string[]>();
      for (const e of edges) graph.set(e.course_code, [...(graph.get(e.course_code) ?? []), e.prerequisite_code]);
      const cycle = findPrerequisiteCycle(graph, code, prerequisites);
      if (cycle) throw prerequisiteCycle(cycle);

      await em.query(
        `INSERT INTO "course_prerequisite_lists" ("curriculum_id", "course_code") VALUES ($1, $2)
         ON CONFLICT ("curriculum_id", "course_code") DO UPDATE SET "updated_at" = now()`,
        [curriculumId, code],
      );
      await em.query('DELETE FROM "course_prerequisites" WHERE "curriculum_id" = $1 AND "course_code" = $2', [curriculumId, code]);
      if (prerequisites.length) {
        await em.query(
          `INSERT INTO "course_prerequisites" ("curriculum_id", "course_code", "prerequisite_code")
           SELECT $1, $2, unnest($3::varchar[])`,
          [curriculumId, code, prerequisites],
        );
      }
      return { courseCode: code, prerequisites: [...prerequisites].sort(byText) };
    });
  }

  /** Back to "not recorded": the read API answers null again. */
  clearPrerequisites(callerId: string, programId: string, curriculumId: string, rawCode: string): Promise<PrerequisitesDto> {
    const code = courseCodeOr400(rawCode);
    return this.writes.run(callerId, { program: programId }, async (em) => {
      await curriculumIn(em, programId, curriculumId);
      // The list row cascades to its prerequisite rows.
      await em.query('DELETE FROM "course_prerequisite_lists" WHERE "curriculum_id" = $1 AND "course_code" = $2', [curriculumId, code]);
      return { courseCode: code, prerequisites: null };
    });
  }

  // ---- Offering terms ----------------------------------------------------------------------

  setOfferingTerms(callerId: string, programId: string, curriculumId: string, rawCode: string, dto: SetOfferingTermsDto): Promise<OfferingTermsDto> {
    const code = courseCodeOr400(rawCode);
    const terms = [...dto.terms].sort((a, b) => a - b);
    return this.writes.run(callerId, { program: programId }, async (em) => {
      await curriculumIn(em, programId, curriculumId);
      if (!(await coursesOf(em, curriculumId)).has(code)) throw notFound(`${code} is not a course of this curriculum`);
      await em.query('DELETE FROM "course_offering_terms" WHERE "curriculum_id" = $1 AND "course_code" = $2', [curriculumId, code]);
      await em.query(
        `INSERT INTO "course_offering_terms" ("curriculum_id", "course_code", "term_number") SELECT $1, $2, unnest($3::smallint[])`,
        [curriculumId, code, terms],
      );
      return { courseCode: code, terms };
    });
  }

  clearOfferingTerms(callerId: string, programId: string, curriculumId: string, rawCode: string): Promise<OfferingTermsDto> {
    const code = courseCodeOr400(rawCode);
    return this.writes.run(callerId, { program: programId }, async (em) => {
      await curriculumIn(em, programId, curriculumId);
      await em.query('DELETE FROM "course_offering_terms" WHERE "curriculum_id" = $1 AND "course_code" = $2', [curriculumId, code]);
      return { courseCode: code, terms: null };
    });
  }
}

/** The curriculum, only if it belongs to the path's program. */
async function curriculumIn(em: EntityManager, programId: string, curriculumId: string): Promise<void> {
  const [row] = await em.query('SELECT 1 FROM "curriculums" WHERE "id" = $1 AND "program_id" = $2', [curriculumId, programId]);
  if (!row) throw notFound('No such cohort in this program');
}

/** The group, only if it belongs to the path's curriculum, which belongs to the path's program. */
async function groupIn(em: EntityManager, programId: string, curriculumId: string, groupId: string): Promise<RequirementGroup> {
  await curriculumIn(em, programId, curriculumId);
  const group = await em.getRepository(RequirementGroup).findOneBy({ id: groupId, curriculumId });
  if (!group) throw notFound('No such requirement group in this cohort');
  return group;
}

async function assertGroupNameFree(em: EntityManager, curriculumId: string, name: string): Promise<void> {
  const [taken] = await em.query('SELECT 1 FROM "requirement_groups" WHERE "curriculum_id" = $1 AND "name" = $2', [curriculumId, name]);
  if (taken) throw conflict('duplicate_name', 'This cohort already has a requirement group with this name');
}

/** The codes linked to any group of the curriculum. */
async function coursesOf(em: EntityManager, curriculumId: string): Promise<Set<string>> {
  const rows: { course_code: string }[] = await em.query(
    `SELECT DISTINCT l."course_code" FROM "requirement_group_courses" l
     JOIN "requirement_groups" g ON g."id" = l."requirement_group_id" WHERE g."curriculum_id" = $1`,
    [curriculumId],
  );
  return new Set(rows.map((r) => r.course_code));
}

/** The recorded rules of the curriculum that name the course, in words. */
async function rulesNaming(em: EntityManager, curriculumId: string, code: string): Promise<string[]> {
  const [own] = await em.query('SELECT 1 FROM "course_prerequisite_lists" WHERE "curriculum_id" = $1 AND "course_code" = $2', [curriculumId, code]);
  const [offered] = await em.query('SELECT 1 FROM "course_offering_terms" WHERE "curriculum_id" = $1 AND "course_code" = $2 LIMIT 1', [curriculumId, code]);
  const dependents: { course_code: string }[] = await em.query(
    'SELECT "course_code" FROM "course_prerequisites" WHERE "curriculum_id" = $1 AND "prerequisite_code" = $2 ORDER BY "course_code"',
    [curriculumId, code],
  );
  return [
    ...(own ? [`prerequisites of ${code} are recorded`] : []),
    ...(offered ? [`offering terms of ${code} are recorded`] : []),
    ...dependents.map((d) => `${d.course_code} requires ${code}`),
  ];
}


function groupDto(g: RequirementGroup): RequirementGroupAdminDto {
  return {
    id: g.id,
    curriculumId: g.curriculumId,
    name: g.name,
    kind: g.kind,
    officialNotes: g.officialNotes,
    creditsTotal: g.creditsTotal,
    creditsTotalMin: g.creditsTotalMin,
    updatedAt: g.updatedAt,
  };
}
