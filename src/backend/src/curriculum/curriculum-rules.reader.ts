import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type FindOptionsWhere, In, Repository } from 'typeorm';
import { byText, groupBy } from '../common/collections.js';
import { asTermNumber, type Term } from '../terms/term.js';
import { CombinedMinimum } from './combined-minimum.entity.js';
import { CourseOfferingTerm, CoursePrerequisiteList } from './course-rules.entities.js';
import { Curriculum } from './curriculum.entity.js';
import type { TrainingType } from './program.entity.js';
import { type RequirementGroup, type RequirementGroupCourse, RequirementGroupOverflow, type RequirementGroupKind } from './requirement-group.entity.js';

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

interface CurriculumRuleCombinedMinimum {
  id: string;
  name: string;
  creditsMin: number;
  officialNotes: string | null;
  groupIds: string[];
}

/**
 * The prerequisites and offering terms recorded for the courses of one curriculum. A course
 * absent from a map has nothing recorded: callers must read that as unknown, not as none.
 */
export interface CourseRules {
  /** Course code → its prerequisite codes, sorted; [] when "none" was recorded. */
  prerequisites: Map<string, string[]>;
  /** Course code → the term numbers it is offered in, ascending; never empty. */
  offeringTerms: Map<string, Term['number'][]>;
}

export interface CurriculumRules extends CourseRules {
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

const byNameThenId = (a: { name: string; id: string }, b: { name: string; id: string }): number => byText(a.name, b.name) || byText(a.id, b.id);

export function cohortCurriculum(programCode: string, cohortYear: number): FindOptionsWhere<Curriculum> | null {
  if (!Number.isInteger(cohortYear)) return null;
  return { cohortYear, program: { code: programCode } };
}

// Read side of the F12 prerequisite and offering-term tables (ADR 0011, amended 9 November
// 2026). The rule engine reads these; it decides what they mean (AGENTS.md hard rule 1).
@Injectable()
export class CurriculumRulesReader {
  constructor(
    @InjectRepository(Curriculum) private readonly curriculums: Repository<Curriculum>,
    @InjectRepository(CombinedMinimum) private readonly minimums: Repository<CombinedMinimum>,
    @InjectRepository(RequirementGroupOverflow) private readonly overflows: Repository<RequirementGroupOverflow>,
    @InjectRepository(CoursePrerequisiteList) private readonly lists: Repository<CoursePrerequisiteList>,
    @InjectRepository(CourseOfferingTerm) private readonly offerings: Repository<CourseOfferingTerm>,
  ) {}

  /** The rules of one cohort's curriculum, or null when the program has no curriculum for it. */
  async rulesFor(curriculumId: string): Promise<CurriculumRules | null> {
    const row = await this.curriculums.findOne({
      where: { id: curriculumId },
      relations: { program: true, requirementGroups: { courseLinks: { course: true } } },
    });
    if (!row) return null;
    const [minimums, overflowTo, courseRules] = await Promise.all([
      this.minimums.find({ where: { curriculumId: row.id }, relations: { groupLinks: true } }),
      this.overflowTargets(row.requirementGroups),
      this.courseRules(row.id),
    ]);
    return {
      programCode: row.program.code,
      trainingType: row.program.trainingType,
      cohortYear: row.cohortYear,
      curriculumCode: row.code,
      totalCreditsMin: row.totalCreditsMin,
      groups: row.requirementGroups.map((g) => toRuleGroup(g, overflowTo)).sort(byNameThenId),
      combinedMinimums: minimums.map(toRuleCombinedMinimum).sort(byNameThenId),
      ...courseRules,
    };
  }

  async courseRules(curriculumId: string): Promise<CourseRules> {
    const [lists, offerings] = await Promise.all([
      this.lists.find({ where: { curriculumId }, relations: { prerequisites: true } }),
      this.offerings.find({ where: { curriculumId } }),
    ]);
    const prerequisites = new Map(lists.map((l) => [l.courseCode, l.prerequisites.map((p) => p.prerequisiteCode).sort(byText)]));
    const offeringTerms = new Map(
      [...groupBy(offerings, (o) => o.courseCode)].map(([code, rows]) => [code, rows.map((o) => asTermNumber(o.termNumber)).sort((a, b) => a - b)]),
    );
    return { prerequisites, offeringTerms };
  }

  private async overflowTargets(groups: readonly RequirementGroup[]): Promise<Map<string, string>> {
    if (!groups.length) return new Map();
    const overflows = await this.overflows.find({ where: { fromGroupId: In(groups.map((g) => g.id)) } });
    return new Map(overflows.map((o) => [o.fromGroupId, o.toGroupId]));
  }
}

function toRuleCourse(link: RequirementGroupCourse): CurriculumRuleCourse {
  return {
    code: link.course.code,
    nameVi: link.course.nameVi,
    nameEn: link.course.nameEn,
    credits: link.course.credits,
    countsTowardTotal: link.countsTowardTotal,
    countsTowardGpa: link.countsTowardGpa,
  };
}

function toRuleGroup(group: RequirementGroup, overflowTo: ReadonlyMap<string, string>): CurriculumRuleGroup {
  return {
    id: group.id,
    name: group.name,
    kind: group.kind,
    creditsTotal: group.creditsTotal,
    creditsTotalMin: group.creditsTotalMin,
    overflowToGroupId: overflowTo.get(group.id) ?? null,
    courses: group.courseLinks.map(toRuleCourse).sort((a, b) => byText(a.code, b.code)),
  };
}

function toRuleCombinedMinimum(minimum: CombinedMinimum): CurriculumRuleCombinedMinimum {
  return {
    id: minimum.id,
    name: minimum.name,
    creditsMin: minimum.creditsMin,
    officialNotes: minimum.officialNotes,
    groupIds: minimum.groupLinks.map((l) => l.requirementGroupId).sort(byText),
  };
}
