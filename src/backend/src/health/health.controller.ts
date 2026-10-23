import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/auth.decorators.js';
import { HealthDto } from './health.dto.js';
import { HealthService } from './health.service.js';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOkResponse({ type: HealthDto })
  check(): Promise<HealthDto> {
    return this.health.check();
  }
}
