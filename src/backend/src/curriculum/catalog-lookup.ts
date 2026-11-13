import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { isCourseCode } from '../common/course-code.js';
import { Course } from './course.entity.js';
import { Curriculum } from './curriculum.entity.js';
import { curriculumWhere } from './curriculum-query.js';

// Bulk lookups other modules make against the catalog and the curricula, one query each for a
// whole plan at once: the planner checks a board's references, the rule engine reads catalog
// credits. It decides nothing (AGENTS.md hard rule 1).
@Injectable()
export class CatalogLookup {
  constructor(
    @InjectRepository(Curriculum) private readonly curriculums: Repository<Curriculum>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
  ) {}

  /** The id of the curriculum of one cohort of a program, or null when there is none. */
  async curriculumIdOf(programCode: string, cohortYear: number): Promise<string | null> {
    const where = curriculumWhere({ programCode, cohortYear });
    if (!where) return null;
    const row = await this.curriculums.findOne({ select: { id: true }, where });
    return row?.id ?? null;
  }

  /** The codes among these that the catalog has, in one query (a whole plan at once). Codes must be exact (ADR 0007). */
  async knownCourseCodes(codes: readonly string[]): Promise<Set<string>> {
    const wellFormed = [...new Set(codes)].filter(isCourseCode);
    if (!wellFormed.length) return new Set();
    const rows = await this.courses.find({ select: { code: true }, where: { code: In(wellFormed) } });
    return new Set(rows.map((c) => c.code));
  }

  /** Catalog credits by code for the codes among these that the catalog has, in one query (a whole plan at once). */
  async courseCredits(codes: readonly string[]): Promise<Map<string, number>> {
    const wellFormed = [...new Set(codes)].filter(isCourseCode);
    if (!wellFormed.length) return new Map();
    const rows = await this.courses.find({ select: { code: true, credits: true }, where: { code: In(wellFormed) } });
    return new Map(rows.map((c) => [c.code, c.credits]));
  }

  /** The ids of the requirement groups of one curriculum; empty when there is none. */
  async requirementGroupIds(curriculumId: string): Promise<Set<string>> {
    const row = await this.curriculums.findOne({ select: { id: true, requirementGroups: { id: true } }, where: { id: curriculumId }, relations: { requirementGroups: true } });
    return new Set(row?.requirementGroups.map((g) => g.id) ?? []);
  }
}
