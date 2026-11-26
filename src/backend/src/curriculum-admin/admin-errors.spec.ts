import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REFERENCES } from './admin-errors.js';

const samples: unknown = JSON.parse(readFileSync(join(__dirname, '..', '..', 'test', 'fixtures', 'admin-references.json'), 'utf8'));

describe('REFERENCES', () => {
  it('builds the sentences of test/fixtures/admin-references.json, which the admin screen reads', () => {
    expect([
      REFERENCES.links('ZZ101'),
      REFERENCES.requires('ZZ201', 'ZZ101'),
      REFERENCES.ownPrerequisites('ZZ101'),
      REFERENCES.ownTerms('ZZ101'),
      REFERENCES.linkedIn('ZZ-PROG-2024'),
      REFERENCES.groupPlans(2),
      REFERENCES.groupPlans(null),
      REFERENCES.counted(3, 'prerequisiteLists'),
      REFERENCES.counted(3, 'requiredBy'),
      REFERENCES.counted(3, 'offeringTerms'),
      REFERENCES.counted(3, 'transcriptRows'),
      REFERENCES.counted(3, 'plans'),
    ]).toEqual(samples);
  });
});
