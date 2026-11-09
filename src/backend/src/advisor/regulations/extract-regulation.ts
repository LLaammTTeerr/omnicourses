/**
 * Regenerates `<id>.json` and `<id>.md` from `sources/` for every regulation, or for the ids given:
 *
 *   npm run build -w src/backend && npm run regulations:extract -w src/backend [-- qd-1175-2021]
 *
 * Deterministic: the verification spec reruns the same extraction and fails if the committed files differ.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractRegulation, renderMarkdown } from './regulation.js';
import { jsonOf, readInputs, REGULATIONS_DIR, regulationIds } from './regulation-files.js';

const ids = process.argv.slice(2).length > 0 ? process.argv.slice(2) : regulationIds();
for (const id of ids) {
  const { source, pdftotext, overrides } = readInputs(id);
  const document = extractRegulation(source, pdftotext, overrides);
  writeFileSync(join(REGULATIONS_DIR, `${id}.json`), jsonOf(document));
  writeFileSync(join(REGULATIONS_DIR, `${id}.md`), renderMarkdown(document));
  console.log(`${id}: ${document.clauses.length} clauses`);
}
