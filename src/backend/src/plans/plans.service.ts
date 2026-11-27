import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { groupBy } from '../common/collections.js';
import { CurriculumService } from '../curriculum/curriculum.service.js';
import { OnboardingService } from '../onboarding/onboarding.service.js';
import { courseCodesOf } from '../rules/plan-issues.js';
import type { BoardTerm, Placement } from '../rules/types.js';
import { compareTerms, type Term, termKey, toTerm } from '../terms/term.js';
import { boardProblems, groupIdsOf, toBoard, toRows, withPlacement } from './plan-board.js';
import { planNotFound } from './plan-id.js';
import { PlanPlacement } from './plan-placement.entity.js';
import { Plan } from './plan.entity.js';
import { PlanDto, PlanListItemDto, PlanPreviewDto, PlanSummaryDto } from './plans.dto.js';

export const MAX_PLANS_PER_USER = 50;

const notOffered = (programCode: string, cohortYear: number) => new BadRequestException(`Onboarding does not offer ${programCode} ${cohortYear} to students`);
const tooManyPlans = () => new BadRequestException(`A student may keep at most ${MAX_PLANS_PER_USER} plans`);

@Injectable()
export class PlansService {
  constructor(
    private readonly db: DataSource,
    @InjectRepository(Plan) private readonly plans: Repository<Plan>,
    @InjectRepository(PlanPlacement) private readonly placements: Repository<PlanPlacement>,
    private readonly curriculum: CurriculumService,
    private readonly onboarding: OnboardingService,
  ) {}

  async list(userId: string): Promise<PlanListItemDto[]> {
    const rows = await this.plans.find({ where: { userId }, relations: { curriculum: { program: true } }, order: { createdAt: 'ASC', id: 'ASC' } });
    const placements = await this.placements.find({ where: { userId }, select: { planId: true, termYear: true, termNumber: true, courseCode: true } });
    const byPlan = groupBy(placements, (p) => p.planId);
    return rows.map((plan) => ({ ...summary(plan), preview: preview(byPlan.get(plan.id) ?? []) }));
  }

  async find(userId: string, planId: string): Promise<PlanDto | null> {
    const plan = await this.plans.findOne({ where: { id: planId, userId }, relations: { curriculum: { program: true } } });
    if (!plan) return null;
    const rows = await this.placements.find({ where: { planId } });
    return { ...summary(plan), terms: toBoard(rows) };
  }

  async get(userId: string, planId: string): Promise<PlanDto> {
    const plan = await this.find(userId, planId);
    if (!plan) throw planNotFound();
    return plan;
  }

  async create(userId: string, input: { name: string; programCode: string; cohortYear: number; terms?: BoardTerm[] }): Promise<PlanDto> {
    if (!this.onboarding.offers(input.programCode, input.cohortYear)) throw notOffered(input.programCode, input.cohortYear);
    const curriculumId = await this.curriculum.findCurriculumId(input.programCode, input.cohortYear);
    if (!curriculumId) throw new BadRequestException('No curriculum for this program and cohort');
    const terms = input.terms ?? [];
    const id = await this.db.transaction(async (tx) => {
      await tx.query('SELECT 1 FROM "users" WHERE "id" = $1 FOR NO KEY UPDATE', [userId]);
      if ((await tx.count(Plan, { where: { userId } })) >= MAX_PLANS_PER_USER) throw tooManyPlans();
      await this.checkBoard(curriculumId, terms, tx);
      const { identifiers } = await tx.insert(Plan, { userId, curriculumId, name: input.name });
      const planId = identifiers[0].id as string;
      await insertBoard(tx, planId, userId, terms);
      return planId;
    });
    return this.get(userId, id);
  }

  async rename(userId: string, planId: string, name: string): Promise<PlanDto> {
    const { affected } = await this.plans.update({ id: planId, userId }, { name });
    if (!affected) throw planNotFound();
    return this.get(userId, planId);
  }

  async duplicate(userId: string, planId: string, name?: string): Promise<PlanDto> {
    const id = await this.db.transaction(async (tx) => {
      const [source] = await tx.query(
        `SELECT p."curriculum_id", p."name", pr."code" AS "program_code", c."cohort_year"
         FROM "plans" p JOIN "curriculums" c ON c."id" = p."curriculum_id" JOIN "programs" pr ON pr."id" = c."program_id"
         WHERE p."id" = $1 AND p."user_id" = $2 FOR SHARE OF p`,
        [planId, userId],
      );
      if (!source) throw planNotFound();
      if (!this.onboarding.offers(source.program_code, source.cohort_year)) throw notOffered(source.program_code, source.cohort_year);
      await tx.query('SELECT 1 FROM "users" WHERE "id" = $1 FOR NO KEY UPDATE', [userId]);
      if ((await tx.count(Plan, { where: { userId } })) >= MAX_PLANS_PER_USER) throw tooManyPlans();
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

  async replacePlacements(userId: string, planId: string, terms: BoardTerm[]): Promise<PlanDto> {
    await this.db.transaction(async (tx) => {
      const [plan] = await tx.query('SELECT "curriculum_id" FROM "plans" WHERE "id" = $1 AND "user_id" = $2 FOR NO KEY UPDATE', [planId, userId]);
      if (!plan) throw planNotFound();
      await this.checkBoard(plan.curriculum_id, terms, tx);
      await tx.delete(PlanPlacement, { planId });
      await insertBoard(tx, planId, userId, terms);
      await tx.query('UPDATE "plans" SET "updated_at" = now() WHERE "id" = $1', [planId]);
    });
    return this.get(userId, planId);
  }

  async withBoard(userId: string, planId: string, terms: BoardTerm[]): Promise<PlanDto> {
    const plan = await this.get(userId, planId);
    await this.checkBoard(plan.curriculum.id, terms);
    return { ...plan, terms };
  }

  async dropBoards(userId: string, planId: string, terms: BoardTerm[], placement: Placement, targets: Term[]): Promise<{ plan: PlanDto; boards: BoardTerm[][] }> {
    const seen = new Set(targets.map(termKey));
    if (seen.size !== targets.length) throw new BadRequestException('A target term is listed twice');
    const plan = await this.get(userId, planId);
    const boards = targets.map((to) => withPlacement(terms, placement, to));
    const problems = [...new Set(boards.flatMap(boardProblems))];
    if (problems.length) throw new BadRequestException(problems);
    await this.checkBoard(plan.curriculum.id, boards[0]!);
    return { plan, boards };
  }

  async delete(userId: string, planId: string): Promise<void> {
    const { affected } = await this.plans.delete({ id: planId, userId });
    if (!affected) throw planNotFound();
  }

  private async checkBoard(curriculumId: string, terms: readonly BoardTerm[], manager?: EntityManager): Promise<void> {
    const problems = boardProblems(terms);
    if (problems.length) throw new BadRequestException(problems);
    const codes = courseCodesOf(terms);
    const known = await this.curriculum.catalogCourses(codes, manager);
    const unknown = codes.filter((c) => !known.has(c));
    if (unknown.length) throw new BadRequestException(`No course in the catalog has the code ${unknown.join(', ')}`);
    const groups = groupIdsOf(terms);
    if (!groups.length) return;
    const own = await this.curriculum.requirementGroupIds(curriculumId, manager);
    const foreign = [...new Set(groups.filter((g) => !own.has(g)))];
    if (foreign.length) throw new BadRequestException(`Requirement group ${foreign.join(', ')} is not in the plan's curriculum`);
  }
}

async function insertBoard(tx: EntityManager, planId: string, userId: string, terms: readonly BoardTerm[]): Promise<void> {
  const rows = toRows(planId, userId, terms);
  if (rows.length) await tx.insert(PlanPlacement, rows);
}

function preview(rows: readonly PlanPlacement[]): PlanPreviewDto {
  const byKey = new Map(rows.map((r) => toTerm(r.termYear, r.termNumber)).map((t) => [termKey(t), t]));
  const terms = [...byKey.values()].sort(compareTerms);
  const courseCount = rows.filter((r) => r.courseCode !== null).length;
  return { termCount: terms.length, courseCount, slotCount: rows.length - courseCount, firstTerm: terms[0] ?? null, lastTerm: terms.at(-1) ?? null };
}

function summary(plan: Plan): PlanSummaryDto {
  const curriculum = plan.curriculum;
  return {
    id: plan.id,
    name: plan.name,
    curriculum: { id: curriculum.id, code: curriculum.code, programCode: curriculum.program.code, cohortYear: curriculum.cohortYear },
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}
