import type { SeedOptions } from '../common/seed-options.js';

const GUIDE_FIXTURES_FLAG = '--guide-fixtures';

export function parseSeedOptions(argv: string[]): SeedOptions {
  return { guideFixtures: argv.includes(GUIDE_FIXTURES_FLAG) };
}
