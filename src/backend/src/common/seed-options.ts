import type { DataSource } from 'typeorm';

export interface SeedOptions {
  guideFixtures: boolean;
}

export type Seeder = (dataSource: DataSource, options: SeedOptions) => Promise<string[]>;

const GUIDE_FIXTURES_FLAG = '--guide-fixtures';

export function parseSeedOptions(argv: string[]): SeedOptions {
  return { guideFixtures: argv.includes(GUIDE_FIXTURES_FLAG) };
}
