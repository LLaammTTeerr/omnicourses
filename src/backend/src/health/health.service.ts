import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthDto } from './health.dto.js';

@Injectable()
export class HealthService {
  constructor(private readonly dataSource: DataSource) {}

  // Public route: it says whether the database answers, never which version it runs (issue #28).
  async check(): Promise<HealthDto> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', database: 'up' };
    } catch {
      return { status: 'degraded', database: 'down' };
    }
  }
}
