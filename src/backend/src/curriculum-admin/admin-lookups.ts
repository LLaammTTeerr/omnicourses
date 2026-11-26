import type { EntityManager } from 'typeorm';
import { conflict, notFound, validationFailed } from '../common/api-errors.js';
import { canonicalCourseCode } from '../common/course-code.js';
import { Curriculum } from '../curriculum/curriculum.entity.js';
import { Program } from '../curriculum/program.entity.js';
import { RequirementGroup } from '../curriculum/requirement-group.entity.js';

const NO_ACCOUNT = 'No account has this ID';
const NO_PROGRAM = 'No program has this ID';
const NO_COHORT = 'No such cohort in this program';
const NO_GROUP = 'No such requirement group in this cohort';

export const noCatalogCode = (code: string): string => `No catalog course has the code ${code}`;

/** What a link answers when the catalog lacks the course: linking never creates one. */
export const noCatalogCourse = (code: string): string => `${noCatalogCode(code)}; a catalog maintainer adds it first`;

/** A course code as an administrator gave it, canonical (UC-11 step 5), or why it is not one. */
export function parseCourseCode(input: string): { code: string; error: null } | { code: null; error: string } {
  const code = canonicalCourseCode(input);
  return code ? { code, error: null } : { code: null, error: `"${input}" is not a course code (letters A-Z and digits, 2 to 20)` };
}

/** A course code from a path or body, canonical, or a 400. */
export function courseCodeOr400(input: string, field = 'courseCode'): string {
  const parsed = parseCourseCode(input);
  if (parsed.error !== null) throw validationFailed(`${field}: ${parsed.error}`);
  return parsed.code;
}

/** Selecting a catalog course is not permission to change it (ADR 0011). */
export async function catalogHas(em: EntityManager, code: string): Promise<boolean> {
  const [course] = await em.query('SELECT 1 FROM "courses" WHERE "code" = $1', [code]);
  return Boolean(course);
}

/** The program of the path. A grant references its program, so a caller who passed the grant check always finds it. */
export async function programIn(em: EntityManager, programId: string): Promise<Program> {
  const program = await em.getRepository(Program).findOneBy({ id: programId });
  if (!program) throw notFound(NO_PROGRAM);
  return program;
}

/** The cohort, only if it belongs to the path's program. */
export async function cohortIn(em: EntityManager, programId: string, curriculumId: string): Promise<Curriculum> {
  const cohort = await em.getRepository(Curriculum).findOneBy({ id: curriculumId, programId });
  if (!cohort) throw notFound(NO_COHORT);
  return cohort;
}

/** The group, only if it belongs to the path's curriculum, which belongs to the path's program. */
export async function groupIn(em: EntityManager, programId: string, curriculumId: string, groupId: string): Promise<RequirementGroup> {
  await cohortIn(em, programId, curriculumId);
  const group = await em.getRepository(RequirementGroup).findOneBy({ id: groupId, curriculumId });
  if (!group) throw notFound(NO_GROUP);
  return group;
}

export async function assertAccountExists(em: EntityManager, userId: string): Promise<void> {
  if (!(await em.query('SELECT 1 FROM "users" WHERE "id" = $1', [userId])).length) throw notFound(NO_ACCOUNT);
}

export async function assertActiveRecipient(em: EntityManager, userId: string): Promise<void> {
  const [user]: { deletion_requested_at: Date | null }[] = await em.query('SELECT "deletion_requested_at" FROM "users" WHERE "id" = $1', [userId]);
  if (!user) throw notFound(NO_ACCOUNT);
  if (user.deletion_requested_at) throw conflict('recipient_deletion_pending', 'That account is waiting for deletion');
}
