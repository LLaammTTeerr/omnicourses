import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HandbookDocument, HandbookSource } from './handbook.js';

/** This folder in the source tree (from src/ and dist/ alike): `<id>.json` and `<id>.md` here, inputs in `sources/`. */
export const HANDBOOK_DIR = join(__dirname, '..', '..', '..', 'src', 'advisor', 'handbook');
export const HANDBOOK_SOURCES_DIR = join(HANDBOOK_DIR, 'sources');

/** The ids of every handbook with a `sources/<id>.source.json`. */
export function handbookIds(sourcesDir = HANDBOOK_SOURCES_DIR): string[] {
  return readdirSync(sourcesDir)
    .filter((name) => name.endsWith('.source.json'))
    .map((name) => name.slice(0, -'.source.json'.length))
    .sort();
}

export function readHandbookSource(id: string, sourcesDir = HANDBOOK_SOURCES_DIR): HandbookSource {
  const source = JSON.parse(readFileSync(join(sourcesDir, `${id}.source.json`), 'utf8')) as HandbookSource;
  if (source.id !== id) throw new Error(`${id}.source.json has id ${source.id}`);
  return source;
}

/** Every committed handbook, read once at boot. */
export function loadHandbooks(dir = HANDBOOK_DIR): HandbookDocument[] {
  return handbookIds(join(dir, 'sources')).map((id) => JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8')) as HandbookDocument);
}

export const handbookJson = (document: HandbookDocument): string => `${JSON.stringify(document, null, 2)}\n`;
