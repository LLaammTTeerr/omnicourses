import { describe, expect, it } from 'vitest';
import contract from '../../../backend/openapi.json';
import { contractEnum, contractShape, type Shape } from '../testing/contract.js';
import { TERM_NUMBERS, type Term } from '../terms.js';
import { TRANSCRIPT_RESULTS, type Transcript, type TranscriptRow } from './api.js';
import { MAX_CREDITS, MAX_ROWS } from './rows.js';

const schemas = contract.components.schemas;

describe('transcript types against the contract (ADR 0007, ADR 0009)', () => {
  it.each([
    ['TranscriptDto', { rows: 'required' } satisfies Shape<Transcript>],
    [
      'TranscriptRowDto',
      { courseCode: 'required', courseName: 'required', credits: 'required', result: 'required', grade: 'optional', term: 'required' } satisfies Shape<TranscriptRow>,
    ],
    ['TermDto', { year: 'required', number: 'required' } satisfies Shape<Term>],
  ])('has the fields of %s', (schema, shape) => {
    expect(contractShape(schema)).toEqual(shape);
  });

  it('has the results and term numbers of the contract', () => {
    expect([...TRANSCRIPT_RESULTS].sort()).toEqual(contractEnum('TranscriptRowDto', 'result'));
    expect([...TERM_NUMBERS].sort()).toEqual(contractEnum('TermDto', 'number'));
  });

  it('checks the bounds the API checks', () => {
    expect(schemas.TranscriptRowDto.properties.credits).toMatchObject({ minimum: 0, maximum: MAX_CREDITS });
    expect(schemas.TranscriptDto.properties.rows.description).toContain(`at most ${MAX_ROWS} rows`);
  });
});
