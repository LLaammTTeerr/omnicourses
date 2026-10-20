import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthDto } from './health.dto.js';

@Injectable()
export class HealthService {
  constructor(private readonly dataSource: DataSource) {}

  async check(): Promise<HealthDto> {
    try {
      const rows: { server_version: string }[] = await this.dataSource.query('SHOW server_version');
      return { status: 'ok', database: 'up', postgresVersion: rows[0]?.server_version ?? null };
    } catch {
      return { status: 'degraded', database: 'down', postgresVersion: null };
    }
  }
}
