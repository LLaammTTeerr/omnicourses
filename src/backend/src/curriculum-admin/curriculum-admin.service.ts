import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { conflict, notFound, validationFailed } from '../common/api-errors.js';
import { isRefusal, SQLSTATE } from '../common/failure-kind.js';
import { sentFields, trimmedOrNull } from '../common/field-validators.js';
import { RequirementGroup } from '../curriculum/requirement-group.entity.js';
import { prerequisiteCycle, referencedItem } from './admin-errors.js';
import { catalogHas, cohortIn, courseCodeOr400, groupIn, noCatalogCourse } from './admin-lookups.js';
import { AdminWriteService } from '../admin-access/admin-write.service.js';
import {
  AdminProgramDto,
  CreateRequirementGroupDto,
  OfferingTermsDto,
  PrerequisitesDto,
  RequirementGroupAdminDto,
  SetOfferingTermsDto,
  SetPrerequisitesDto,
  UpdateRequirementGroupDto,
  UserGrantsDto,
} from './curriculum-admin.dto.js';
import { userGrants } from './user-grants.js';
import { findPrerequisiteCycle } from './prerequisite-cycle.js';
import { REFERENCES } from './references.js';

const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const GROUP_FIELDS = ['name', 'kind', 'officialNotes'] as const;

@Injectable()
export class CurriculumAdminService {
  constructor(
    private readonly db: DataSource,
    private readonly writes: AdminWriteService,
  ) {}

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
    for (const row of rows) {
      const program = programs.get(row.id) ?? { id: row.id, code: row.code, nameVi: row.name_vi, curricula: [] };
      programs.set(row.id, program);
      if (row.curriculum_id) program.curricula.push({ id: row.curriculum_id, code: row.curriculum_code!, cohortYear: row.cohort_year! });
    }
    for (const program of programs.values()) program.curricula.sort((a, b) => a.cohortYear - b.cohortYear);
    return [...programs.values()].sort((a, b) => byText(a.code, b.code));
  }

  ownGrants(callerId: string): Promise<UserGrantsDto> {
    return userGrants(this.db.manager, callerId);
  }

  createGroup(callerId: string, programId: string, curriculumId: string, dto: CreateRequirementGroupDto): Promise<RequirementGroupAdminDto> {
    return this.writes.run(callerId, { program: programId }, async (em) => {
      await cohortIn(em, programId, curriculumId);
      await assertGroupNameFree(em, curriculumId, dto.name);
      const saved = await em.getRepository(RequirementGroup).save({ curriculumId, name: dto.name, kind: dto.kind, officialNotes: trimmedOrNull(dto.officialNotes) });
      return groupDto(await em.getRepository(RequirementGroup).findOneByOrFail({ id: saved.id }));
    });
  }

  updateGroup(callerId: string, programId: string, curriculumId: string, groupId: string, dto: UpdateRequirementGroupDto): Promise<RequirementGroupAdminDto> {
    return this.writes.run(callerId, { program: programId }, async (em) => {
      const group = await groupIn(em, programId, curriculumId, groupId);
      if (dto.name !== undefined && dto.name !== group.name) await assertGroupNameFree(em, curriculumId, dto.name);
      if (dto.kind !== undefined && dto.kind !== group.kind && (group.creditsTotal !== null || group.creditsTotalMin !== null)) {
        throw validationFailed('kind: cannot change while the group stores a credit total (ADR 0011: totals wait for the rule-engine handoff)');
      }
      const patch = sentFields(GROUP_FIELDS, dto, { officialNotes: trimmedOrNull }) as Partial<RequirementGroup>;
      if (Object.keys(patch).length) await em.getRepository(RequirementGroup).update({ id: groupId }, patch);
      return groupDto(await em.getRepository(RequirementGroup).findOneByOrFail({ id: groupId }));
    });
  }

  deleteGroup(callerId: string, programId: string, curriculumId: string, groupId: string): Promise<void> {
    return this.writes.run(callerId, { program: programId }, async (em) => {
      await groupIn(em, programId, curriculumId, groupId);
      await em.query('SELECT 1 FROM "requirement_groups" WHERE "id" = $1 FOR UPDATE', [groupId]);
      const links: { course_code: string }[] = await em.query(
        'SELECT "course_code" FROM "requirement_group_courses" WHERE "requirement_group_id" = $1 ORDER BY "course_code"',
        [groupId],
      );
      if (links.length) throw referencedItem('The group still links courses; remove them from it first', links.map((link) => REFERENCES.links(link.course_code)));
      const [{ n: plans }]: { n: number }[] = await em.query(
        'SELECT count(DISTINCT "plan_id")::int AS "n" FROM "plan_placements" WHERE "requirement_group_id" = $1',
        [groupId],
      );
      if (plans) throw plansUseGroup([REFERENCES.groupPlans(plans)]);
      const overflows: { from_group_id: string; to_group_id: string }[] = await em.query(
        'SELECT "from_group_id", "to_group_id" FROM "requirement_group_overflows" WHERE "from_group_id" = $1 OR "to_group_id" = $1',
        [groupId],
      );
      const combinedMinimums: { combined_minimum_id: string }[] = await em.query(
        'SELECT "combined_minimum_id" FROM "combined_minimum_groups" WHERE "requirement_group_id" = $1',
        [groupId],
      );
      const ruleReferences = [
        ...(overflows.length ? [REFERENCES.groupOverflows(overflows.length)] : []),
        ...(combinedMinimums.length ? [REFERENCES.groupCombinedMinimums(combinedMinimums.length)] : []),
      ];
      if (ruleReferences.length) {
        throw referencedItem(
          'Curriculum rules still reference this requirement group; keep it while overflow or combined-minimum rules name it',
          ruleReferences,
        );
      }
      try {
        await em.query('DELETE FROM "requirement_groups" WHERE "id" = $1', [groupId]);
      } catch (error) {
        if (isPlanSlotRefusal(error)) throw plansUseGroup([REFERENCES.groupPlans(null)]);
        const ruleReference = groupRuleRefusalReference(error);
        if (ruleReference) {
          throw referencedItem(
            'Curriculum rules still reference this requirement group; keep it while overflow or combined-minimum rules name it',
            [ruleReference],
          );
        }
        throw error;
      }
    });
  }

  linkCourse(callerId: string, programId: string, curriculumId: string, groupId: string, rawCode: string): Promise<void> {
    const code = courseCodeOr400(rawCode);
    return this.writes.run(callerId, { program: programId }, async (em) => {
      await groupIn(em, programId, curriculumId, groupId);
      if (!(await catalogHas(em, code))) throw notFound(noCatalogCourse(code));
      await this.insertLink(em, groupId, code);
    });
  }

  async insertLink(em: EntityManager, groupId: string, code: string): Promise<void> {
    await em.query('INSERT INTO "requirement_group_courses" ("requirement_group_id", "course_code") VALUES ($1, $2) ON CONFLICT DO NOTHING', [groupId, code]);
  }

  unlinkCourse(callerId: string, programId: string, curriculumId: string, groupId: string, rawCode: string): Promise<void> {
    const code = courseCodeOr400(rawCode);
    return this.writes.run(callerId, { program: programId }, async (em) => {
      await groupIn(em, programId, curriculumId, groupId);
      const [link]: { counts_toward_total?: boolean; counts_toward_gpa?: boolean }[] = await em.query(
        'SELECT "counts_toward_total", "counts_toward_gpa" FROM "requirement_group_courses" WHERE "requirement_group_id" = $1 AND "course_code" = $2',
        [groupId, code],
      );
      if (!link) throw notFound(`${code} is not in this group`);
      if (link.counts_toward_total === false || link.counts_toward_gpa === false) {
        throw referencedItem(
          `${code} carries non-default GPA or credit-counting rules that cannot be re-entered through administration yet`,
          [REFERENCES.countingRule(code)],
        );
      }
      const [elsewhere] = await em.query(
        `SELECT 1 FROM "requirement_group_courses" l JOIN "requirement_groups" g ON g."id" = l."requirement_group_id"
         WHERE g."curriculum_id" = $1 AND l."course_code" = $2 AND l."requirement_group_id" <> $3`,
        [curriculumId, code, groupId],
      );
      if (!elsewhere) {
        const references = await rulesNaming(em, curriculumId, code);
        if (references.length) throw referencedItem(`${code} would leave the curriculum while its rules still name it; clear them first`, references);
      }
      await em.query('DELETE FROM "requirement_group_courses" WHERE "requirement_group_id" = $1 AND "course_code" = $2', [groupId, code]);
    });
  }

  setPrerequisites(callerId: string, programId: string, curriculumId: string, rawCode: string, dto: SetPrerequisitesDto): Promise<PrerequisitesDto> {
    const code = courseCodeOr400(rawCode);
    const prerequisites = prerequisiteCodes(dto.prerequisites);
    return this.writes.run(callerId, { program: programId }, async (em) => {
      await cohortIn(em, programId, curriculumId);
      await assertCurriculumCourses(em, curriculumId, code, prerequisites);
      const cycle = findPrerequisiteCycle(await prerequisiteGraph(em, curriculumId), code, prerequisites);
      if (cycle) throw prerequisiteCycle(cycle);
      await savePrerequisites(em, curriculumId, code, prerequisites);
      return { courseCode: code, prerequisites: [...prerequisites].sort(byText) };
    });
  }

  clearPrerequisites(callerId: string, programId: string, curriculumId: string, rawCode: string): Promise<PrerequisitesDto> {
    const code = courseCodeOr400(rawCode);
    return this.writes.run(callerId, { program: programId }, async (em) => {
      await cohortIn(em, programId, curriculumId);
      await em.query('DELETE FROM "course_prerequisite_lists" WHERE "curriculum_id" = $1 AND "course_code" = $2', [curriculumId, code]);
      return { courseCode: code, prerequisites: null };
    });
  }

  setOfferingTerms(callerId: string, programId: string, curriculumId: string, rawCode: string, dto: SetOfferingTermsDto): Promise<OfferingTermsDto> {
    const code = courseCodeOr400(rawCode);
    const terms = [...dto.terms].sort((a, b) => a - b);
    return this.writes.run(callerId, { program: programId }, async (em) => {
      await cohortIn(em, programId, curriculumId);
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
      await cohortIn(em, programId, curriculumId);
      await em.query('DELETE FROM "course_offering_terms" WHERE "curriculum_id" = $1 AND "course_code" = $2', [curriculumId, code]);
      return { courseCode: code, terms: null };
    });
  }
}

async function assertGroupNameFree(em: EntityManager, curriculumId: string, name: string): Promise<void> {
  const [taken] = await em.query('SELECT 1 FROM "requirement_groups" WHERE "curriculum_id" = $1 AND "name" = $2', [curriculumId, name]);
  if (taken) throw conflict('duplicate_name', 'This cohort already has a requirement group with this name');
}

async function coursesOf(em: EntityManager, curriculumId: string): Promise<Set<string>> {
  const rows: { course_code: string }[] = await em.query(
    `SELECT DISTINCT l."course_code" FROM "requirement_group_courses" l
     JOIN "requirement_groups" g ON g."id" = l."requirement_group_id" WHERE g."curriculum_id" = $1`,
    [curriculumId],
  );
  return new Set(rows.map((row) => row.course_code));
}

async function rulesNaming(em: EntityManager, curriculumId: string, code: string): Promise<string[]> {
  const [own] = await em.query('SELECT 1 FROM "course_prerequisite_lists" WHERE "curriculum_id" = $1 AND "course_code" = $2', [curriculumId, code]);
  const [offered] = await em.query('SELECT 1 FROM "course_offering_terms" WHERE "curriculum_id" = $1 AND "course_code" = $2 LIMIT 1', [curriculumId, code]);
  const dependents: { course_code: string }[] = await em.query(
    'SELECT "course_code" FROM "course_prerequisites" WHERE "curriculum_id" = $1 AND "prerequisite_code" = $2 ORDER BY "course_code"',
    [curriculumId, code],
  );
  return [
    ...(own ? [REFERENCES.ownPrerequisites(code)] : []),
    ...(offered ? [REFERENCES.ownTerms(code)] : []),
    ...dependents.map((dependent) => REFERENCES.requires(dependent.course_code, code)),
  ];
}

function prerequisiteCodes(sent: string[]): string[] {
  const prerequisites = sent.map((p, i) => courseCodeOr400(p, `prerequisites[${i}]`));
  const repeated = prerequisites.filter((p, i) => prerequisites.indexOf(p) !== i);
  if (repeated.length) throw validationFailed(`prerequisites: ${[...new Set(repeated)].join(', ')} listed more than once`);
  return prerequisites;
}

async function assertCurriculumCourses(em: EntityManager, curriculumId: string, code: string, prerequisites: string[]): Promise<void> {
  const courses = await coursesOf(em, curriculumId);
  if (!courses.has(code)) throw notFound(`${code} is not a course of this curriculum`);
  const outside = prerequisites.filter((p) => !courses.has(p));
  if (outside.length) throw validationFailed(`prerequisites: ${outside.join(', ')} not a course of this curriculum; link it to a group first`);
}

async function prerequisiteGraph(em: EntityManager, curriculumId: string): Promise<Map<string, string[]>> {
  const edges: { course_code: string; prerequisite_code: string }[] = await em.query(
    'SELECT "course_code", "prerequisite_code" FROM "course_prerequisites" WHERE "curriculum_id" = $1',
    [curriculumId],
  );
  const graph = new Map<string, string[]>();
  for (const edge of edges) graph.set(edge.course_code, [...(graph.get(edge.course_code) ?? []), edge.prerequisite_code]);
  return graph;
}

async function savePrerequisites(em: EntityManager, curriculumId: string, code: string, prerequisites: string[]): Promise<void> {
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
}

const PLAN_SLOT_GROUP_KEY = 'plan_placements_requirement_group_id_fkey';
const OVERFLOW_FROM_GROUP_KEY = 'requirement_group_overflows_from_group_id_fkey';
const OVERFLOW_TO_GROUP_KEY = 'requirement_group_overflows_to_group_id_fkey';
const COMBINED_MINIMUM_GROUP_KEY = 'combined_minimum_groups_requirement_group_id_fkey';

const plansUseGroup = (references: string[]) => referencedItem('Saved plans use the group; it stays while they name it', references);

export function isPlanSlotRefusal(error: unknown): boolean {
  return isRefusal(error, [SQLSTATE.restrictViolation, SQLSTATE.foreignKeyViolation], PLAN_SLOT_GROUP_KEY);
}

function groupRuleRefusalReference(error: unknown): string | null {
  const states = [SQLSTATE.restrictViolation, SQLSTATE.foreignKeyViolation];
  if (isRefusal(error, states, OVERFLOW_FROM_GROUP_KEY) || isRefusal(error, states, OVERFLOW_TO_GROUP_KEY)) {
    return REFERENCES.groupOverflows(null);
  }
  if (isRefusal(error, states, COMBINED_MINIMUM_GROUP_KEY)) {
    return REFERENCES.groupCombinedMinimums(null);
  }
  return null;
}

function groupDto(group: RequirementGroup): RequirementGroupAdminDto {
  return {
    id: group.id,
    curriculumId: group.curriculumId,
    name: group.name,
    kind: group.kind,
    officialNotes: group.officialNotes,
    creditsTotal: group.creditsTotal,
    creditsTotalMin: group.creditsTotalMin,
    updatedAt: group.updatedAt,
  };
}
