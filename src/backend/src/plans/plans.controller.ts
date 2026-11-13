import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, PipeTransform, Post, Put } from '@nestjs/common';
import { ApiBadRequestResponse, ApiCreatedResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { Authenticated, CurrentUser } from '../auth/auth.decorators.js';
import { type PlanRef, RulesService } from '../rules/rules.service.js';
import { User } from '../users/user.entity.js';
import { PlanDropReportsDto, PlanIssuesDto } from './plan-issues.dto.js';
import { CreatePlanDto, DuplicatePlanDto, PlanBoardDto, PlanDropPreviewDto, PlanDto, PlanListDto, RenamePlanDto } from './plans.dto.js';
import { PlansService } from './plans.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A malformed id is a 404 like any unknown plan: a 400 or a 500 would tell ids apart. */
export class PlanIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!UUID.test(value)) throw new NotFoundException('No plan with this id');
    return value.toLowerCase();
  }
}

const NOT_FOUND = 'No plan with this id among the signed-in student’s plans (another student’s plan included).';
const PlanId = () => Param('id', new PlanIdPipe());
const ref = (plan: PlanDto): PlanRef => ({ planId: plan.id, curriculumId: plan.curriculum.id });

// F5 plans (UC-05, ADR 0014), the signed-in student's own only.
@ApiTags('plans')
@Authenticated()
@Controller('plans')
export class PlansController {
  constructor(
    private readonly plans: PlansService,
    private readonly rules: RulesService,
  ) {}

  @Get()
  @ApiOkResponse({ type: PlanListDto, description: "The student's plans, without their placements." })
  async list(@CurrentUser() user: User): Promise<PlanListDto> {
    return { plans: await this.plans.list(user.id) };
  }

  @Post()
  @ApiCreatedResponse({ type: PlanDto })
  @ApiBadRequestResponse({ description: 'No curriculum for this program and cohort, or a placement is invalid; nothing is saved.' })
  create(@CurrentUser() user: User, @Body() dto: CreatePlanDto): Promise<PlanDto> {
    return this.plans.create(user.id, dto);
  }

  @Get(':id')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PlanDto })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  get(@CurrentUser() user: User, @PlanId() id: string): Promise<PlanDto> {
    return this.plans.get(user.id, id);
  }

  @Get(':id/issues')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({
    type: PlanIssuesDto,
    description:
      "The rule engine's check of the plan against its curriculum and the student's transcript: prerequisites, offering terms, credit caps, repeats and coverage, each with its citation. Unrecorded data is reported as unknown, never as a pass or a fail. Nothing here blocks saving.",
  })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  async issuesOf(@CurrentUser() user: User, @PlanId() id: string): Promise<PlanIssuesDto> {
    const plan = await this.plans.get(user.id, id);
    return this.rules.issuesFor(user.id, ref(plan), plan.terms);
  }

  @Post(':id/issues')
  @HttpCode(200)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({
    type: PlanIssuesDto,
    description:
      "The rule engine's check of the plan with the board sent in place of its saved one, as GET /plans/{id}/issues reports it. Nothing is saved: the planner asks this while a course is dragged, to show what each term would say.",
  })
  @ApiBadRequestResponse({ description: 'A term or placement is invalid, as for PUT /plans/{id}/placements.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  async previewIssues(@CurrentUser() user: User, @PlanId() id: string, @Body() dto: PlanBoardDto): Promise<PlanIssuesDto> {
    const plan = await this.plans.withBoard(user.id, id, dto.terms);
    return this.rules.issuesFor(user.id, ref(plan), plan.terms);
  }

  @Post(':id/issues/drops')
  @HttpCode(200)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({
    type: PlanDropReportsDto,
    description:
      "The rule engine's check of the board sent with the placement dropped on each target term, one report per target, as POST /plans/{id}/issues reports one board. Nothing is saved. The planner asks this once when a course is picked up, instead of once per term, so a drag costs one request against the rate limit.",
  })
  @ApiBadRequestResponse({ description: 'A term, placement or target is invalid, or a board with the drop would be refused by PUT /plans/{id}/placements.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  async previewDrops(@CurrentUser() user: User, @PlanId() id: string, @Body() dto: PlanDropPreviewDto): Promise<PlanDropReportsDto> {
    const { plan, boards } = await this.plans.dropBoards(user.id, id, dto.terms, dto.placement, dto.targets);
    const reports = await this.rules.issuesForBoards(user.id, ref(plan), boards);
    return { reports: dto.targets.map((term, i) => ({ term, issues: reports[i]! })) };
  }

  @Patch(':id')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PlanDto, description: 'The renamed plan.' })
  @ApiBadRequestResponse({ description: 'The name is empty or longer than 100 characters.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  rename(@CurrentUser() user: User, @PlanId() id: string, @Body() dto: RenamePlanDto): Promise<PlanDto> {
    return this.plans.rename(user.id, id, dto.name);
  }

  @Post(':id/duplicate')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: PlanDto, description: 'The new copy; the original is unchanged.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  duplicate(@CurrentUser() user: User, @PlanId() id: string, @Body() dto: DuplicatePlanDto): Promise<PlanDto> {
    return this.plans.duplicate(user.id, id, dto.name);
  }

  @Put(':id/placements')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PlanDto, description: 'The board replaces every placement of the plan.' })
  @ApiBadRequestResponse({ description: 'A term or placement is invalid, a course is placed twice, a code is not in the catalog, or a slot names a group outside the plan’s curriculum; nothing is changed.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  replacePlacements(@CurrentUser() user: User, @PlanId() id: string, @Body() dto: PlanBoardDto): Promise<PlanDto> {
    return this.plans.replacePlacements(user.id, id, dto.terms);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'The plan and its placements are deleted. It cannot be undone; the UI asks first.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  async delete(@CurrentUser() user: User, @PlanId() id: string): Promise<void> {
    await this.plans.delete(user.id, id);
  }
}
