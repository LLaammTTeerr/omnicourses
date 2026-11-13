import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import type { CurriculumRules } from '../rules/inputs.js';
import { CombinedMinimum } from './combined-minimum.entity.js';
import { Curriculum } from './curriculum.entity.js';
import { RequirementGroupOverflow } from './requirement-group-overflow.entity.js';

// Reads the rule engine's view of one curriculum (ADR 0013, `rules/inputs.ts`). It decides
// nothing (AGENTS.md hard rule 1).

/** Code-point order: the same on every machine, unlike a locale collation. */
const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

@Injectable()
export class CurriculumRulesReader {
  constructor(
    @InjectRepository(Curriculum) private readonly curriculums: Repository<Curriculum>,
    @InjectRepository(CombinedMinimum) private readonly minimums: Repository<CombinedMinimum>,
    @InjectRepository(RequirementGroupOverflow) private readonly overflows: Repository<RequirementGroupOverflow>,
  ) {}

  /** The rules of one cohort's curriculum, or null when the program has no curriculum for it. */
  async rulesFor(programCode: string, cohortYear: number): Promise<CurriculumRules | null> {
    if (!Number.isInteger(cohortYear)) return null;
    return this.load({ cohortYear, program: { code: programCode } });
  }

  /** The rules of the curriculum with this id (a plan's own curriculum), or null. */
  async rulesForId(id: string): Promise<CurriculumRules | null> {
    return this.load({ id });
  }

  private async load(where: FindOptionsWhere<Curriculum>): Promise<CurriculumRules | null> {
    const row = await this.curriculums.findOne({ where, relations: { program: true, requirementGroups: { courseLinks: { course: true } } } });
    if (!row) return null;
    const groupIds = row.requirementGroups.map((g) => g.id);
    const [minimums, overflows] = await Promise.all([
      this.minimums.find({ where: { curriculumId: row.id }, relations: { groupLinks: true } }),
      groupIds.length ? this.overflows.find({ where: { fromGroupId: In(groupIds) } }) : Promise.resolve([]),
    ]);
    const overflowTo = new Map(overflows.map((o) => [o.fromGroupId, o.toGroupId]));
    return {
      programCode: row.program.code,
      trainingType: row.program.trainingType,
      cohortYear: row.cohortYear,
      curriculumCode: row.code,
      totalCreditsMin: row.totalCreditsMin,
      groups: row.requirementGroups
        .map((g) => ({
          id: g.id,
          name: g.name,
          kind: g.kind,
          creditsTotal: g.creditsTotal,
          creditsTotalMin: g.creditsTotalMin,
          overflowToGroupId: overflowTo.get(g.id) ?? null,
          courses: g.courseLinks
            .map((l) => ({
              code: l.course.code,
              nameVi: l.course.nameVi,
              nameEn: l.course.nameEn,
              credits: l.course.credits,
              countsTowardTotal: l.countsTowardTotal,
              countsTowardGpa: l.countsTowardGpa,
            }))
            .sort((a, b) => byText(a.code, b.code)),
        }))
        .sort((a, b) => byText(a.name, b.name) || byText(a.id, b.id)),
      combinedMinimums: minimums
        .map((m) => ({
          id: m.id,
          name: m.name,
          creditsMin: m.creditsMin,
          officialNotes: m.officialNotes,
          groupIds: m.groupLinks.map((l) => l.requirementGroupId).sort(byText),
        }))
        .sort((a, b) => byText(a.name, b.name) || byText(a.id, b.id)),
    };
  }
}
