import { ApiProperty } from '@nestjs/swagger';

export class HealthDto {
  @ApiProperty({ enum: ['ok', 'degraded'] })
  status!: 'ok' | 'degraded';

  @ApiProperty({ enum: ['up', 'down'] })
  database!: 'up' | 'down';

  @ApiProperty({ example: '18.6', nullable: true, type: String })
  postgresVersion!: string | null;
}
