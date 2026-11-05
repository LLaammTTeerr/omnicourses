import { describe, expect, it } from 'vitest';
import { GUIDE_FILES } from './content/index.js';
import { guideSeedFiles } from './seed-files.js';

const TODAY = '2026-11-13';
const ids = (files: { id: string }[]) => [...new Set(files.map((f) => f.id))];

describe('guideSeedFiles', () => {
  it('loads the content files of the repository', () => {
    expect(guideSeedFiles({ fixtures: false, nodeEnv: 'production', today: TODAY })).toEqual(GUIDE_FILES);
  });

  it('adds the zz-* test guides when asked for', () => {
    const files = guideSeedFiles({ fixtures: true, nodeEnv: undefined, today: TODAY });
    expect(files.slice(0, GUIDE_FILES.length)).toEqual(GUIDE_FILES);
    expect(ids(files.slice(GUIDE_FILES.length)).every((id) => id.startsWith('zz-'))).toBe(true);
  });

  it('refuses the test guides on a production server, where they would be published', () => {
    expect(() => guideSeedFiles({ fixtures: true, nodeEnv: 'production', today: TODAY })).toThrow(
      '--guide-fixtures publishes the zz-* test guides: refused when NODE_ENV is production',
    );
  });
});
