import { BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, Param, type PipeTransform, Put } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBody, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { Authenticated, CurrentUser, Public } from '../auth/auth.decorators.js';
import { PLAN_NOT_FOUND_DESCRIPTION, PlanId } from '../plans/plan-id.js';
import { User } from '../users/user.entity.js';
import { NotSharedDto, PlanShareDto, PlanShareStateDto, SharedPlanDto, SharePlanDto } from './sharing.dto.js';
import { SharingService } from './sharing.service.js';

export class ShareBodyPipe implements PipeTransform<unknown, SharePlanDto> {
  transform(value: unknown): SharePlanDto {
    if (value === undefined) return {};
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('The body must be a JSON object');
    return value as SharePlanDto;
  }
}

@ApiTags('sharing')
@Authenticated()
@Controller('plans/:id/share')
export class PlanShareController {
  constructor(private readonly sharing: SharingService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PlanShareStateDto, description: 'The live link of the plan, or `share: null` when the plan is not shared.' })
  @ApiNotFoundResponse({ description: PLAN_NOT_FOUND_DESCRIPTION })
  async state(@CurrentUser() user: User, @PlanId() id: string): Promise<PlanShareStateDto> {
    return { share: await this.sharing.shareOf(user.id, id) };
  }

  @Put()
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({
    type: PlanShareDto,
    description:
      'The plan is shared. A plan that was not shared gets a new link; a link stopped earlier stays dead. A plan already shared keeps its link and takes the choices that are sent (`showName`, `showTranscriptChecks`); a choice left out stays as it is. Anyone who holds the link can open it, without signing in.',
  })
  @ApiBody({ type: SharePlanDto, required: false, description: 'The choices to set. A request with no body, or with `{}`, sets none.' })
  @ApiBadRequestResponse({ description: 'The body is not an object, or `showName` or `showTranscriptChecks` is sent and is not a boolean (`null` included).' })
  @ApiNotFoundResponse({ description: PLAN_NOT_FOUND_DESCRIPTION })
  share(@CurrentUser() user: User, @PlanId() id: string, @Body(new ShareBodyPipe()) dto: SharePlanDto): Promise<PlanShareDto> {
    return this.sharing.share(user.id, id, { showName: dto.showName, showTranscriptChecks: dto.showTranscriptChecks });
  }

  @Delete()
  @HttpCode(204)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'The plan is not shared any more: its link stops working at once. The same answer when it was not shared.' })
  @ApiNotFoundResponse({ description: PLAN_NOT_FOUND_DESCRIPTION })
  async stop(@CurrentUser() user: User, @PlanId() id: string): Promise<void> {
    await this.sharing.stop(user.id, id);
  }
}

@ApiTags('sharing')
@Controller('shared-plans')
export class SharedPlansController {
  constructor(private readonly sharing: SharingService) {}

  @Public()
  @Get(':token')
  @ApiParam({ name: 'token', description: "The token of a shared plan's link." })
  @ApiOkResponse({
    type: SharedPlanDto,
    description:
      "The plan as it is now, read-only: its name, curriculum, terms and the rule engine's issues that follow from the plan alone. When the owner chose it for this link, also the issues the engine decides from the owner's transcript and the coverage. Never grades, email, transcript rows, other plans or an id. No sign-in needed. This answer, the 404 and the 429 of this path are sent with `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`.",
  })
  @ApiNotFoundResponse({
    type: NotSharedDto,
    description: 'No live link has this token. One answer, with the same body, for a link that was stopped, whose plan or account was deleted, that was mistyped or that never existed.',
  })
  read(@Param('token') token: string): Promise<SharedPlanDto> {
    return this.sharing.read(token);
  }
}
