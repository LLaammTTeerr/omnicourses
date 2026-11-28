import { describe, expect, it } from 'vitest';
import { COUNTED_REFERENCES, REFERENCES } from '../../../backend/src/curriculum-admin/references.js';
import { readReference } from './errors.js';

type Builders = typeof REFERENCES;
type Sentences = { [Name in Exclude<keyof Builders, 'counted'>]: Parameters<Builders[Name]>[] };

const SAMPLE_COUNT = 3;
const SENTENCES: Sentences = {
  links: [['ZZ101']],
  requires: [['ZZ201', 'ZZ101']],
  ownPrerequisites: [['ZZ101']],
  ownTerms: [['ZZ101']],
  linkedIn: [['ZZ-PROG-2024']],
  groupPlans: [[2], [null]],
  groupOverflows: [[2], [null]],
  groupCombinedMinimums: [[2], [null]],
  countingRule: [['ZZ101']],
};
const KNOWN_UNPARSED: (keyof Builders)[] = ['groupOverflows', 'groupCombinedMinimums', 'countingRule'];

const counted = (Object.keys(COUNTED_REFERENCES) as (keyof typeof COUNTED_REFERENCES)[]).map((what) => REFERENCES.counted(SAMPLE_COUNT, what));
const built = (Object.keys(SENTENCES) as (keyof Sentences)[]).map((name): [keyof Builders, string[]] => [
  name,
  SENTENCES[name].map((args) => (REFERENCES[name] as (...values: unknown[]) => string)(...args)),
]);
const sentences: [keyof Builders, string[]][] = [...built, ['counted', counted]];

describe('the reference sentences the server builds (ADR 0011, 409 referenced_item)', () => {
  it('has a sample for every builder the server has', () => {
    expect(sentences.map(([name]) => name).sort()).toEqual(Object.keys(REFERENCES).sort());
  });

  it.each(sentences.filter(([name]) => !KNOWN_UNPARSED.includes(name)))('reads every sentence of %s as a kind of its own', (_name, texts) => {
    for (const text of texts) expect(readReference(text), text).not.toMatchObject({ kind: 'other' });
  });

  it.each(sentences.filter(([name]) => KNOWN_UNPARSED.includes(name)))('still shows %s as plain text, so it stays on the known-unparsed list until it is read', (_name, texts) => {
    for (const text of texts) expect(readReference(text), text).toEqual({ kind: 'other', text });
  });
});
