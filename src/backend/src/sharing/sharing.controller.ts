import { Body, Controller, Delete, Get, Header, HttpCode, Param, Put, Res } from '@nestjs/common';
import { ApiBadRequestResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Authenticated, CurrentUser, Public } from '../auth/auth.decorators.js';
import { PlanIdPipe } from '../plans/plans.controller.js';
import { User } from '../users/user.entity.js';
import { NotSharedDto, PlanShareDto, PlanShareStateDto, SharedPlanDto, SharePlanDto } from './sharing.dto.js';
import { SharingService } from './sharing.service.js';

const NOT_FOUND = 'No plan with this id among the signed-in student’s plans (another student’s plan included).';
const PlanId = () => Param('id', new PlanIdPipe());

// The owner's side of a shared plan (UC-09 steps 1–4, A2–A4): the signed-in student's own plans only.
// The answers hold the link's token, so they are never stored by a cache.
@ApiTags('sharing')
@Authenticated()
@Controller('plans/:id/share')
export class PlanShareController {
  constructor(private readonly sharing: SharingService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PlanShareStateDto, description: 'The live link of the plan, or `share: null` when the plan is not shared.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  async state(@CurrentUser() user: User, @PlanId() id: string): Promise<PlanShareStateDto> {
    return { share: await this.sharing.shareOf(user.id, id) };
  }

  @Put()
  @Header('Cache-Control', 'no-store')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({
    type: PlanShareDto,
    description:
      'The plan is shared. A plan that was not shared gets a new link; a link stopped earlier stays dead. A plan already shared keeps its link and takes the new `showName`. Anyone who holds the link can open it, without signing in.',
  })
  @ApiBadRequestResponse({ description: '`showName` is not a boolean.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  share(@CurrentUser() user: User, @PlanId() id: string, @Body() dto: SharePlanDto): Promise<PlanShareDto> {
    return this.sharing.share(user.id, id, dto.showName ?? false);
  }

  @Delete()
  @HttpCode(204)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'The plan is not shared any more: its link stops working at once. The same answer when it was not shared.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  async stop(@CurrentUser() user: User, @PlanId() id: string): Promise<void> {
    await this.sharing.stop(user.id, id);
  }
}

// The reader's side (UC-09 steps 6–7, ADR 0010): the one public route of this module. It only reads.
// @Public() is on the route, not the controller, so a route added here later stays behind sign-in.
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
      "The plan as it is now, read-only: its name, curriculum, terms and the rule engine's issues that follow from the plan alone. Never grades, email, the transcript, other plans or an id. No sign-in needed. Sent with `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`.",
  })
  @ApiNotFoundResponse({
    type: NotSharedDto,
    description: 'No live link has this token. One answer, with the same body, for a link that was stopped, whose plan or account was deleted, that was mistyped or that never existed.',
  })
  read(@Param('token') token: string, @Res({ passthrough: true }) res: Response): Promise<SharedPlanDto> {
    // Set before anything can throw, so the "not shared" answer carries them too: search engines
    // must not index either answer (UC-09 §7), and no cache may keep a plan past a stopped link (A2).
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');
    return this.sharing.read(token);
  }
}
