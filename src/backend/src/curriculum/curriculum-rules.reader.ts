import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { CurriculumRules } from '../rules/inputs.js';
import { CombinedMinimum } from './combined-minimum.entity.js';
import { Curriculum } from './curriculum.entity.js';
import { type CurriculumKey, loadCurriculum } from './curriculum-query.js';
import { RequirementGroupOverflow } from './requirement-group-overflow.entity.js';

// Reads the rule engine's view of one curriculum (ADR 0013, `rules/inputs.ts`), in no particular
// order: the engine orders what it returns. It decides nothing (AGENTS.md hard rule 1).

@Injectable()
export class CurriculumRulesReader {
  constructor(
    @InjectRepository(Curriculum) private readonly curriculums: Repository<Curriculum>,
    @InjectRepository(CombinedMinimum) private readonly minimums: Repository<CombinedMinimum>,
    @InjectRepository(RequirementGroupOverflow) private readonly overflows: Repository<RequirementGroupOverflow>,
  ) {}

  /** The rules of one cohort's curriculum, or null when the program has no curriculum for it. */
  async rulesFor(programCode: string, cohortYear: number): Promise<CurriculumRules | null> {
    return this.load({ programCode, cohortYear });
  }

  /** The rules of the curriculum with this id (a plan's own curriculum), or null. */
  async rulesForId(id: string): Promise<CurriculumRules | null> {
    return this.load({ id });
  }

  private async load(key: CurriculumKey): Promise<CurriculumRules | null> {
    const row = await loadCurriculum(this.curriculums, key);
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
      groups: row.requirementGroups.map((g) => ({
        id: g.id,
        name: g.name,
        kind: g.kind,
        creditsTotal: g.creditsTotal,
        creditsTotalMin: g.creditsTotalMin,
        overflowToGroupId: overflowTo.get(g.id) ?? null,
        courses: g.courseLinks.map((l) => ({
          code: l.course.code,
          nameVi: l.course.nameVi,
          nameEn: l.course.nameEn,
          credits: l.course.credits,
          countsTowardTotal: l.countsTowardTotal,
          countsTowardGpa: l.countsTowardGpa,
        })),
      })),
      combinedMinimums: minimums.map((m) => ({
        id: m.id,
        name: m.name,
        creditsMin: m.creditsMin,
        officialNotes: m.officialNotes,
        groupIds: m.groupLinks.map((l) => l.requirementGroupId),
      })),
    };
  }
}
