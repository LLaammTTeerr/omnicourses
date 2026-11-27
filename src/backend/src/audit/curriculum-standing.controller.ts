import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { Authenticated, CurrentUser } from '../auth/auth.decorators.js';
import { RulesService } from '../rules/rules.service.js';
import { User } from '../users/user.entity.js';
import { CurriculumStandingDto } from './curriculum-standing.dto.js';

const COHORT_YEAR = /^\d{4}$/;

@ApiTags('curriculum')
@Authenticated()
@Controller('programs/:program/curricula/:cohort/standing')
export class CurriculumStandingController {
  constructor(private readonly rules: RulesService) {}

  @Get()
  @ApiParam({ name: 'program', description: 'Program code', example: 'APCS' })
  @ApiParam({ name: 'cohort', description: 'Cohort year', example: '2024' })
  @ApiOkResponse({
    type: CurriculumStandingDto,
    description: "Per-course transcript status and prerequisite readiness computed by the rule engine against the signed-in student's transcript.",
  })
  @ApiNotFoundResponse({ description: 'The program does not exist, has no curriculum for this cohort, or the cohort is not a 4-digit year.' })
  async get(@CurrentUser() user: User, @Param('program') program: string, @Param('cohort') cohort: string): Promise<CurriculumStandingDto> {
    if (!COHORT_YEAR.test(cohort) || program.includes('\u0000')) {
      throw new NotFoundException('No curriculum for this program and cohort');
    }
    const standing = await this.rules.standingFor(user.id, program, Number(cohort));
    if (!standing) throw new NotFoundException('No curriculum for this program and cohort');
    return standing;
  }
}
