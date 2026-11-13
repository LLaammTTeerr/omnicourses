import { ConflictException, Controller, Get } from '@nestjs/common';
import { ApiConflictResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Authenticated, CurrentUser } from '../auth/auth.decorators.js';
import { codedError } from '../common/coded-error.js';
import { RulesService } from '../rules/rules.service.js';
import { User } from '../users/user.entity.js';
import { AuditUnavailableDto, DegreeAuditDto } from './audit.dto.js';

// F3, the degree audit (ADR 0013). Only the signed-in student's own audit: no route takes a user id.
// Every number comes from the rule engine (AGENTS.md hard rule 1).
@ApiTags('users')
@Authenticated()
@Controller('users/me/audit')
export class AuditController {
  constructor(private readonly rules: RulesService) {}

  @Get()
  @ApiOkResponse({ type: DegreeAuditDto, description: "The student's transcript against the curriculum of their onboarding program and cohort." })
  @ApiConflictResponse({
    type: AuditUnavailableDto,
    description:
      'onboarding_required: onboarding is not finished, so there is no program and cohort; send the student to onboarding. curriculum_not_found: no curriculum for the chosen program and cohort.',
  })
  async get(@CurrentUser() user: User): Promise<DegreeAuditDto> {
    const outcome = await this.rules.auditFor(user.id);
    if (outcome.status === 'onboarding_required') {
      throw codedError(ConflictException, 'onboarding_required', 'Finish onboarding to choose a program and cohort first');
    }
    if (outcome.status === 'curriculum_not_found') {
      throw codedError(ConflictException, 'curriculum_not_found', `No curriculum for ${outcome.programCode} cohort ${outcome.cohortYear}`);
    }
    return outcome.audit;
  }
}
