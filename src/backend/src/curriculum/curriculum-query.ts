import type { FindOptionsWhere, Repository } from 'typeorm';
import { Curriculum } from './curriculum.entity.js';

/** One curriculum: by its id, or as the curriculum of one cohort of a program (`uq_curriculums_program_cohort`). */
export type CurriculumKey = { id: string } | { programCode: string; cohortYear: number };

/** The filter for one curriculum, or null when no curriculum can match (a cohort that is not a whole year). */
export function curriculumWhere(key: CurriculumKey): FindOptionsWhere<Curriculum> | null {
  if ('id' in key) return { id: key.id };
  return Number.isInteger(key.cohortYear) ? { cohortYear: key.cohortYear, program: { code: key.programCode } } : null;
}

/**
 * The curriculum with its program and its groups' course links: the graph the explorer (F4) and
 * the rule engine's reader both read. Null when there is none.
 */
export async function loadCurriculum(curriculums: Repository<Curriculum>, key: CurriculumKey): Promise<Curriculum | null> {
  const where = curriculumWhere(key);
  if (!where) return null;
  return curriculums.findOne({ where, relations: { program: true, requirementGroups: { courseLinks: { course: true } } } });
}
