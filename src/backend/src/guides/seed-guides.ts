import { createHash } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import { nodeEnv } from '../config/env.js';
import { vietnamDate } from '../config/time.js';
import { GUIDE_FILES } from './content/index.js';
import { contentOf, type GuideFile, textKey } from './guide-file.js';
import type { GuideText } from './guide-text.entity.js';
import { type LoadableGuideFile, parseGuideSet } from './validate-guide.js';

export interface GuideSeedReport {
  inserted: number;
  updated: number;
  rechecked: number;
  unchanged: number;
  withdrawn: number;
  drafts: number;
}

export class GuideSeedError extends Error {
  constructor(readonly problems: string[]) {
    super(`Guides not loaded, nothing changed:\n${problems.map((p) => `- ${p}`).join('\n')}`);
    this.name = 'GuideSeedError';
  }
}

export async function seed(dataSource: DataSource, options: { guideFixtures: boolean }): Promise<string[]> {
  let files = GUIDE_FILES;
  if (options.guideFixtures) {
    if (nodeEnv() === 'production') throw new Error('--guide-fixtures publishes the zz-* test guides: refused when NODE_ENV is production');
    const { guideFixtures } = await import('./testing/guide-fixtures.js');
    files = [...GUIDE_FILES, ...guideFixtures(vietnamDate(new Date()))];
  }
  const report = await seedGuides(dataSource, files);
  return [`Guides${options.guideFixtures ? ', with the test-only zz-* guides' : ''}: ${JSON.stringify(report)}`];
}

export function contentHash(file: GuideFile): string {
  const { lastChecked, status, ...shown } = file;
  return createHash('sha256').update(stableJson(shown)).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

interface LoadedText {
  id: string;
  lang: string;
  status: GuideText['status'];
  version: number;
  content_hash: string;
}

type PublishedGuideFile = Extract<LoadableGuideFile, { status: 'published' }>;

export async function seedGuides(dataSource: DataSource, files: GuideFile[]): Promise<GuideSeedReport> {
  const parsed = parseGuideSet(files);
  if ('problems' in parsed) throw new GuideSeedError(parsed.problems);

  return dataSource.transaction(async (em) => {
    const report: GuideSeedReport = { inserted: 0, updated: 0, rechecked: 0, unchanged: 0, withdrawn: 0, drafts: 0 };
    const problems: string[] = [];
    await em.query(`LOCK TABLE "guide_texts" IN SHARE ROW EXCLUSIVE MODE`);
    const loaded: LoadedText[] = await em.query(`SELECT "guide_id" AS "id", "lang", "status", "version", "content_hash" FROM "guide_texts"`);
    const rows = new Map(loaded.map((row) => [textKey(row), row]));
    for (const file of parsed.files) {
      const outcome = await loadFile(em, file, rows.get(textKey(file)));
      if (outcome.counted) report[outcome.counted]++;
      if (outcome.problem) problems.push(outcome.problem);
    }
    report.withdrawn += await withdrawMissing(em, loaded, new Set(parsed.files.map(textKey)));
    if (problems.length) throw new GuideSeedError(problems);
    return report;
  });
}

interface LoadOutcome {
  counted?: keyof GuideSeedReport;
  problem?: string;
}

async function loadFile(em: EntityManager, file: LoadableGuideFile, row: LoadedText | undefined): Promise<LoadOutcome> {
  if (file.status === 'draft') {
    const problem = `${textKey(file)}: is published; publish a new version or withdraw it instead of turning it back into a draft`;
    return { counted: 'drafts', ...(row?.status === 'published' && { problem }) };
  }
  if (file.status === 'withdrawn') {
    if (row?.status !== 'published') return {};
    await withdraw(em, file);
    return { counted: 'withdrawn' };
  }
  return loadPublished(em, file, row);
}

async function loadPublished(em: EntityManager, file: PublishedGuideFile, row: LoadedText | undefined): Promise<LoadOutcome> {
  const key = textKey(file);
  if (!row) {
    await write(em, file);
    return { counted: 'inserted' };
  }
  if (file.version < row.version) return { problem: `${key}: version ${file.version} is lower than the loaded version ${row.version}` };
  if (file.version > row.version) {
    await write(em, file);
    return { counted: 'updated' };
  }
  if (contentHash(file) !== row.content_hash) {
    return { problem: `${key}: changed without a new version; raise version above ${row.version} and write a change note (guides plan §3 rule 7)` };
  }
  return { counted: (await recheck(em, file)) ? 'rechecked' : 'unchanged' };
}

async function withdrawMissing(em: EntityManager, loaded: LoadedText[], inFiles: ReadonlySet<string>): Promise<number> {
  const missing = loaded.filter((row) => row.status === 'published' && !inFiles.has(textKey(row)));
  for (const row of missing) await withdraw(em, row);
  return missing.length;
}

async function write(em: EntityManager, file: PublishedGuideFile): Promise<void> {
  await em.query(
    `INSERT INTO "guides" ("id", "group") VALUES ($1, $2) ON CONFLICT ("id") DO UPDATE SET "group" = EXCLUDED."group"`,
    [file.id, file.group],
  );
  await em.query(
    `INSERT INTO "guide_texts" ("guide_id", "lang", "status", "version", "change_note", "last_checked_on",
       "last_checked_by", "title", "keywords", "content", "content_hash")
     VALUES ($1, $2, 'published', $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
     ON CONFLICT ("guide_id", "lang") DO UPDATE SET
       "status" = 'published', "version" = EXCLUDED."version", "change_note" = EXCLUDED."change_note",
       "last_checked_on" = EXCLUDED."last_checked_on", "last_checked_by" = EXCLUDED."last_checked_by",
       "title" = EXCLUDED."title", "keywords" = EXCLUDED."keywords", "content" = EXCLUDED."content",
       "content_hash" = EXCLUDED."content_hash", "updated_at" = now()`,
    [
      file.id,
      file.lang,
      file.version,
      file.changeNote,
      file.lastChecked.on,
      file.lastChecked.by,
      file.title,
      file.keywords,
      JSON.stringify(contentOf(file)),
      contentHash(file),
    ],
  );
}

async function recheck(em: EntityManager, file: PublishedGuideFile): Promise<boolean> {
  const [{ n: changed }]: { n: number }[] = await em.query(
    `WITH changed AS (
       UPDATE "guide_texts" SET "last_checked_on" = $3, "last_checked_by" = $4, "status" = 'published', "updated_at" = now()
       WHERE "guide_id" = $1 AND "lang" = $2
         AND ("last_checked_on", "last_checked_by", "status") IS DISTINCT FROM ($3::date, $4::varchar, 'published'::varchar)
       RETURNING 1)
     SELECT count(*)::int AS n FROM changed`,
    [file.id, file.lang, file.lastChecked.on, file.lastChecked.by],
  );
  return changed > 0;
}

async function withdraw(em: EntityManager, text: { id: string; lang: string }): Promise<void> {
  await em.query(`UPDATE "guide_texts" SET "status" = 'withdrawn', "updated_at" = now() WHERE "guide_id" = $1 AND "lang" = $2`, [text.id, text.lang]);
}
