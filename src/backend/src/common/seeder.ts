import type { DataSource } from 'typeorm';

export interface SeedOptions {
  guideFixtures: boolean;
}

export type Seeder = (dataSource: DataSource, options: SeedOptions) => Promise<string[]>;
