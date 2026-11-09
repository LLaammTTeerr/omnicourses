import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RegulationDocument, RegulationOverride, RegulationSource } from './regulation.js';

/** This folder in the source tree: the generated `<id>.json` and `<id>.md` live here, the inputs in `sources/`. */
export const REGULATIONS_DIR = join(__dirname, '..', '..', '..', 'src', 'advisor', 'regulations');
export const SOURCES_DIR = join(REGULATIONS_DIR, 'sources');

export interface RegulationInputs {
  source: RegulationSource;
  pdftotext: string;
  overrides: RegulationOverride[];
}

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

export const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

/** The ids of every document with a `sources/<id>.source.json`. */
export function regulationIds(sourcesDir = SOURCES_DIR): string[] {
  return readdirSync(sourcesDir)
    .filter((name) => name.endsWith('.source.json'))
    .map((name) => name.slice(0, -'.source.json'.length))
    .sort();
}

/** Reads a document's three inputs and checks the text layer is the one its metadata names. */
export function readInputs(id: string, sourcesDir = SOURCES_DIR): RegulationInputs {
  const source = readJson<RegulationSource>(join(sourcesDir, `${id}.source.json`));
  if (source.id !== id) throw new Error(`${id}.source.json has id ${source.id}`);
  const pdftotext = readFileSync(join(sourcesDir, `${id}.pdftotext.txt`), 'utf8');
  if (sha256(pdftotext) !== source.textLayer.sha256) {
    throw new Error(`${id}.pdftotext.txt does not match textLayer.sha256 in ${id}.source.json`);
  }
  const overrides = readJson<RegulationOverride[]>(join(sourcesDir, `${id}.overrides.json`));
  return { source, pdftotext, overrides };
}

export const jsonOf = (document: RegulationDocument): string => `${JSON.stringify(document, null, 2)}\n`;
