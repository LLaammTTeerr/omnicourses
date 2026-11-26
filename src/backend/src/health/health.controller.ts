import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Public } from '../auth/auth.decorators.js';

export class HealthDto {
  @ApiProperty({ enum: ['ok', 'degraded'] })
  status!: 'ok' | 'degraded';

  @ApiProperty({ enum: ['up', 'down'] })
  database!: 'up' | 'down';
}

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  // Public route: it says whether the database answers, never which version it runs (issue #28).
  @Get()
  @ApiOkResponse({ type: HealthDto })
  async check(): Promise<HealthDto> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', database: 'up' };
    } catch {
      return { status: 'degraded', database: 'down' };
    }
  }
}
