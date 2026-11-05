import { GUIDE_FILES } from './content/index.js';
import type { GuideFile } from './guide-file.js';
import { guideFixtures } from './testing/guide-fixtures.js';

/** The guides `npm run db:seed` loads: the content files, plus the zz-* test guides with `--guide-fixtures`, never on a production server. */
export function guideSeedFiles(options: { fixtures: boolean; nodeEnv: string | undefined; today: string }): GuideFile[] {
  if (!options.fixtures) return GUIDE_FILES;
  if (options.nodeEnv === 'production') {
    throw new Error('--guide-fixtures publishes the zz-* test guides: refused when NODE_ENV is production');
  }
  return [...GUIDE_FILES, ...guideFixtures(options.today)];
}
