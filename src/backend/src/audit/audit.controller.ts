import { ConflictException, Controller, Get, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiConflictResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Authenticated, CurrentUser } from '../auth/auth.decorators.js';
import { RulesService } from '../rules/rules.service.js';
import { toTerm } from '../terms/term.js';
import { User } from '../users/user.entity.js';
import { AuditQueryDto, AuditUnavailableDto, DegreeAuditDto } from './audit.dto.js';

@ApiTags('users')
@Authenticated()
@Controller('users/me/audit')
export class AuditController {
  constructor(private readonly rules: RulesService) {}

  @Get()
  @ApiOkResponse({
    type: DegreeAuditDto,
    description: "The student's transcript against the curriculum of their onboarding program and cohort. With asOfYear and asOfNumber, only the transcript rows up to that term count.",
  })
  @ApiBadRequestResponse({ description: 'Only one of asOfYear and asOfNumber, or a value out of range' })
  @ApiConflictResponse({
    type: AuditUnavailableDto,
    description:
      'onboarding_required: onboarding is not finished, so there is no program and cohort; send the student to onboarding. curriculum_not_found: no curriculum for the chosen program and cohort.',
  })
  async get(@CurrentUser() user: User, @Query() query: AuditQueryDto): Promise<DegreeAuditDto> {
    const asOf = query.asOfYear === undefined || query.asOfNumber === undefined ? null : toTerm(query.asOfYear, query.asOfNumber);
    const outcome = await this.rules.auditFor(user.id, asOf);
    if (outcome.status === 'onboarding_required') {
      throw new ConflictException({ statusCode: 409, code: 'onboarding_required', message: 'Finish onboarding to choose a program and cohort first' });
    }
    if (outcome.status === 'curriculum_not_found') {
      throw new ConflictException({
        statusCode: 409,
        code: 'curriculum_not_found',
        message: `No curriculum for ${outcome.programCode} cohort ${outcome.cohortYear}`,
      });
    }
    return outcome.audit;
  }
}
