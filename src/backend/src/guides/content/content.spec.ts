import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { portalsMissingFromBoard, validateGuideSet } from '../validate-guide.js';
import { GUIDE_FILES } from './index.js';

const DIR = __dirname;
const CONTENT = readdirSync(DIR).filter((name) => /^[a-z0-9-]+\.(vi|en)\.ts$/.test(name));

describe('guide content files', () => {
  it('pass every check the seed runs', () => {
    expect(validateGuideSet(GUIDE_FILES)).toEqual([]);
  });

  it('are all listed in index.ts, each named after its id and language', () => {
    expect(GUIDE_FILES.map((f) => `${f.id}.${f.lang}.ts`).sort()).toEqual([...CONTENT].sort());
  });

  it('share the folder with nothing but the index, this test and the README', () => {
    expect(readdirSync(DIR).filter((name) => !CONTENT.includes(name)).sort()).toEqual(['README.md', 'content.spec.ts', 'index.ts']);
  });

  it('send every published guide to a site on the portal board (G01)', () => {
    expect(portalsMissingFromBoard(GUIDE_FILES)).toEqual([]);
  });

  it('hold no test-only guide', () => {
    expect(GUIDE_FILES.filter((f) => f.id.startsWith('zz-'))).toEqual([]);
  });
});
