import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CombinedMinimum } from './combined-minimum.entity.js';
import { Curriculum } from './curriculum.entity.js';
import type { TrainingType } from './program.entity.js';
import { RequirementGroupOverflow } from './requirement-group-overflow.entity.js';
import type { RequirementGroupKind } from './requirement-group.entity.js';

// What the rule engine reads about one curriculum (ADR 0013): plain data, no entity, so the rule
// functions stay pure and a test builds one by hand. It decides nothing (AGENTS.md hard rule 1).

export interface CurriculumRuleCourse {
  code: string;
  nameVi: string;
  nameEn: string | null;
  /** Catalog credits. */
  credits: number;
  /** false: required but outside the cohort total (GDTC, GDQP-AN). */
  countsTowardTotal: boolean;
  /** false: left out of the GPA (QĐ 1175/QĐ-KHTN Điều 15.1.c). */
  countsTowardGpa: boolean;
}

export interface CurriculumRuleGroup {
  id: string;
  name: string;
  kind: RequirementGroupKind;
  creditsTotal: number | null;
  creditsTotalMin: number | null;
  /** The group that this group's credits beyond its own minimum count toward, or null. */
  overflowToGroupId: string | null;
  courses: CurriculumRuleCourse[];
}

export interface CurriculumRuleCombinedMinimum {
  id: string;
  name: string;
  creditsMin: number;
  officialNotes: string | null;
  groupIds: string[];
}

export interface CurriculumRules {
  programCode: string;
  trainingType: TrainingType | null;
  cohortYear: number;
  curriculumCode: string;
  totalCreditsMin: number | null;
  /** By name, then id (code-point order). */
  groups: CurriculumRuleGroup[];
  /** By name, then id. */
  combinedMinimums: CurriculumRuleCombinedMinimum[];
}

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
    const row = await this.curriculums.findOne({
      where: { cohortYear, program: { code: programCode } },
      relations: { program: true, requirementGroups: { courseLinks: { course: true } } },
    });
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
