/**
 * Regenerates `<id>.json` and `<id>.md` from the handbook's text layer, which stays out of git:
 *
 *   pdftotext <handbook>.pdf /tmp/so-tay.txt
 *   npm run build -w src/backend && npm run handbook:extract -w src/backend -- so-tay-2024-2025 /tmp/so-tay.txt
 *
 * The text layer must be the one `sources/<id>.source.json` names (sha256), so the output is reproducible.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256 } from '../regulations/regulation-files.js';
import { extractHandbook, renderHandbookMarkdown } from './handbook.js';
import { HANDBOOK_DIR, handbookJson, readHandbookSource } from './handbook-files.js';

const [id, textPath] = process.argv.slice(2);
if (!id || !textPath) throw new Error('usage: extract-handbook <id> <pdftotext output>');
const source = readHandbookSource(id);
const pdftotext = readFileSync(textPath, 'utf8');
if (sha256(pdftotext) !== source.textLayer.sha256) throw new Error(`${textPath} is not the text layer ${id}.source.json names`);
const document = extractHandbook(source, pdftotext);
writeFileSync(join(HANDBOOK_DIR, `${id}.json`), handbookJson(document));
writeFileSync(join(HANDBOOK_DIR, `${id}.md`), renderHandbookMarkdown(document));
console.log(`${id}: ${document.passages.length} passages; redacted lines: ${JSON.stringify(document.redactions)}`);
