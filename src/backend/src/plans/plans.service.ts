import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CurriculumService } from '../curriculum/curriculum.service.js';
import { TermDto } from '../terms/term.dto.js';
import { compareTerms, termFromColumns, termKey } from '../terms/term.js';
import { BoardTerm, boardProblems, courseCodesOf, groupIdsOf, Placement, toBoard, toRows, withPlacement } from './plan-board.js';
import { PlanPlacement } from './plan-placement.entity.js';
import { Plan } from './plan.entity.js';
import { PlanDto, PlanListItemDto, PlanPreviewDto, PlanSummaryDto } from './plans.dto.js';

/** The answer for a plan that is missing or someone else's: the same, so it reveals nothing. */
const notFound = () => new NotFoundException('No plan with this id');

// A student's plans (F5, ADR 0014): the placements they saved, nothing more. It decides no
// academic rule (AGENTS.md hard rule 1): a plan that breaks one is saved as it is, and the rule
// engine reports the violation (ADR 0012) through PlanIssuesProvider (plan-issues.ts).
// Every read and write is scoped to the owner: another student's plan is a 404, never a 403.
@Injectable()
export class PlansService {
  constructor(
    private readonly db: DataSource,
    @InjectRepository(Plan) private readonly plans: Repository<Plan>,
    @InjectRepository(PlanPlacement) private readonly placements: Repository<PlanPlacement>,
    private readonly curriculum: CurriculumService,
  ) {}

  /** The student's plans, oldest first, each with a preview of its placements. */
  async list(userId: string): Promise<PlanListItemDto[]> {
    const rows = await this.plans.find({ where: { userId }, relations: { curriculum: { program: true } }, order: { createdAt: 'ASC', id: 'ASC' } });
    const placements = await this.placements.find({ where: { userId }, select: { planId: true, termYear: true, termNumber: true, courseCode: true } });
    const byPlan = new Map<string, PlanPlacement[]>();
    for (const p of placements) byPlan.set(p.planId, [...(byPlan.get(p.planId) ?? []), p]);
    return rows.map((plan) => ({ ...summary(plan), preview: preview(byPlan.get(plan.id) ?? []) }));
  }

  /** One of the student's plans with its placements, or a 404. */
  async get(userId: string, planId: string): Promise<PlanDto> {
    const plan = await this.plans.findOne({ where: { id: planId, userId }, relations: { curriculum: { program: true } } });
    if (!plan) throw notFound();
    const rows = await this.placements.find({ where: { planId } });
    return { ...summary(plan), terms: toBoard(rows) };
  }

  /** A new plan against the curriculum of one cohort, empty or with a whole board (UC-07 step 10). */
  async create(userId: string, input: { name: string; programCode: string; cohortYear: number; terms?: BoardTerm[] }): Promise<PlanDto> {
    const curriculumId = await this.curriculum.findCurriculumId(input.programCode, input.cohortYear);
    if (!curriculumId) throw new BadRequestException('No curriculum for this program and cohort');
    const terms = input.terms ?? [];
    await this.checkBoard(curriculumId, terms);
    const id = await this.db.transaction(async (tx) => {
      const { identifiers } = await tx.insert(Plan, { userId, curriculumId, name: input.name });
      const planId = identifiers[0].id as string;
      await insertBoard(tx, planId, userId, terms);
      return planId;
    });
    return this.get(userId, id);
  }

  async rename(userId: string, planId: string, name: string): Promise<PlanDto> {
    const { affected } = await this.plans.update({ id: planId, userId }, { name });
    if (!affected) throw notFound();
    return this.get(userId, planId);
  }

  /** A copy with the same curriculum and placements, for trying a change (UC-05 A6, a what-if copy for UC-06). */
  async duplicate(userId: string, planId: string, name?: string): Promise<PlanDto> {
    const id = await this.db.transaction(async (tx) => {
      // FOR SHARE: a save of the original in progress finishes first, so the copy is never half of it.
      const [source] = await tx.query('SELECT "curriculum_id", "name" FROM "plans" WHERE "id" = $1 AND "user_id" = $2 FOR SHARE', [planId, userId]);
      if (!source) throw notFound();
      const { identifiers } = await tx.insert(Plan, { userId, curriculumId: source.curriculum_id, name: name ?? source.name });
      const copyId = identifiers[0].id as string;
      await tx.query(
        `INSERT INTO "plan_placements" ("plan_id", "user_id", "term_year", "term_number", "position", "course_code", "requirement_group_id", "slot_credits")
         SELECT $1, "user_id", "term_year", "term_number", "position", "course_code", "requirement_group_id", "slot_credits"
         FROM "plan_placements" WHERE "plan_id" = $2`,
        [copyId, planId],
      );
      return copyId;
    });
    return this.get(userId, id);
  }

  /** Replaces every placement of the plan with the board the planner sends, all or nothing. */
  async replacePlacements(userId: string, planId: string, terms: BoardTerm[]): Promise<PlanDto> {
    await this.db.transaction(async (tx) => {
      // Ownership and the lock in one statement. NO KEY UPDATE serializes two saves of one plan
      // without blocking the key-share lock of an insert that references it (a duplicate, a share).
      const [plan] = await tx.query('SELECT "curriculum_id" FROM "plans" WHERE "id" = $1 AND "user_id" = $2 FOR NO KEY UPDATE', [planId, userId]);
      if (!plan) throw notFound();
      await this.checkBoard(plan.curriculum_id, terms);
      await tx.delete(PlanPlacement, { planId });
      await insertBoard(tx, planId, userId, terms);
      // Only the child rows changed, so @UpdateDateColumn would not fire.
      await tx.query('UPDATE "plans" SET "updated_at" = now() WHERE "id" = $1', [planId]);
    });
    return this.get(userId, planId);
  }

  /**
   * One of the student's plans with another board in place of its saved one, for the rule engine to
   * check before anything is saved (the planner's drag preview). The board is validated as a save
   * would be; nothing is written.
   */
  async withBoard(userId: string, planId: string, terms: BoardTerm[]): Promise<PlanDto> {
    const plan = await this.get(userId, planId);
    await this.checkBoard(plan.curriculum.id, terms);
    return { ...plan, terms };
  }

  /**
   * The boards of a drag preview: `placement` dropped on each target in turn, each board checked as a save would
   * check it. The references are checked once, on the board with the placement in the first target.
   */
  async dropBoards(userId: string, planId: string, terms: BoardTerm[], placement: Placement, targets: TermDto[]): Promise<{ plan: PlanDto; boards: BoardTerm[][] }> {
    const seen = new Set(targets.map(termKey));
    if (seen.size !== targets.length) throw new BadRequestException('A target term is listed twice');
    const plan = await this.get(userId, planId);
    const boards = targets.map((to) => withPlacement(terms, placement, to));
    const problems = [...new Set(boards.flatMap(boardProblems))];
    if (problems.length) throw new BadRequestException(problems);
    await this.checkBoard(plan.curriculum.id, boards[0]!);
    return { plan, boards };
  }

  /** Deletes the plan and its placements. */
  async delete(userId: string, planId: string): Promise<void> {
    const { affected } = await this.plans.delete({ id: planId, userId });
    if (!affected) throw notFound();
  }

  // Shape and references only: every course is in the catalog, every slot's group is in the
  // plan's curriculum. A course outside the curriculum is allowed; whether it counts is the
  // rule engine's answer, like every other academic rule.
  private async checkBoard(curriculumId: string, terms: readonly BoardTerm[]): Promise<void> {
    const problems = boardProblems(terms);
    if (problems.length) throw new BadRequestException(problems);
    const codes = courseCodesOf(terms);
    const known = await this.curriculum.knownCourseCodes(codes);
    const unknown = codes.filter((c) => !known.has(c));
    if (unknown.length) throw new BadRequestException(`No course in the catalog has the code ${unknown.join(', ')}`);
    const groups = groupIdsOf(terms);
    if (!groups.length) return;
    const own = await this.curriculum.requirementGroupIds(curriculumId);
    const foreign = [...new Set(groups.filter((g) => !own.has(g)))];
    if (foreign.length) throw new BadRequestException(`Requirement group ${foreign.join(', ')} is not in the plan's curriculum`);
  }
}

async function insertBoard(tx: EntityManager, planId: string, userId: string, terms: readonly BoardTerm[]): Promise<void> {
  const rows = toRows(planId, userId, terms);
  if (rows.length) await tx.insert(PlanPlacement, rows);
}

function preview(rows: readonly PlanPlacement[]): PlanPreviewDto {
  const byKey = new Map(rows.map((r) => termFromColumns(r.termYear, r.termNumber)).map((t) => [termKey(t), t]));
  const terms = [...byKey.values()].sort(compareTerms);
  const courseCount = rows.filter((r) => r.courseCode !== null).length;
  return { termCount: terms.length, courseCount, slotCount: rows.length - courseCount, firstTerm: terms[0] ?? null, lastTerm: terms.at(-1) ?? null };
}

function summary(plan: Plan): PlanSummaryDto {
  const c = plan.curriculum;
  return {
    id: plan.id,
    name: plan.name,
    curriculum: { id: c.id, code: c.code, programCode: c.program.code, cohortYear: c.cohortYear },
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}
