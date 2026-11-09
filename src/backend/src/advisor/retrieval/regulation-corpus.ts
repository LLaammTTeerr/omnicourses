import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RegulationDocument } from '../regulations/regulation.js';
import { REGULATIONS_DIR, regulationIds } from '../regulations/regulation-files.js';
import { ClauseIndex } from './clause-index.js';

/**
 * Every committed regulation document, read from the source tree. `nest build` does not copy JSON to
 * dist/, and REGULATIONS_DIR resolves to src/advisor/regulations from both src/ and dist/; the
 * deployed release is a checkout with src/ present (deploy/server). Read once at boot.
 */
export function loadRegulations(dir = REGULATIONS_DIR): RegulationDocument[] {
  return regulationIds(join(dir, 'sources')).map((id) => JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8')) as RegulationDocument);
}

let shared: ClauseIndex | undefined;

/** The index over every committed document, built on first use and kept for the process. */
export function regulationIndex(): ClauseIndex {
  shared ??= new ClauseIndex(loadRegulations());
  return shared;
}
