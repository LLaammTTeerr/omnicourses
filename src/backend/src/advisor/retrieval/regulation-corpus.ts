import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadHandbooks } from '../handbook/handbook-files.js';
import type { RegulationDocument } from '../regulations/regulation.js';
import { REGULATIONS_DIR, regulationIds } from '../regulations/regulation-files.js';
import { ClauseIndex, handbookClauses, type IndexedClause, regulationClauses } from './clause-index.js';

/**
 * Every committed regulation document, read from the source tree. `nest build` does not copy JSON to
 * dist/, and REGULATIONS_DIR resolves to src/advisor/regulations from both src/ and dist/; the
 * deployed release is a checkout with src/ present (deploy/server). Read once at boot.
 */
export function loadRegulations(dir = REGULATIONS_DIR): RegulationDocument[] {
  return regulationIds(join(dir, 'sources')).map((id) => JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8')) as RegulationDocument);
}

/** Everything the advisor cites: the regulation clauses, then the student handbook's passages. */
export function loadCorpus(): IndexedClause[] {
  return [...loadRegulations().flatMap(regulationClauses), ...loadHandbooks().flatMap(handbookClauses)];
}

let shared: ClauseIndex | undefined;

/** The index over every committed source, built on first use and kept for the process. */
export function corpusIndex(): ClauseIndex {
  shared ??= new ClauseIndex(loadCorpus());
  return shared;
}
