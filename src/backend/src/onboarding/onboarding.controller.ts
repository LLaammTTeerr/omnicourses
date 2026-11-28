import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBadRequestResponse, ApiExtraModels, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Authenticated, CurrentUser } from '../auth/auth.decorators.js';
import { TermDto } from '../terms/term.dto.js';
import { User } from '../users/user.entity.js';
import { OnboardingDto } from './onboarding.dto.js';
import { OnboardingService } from './onboarding.service.js';

@ApiTags('users')
@ApiExtraModels(TermDto)
@Authenticated()
@Controller('users/me/onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  @ApiOkResponse({ type: OnboardingDto, description: 'The saved answers. Before the first save every answer is null and finished is false.' })
  get(@CurrentUser() user: User): Promise<OnboardingDto> {
    return this.onboarding.answersFor(user.id);
  }

  @Put()
  @ApiOkResponse({ type: OnboardingDto, description: 'Every answer is replaced; the saved answers are returned.' })
  @ApiBadRequestResponse({ description: 'An answer is invalid or missing; nothing is saved' })
  save(@CurrentUser() user: User, @Body() dto: OnboardingDto): Promise<OnboardingDto> {
    return this.onboarding.save(user.id, dto);
  }
}
