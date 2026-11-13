import { createHash } from 'node:crypto';
import type { DataSource, EntityManager } from 'typeorm';
import { nodeEnv } from '../config/env.js';
import { vietnamDate } from '../terms/calendar.js';
import { GUIDE_FILES } from './content/index.js';
import { contentOf, type GuideFile, textKey } from './guide-file.js';
import type { GuideText } from './guide-text.entity.js';
import { type LoadableGuideFile, parseGuideSet } from './validate-guide.js';

export interface GuideSeedReport {
  /** Texts loaded for the first time. */
  inserted: number;
  /** Texts replaced by a higher version. */
  updated: number;
  /** Same version and content, with a new last-checked date or shown again after a withdrawal. */
  rechecked: number;
  unchanged: number;
  /** Texts hidden because their file was removed or marked withdrawn. */
  withdrawn: number;
  /** Draft files, which are never loaded. */
  drafts: number;
}

export class GuideSeedError extends Error {
  constructor(readonly problems: string[]) {
    super(`Guides not loaded, nothing changed:\n${problems.map((p) => `- ${p}`).join('\n')}`);
    this.name = 'GuideSeedError';
  }
}

/**
 * The guides step of `npm run db:seed`: the content files, plus the zz-* test
 * guides of TC-B1-GUIDE-01 with `--guide-fixtures`, which a production server
 * refuses before anything is written.
 */
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

/**
 * A hash of everything a reader sees except the last-checked date, in any key order.
 * A re-check that finds the portal unchanged needs no new version (guides plan §6 step 5).
 */
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

/**
 * Loads the guide content files (ADR 0010) in one transaction, all or nothing.
 * - A draft is never loaded, and a published text may not turn back into one.
 * - A published file is inserted, or replaces a lower version.
 * - The same version must have the same content, except its last-checked date (guides plan §3 rule 7).
 * - A text whose file is gone, or marked withdrawn, is withdrawn: kept, never deleted.
 */
export async function seedGuides(dataSource: DataSource, files: GuideFile[]): Promise<GuideSeedReport> {
  const parsed = parseGuideSet(files);
  if ('problems' in parsed) throw new GuideSeedError(parsed.problems);

  return dataSource.transaction(async (em) => {
    const report: GuideSeedReport = { inserted: 0, updated: 0, rechecked: 0, unchanged: 0, withdrawn: 0, drafts: 0 };
    const problems: string[] = [];
    // A second seed at the same time waits here instead of mixing its checks with ours.
    await em.query(`LOCK TABLE "guide_texts" IN SHARE ROW EXCLUSIVE MODE`);
    const loaded: LoadedText[] = await em.query(`SELECT "guide_id" AS "id", "lang", "status", "version", "content_hash" FROM "guide_texts"`);
    const rows = new Map(loaded.map((row) => [textKey(row), row]));
    const inFiles = new Set<string>();

    for (const file of parsed.files) {
      const key = textKey(file);
      const row = rows.get(key);
      inFiles.add(key);
      if (file.status === 'draft') {
        if (row?.status === 'published') {
          problems.push(`${key}: is published; publish a new version or withdraw it instead of turning it back into a draft`);
        }
        report.drafts++;
      } else if (file.status === 'withdrawn') {
        if (row?.status === 'published') {
          await withdraw(em, file);
          report.withdrawn++;
        }
      } else if (!row) {
        await write(em, file);
        report.inserted++;
      } else if (file.version < row.version) {
        problems.push(`${key}: version ${file.version} is lower than the loaded version ${row.version}`);
      } else if (file.version > row.version) {
        await write(em, file);
        report.updated++;
      } else if (contentHash(file) !== row.content_hash) {
        problems.push(`${key}: changed without a new version; raise version above ${row.version} and write a change note (guides plan §3 rule 7)`);
      } else if (await recheck(em, file)) {
        report.rechecked++;
      } else {
        report.unchanged++;
      }
    }
    // A text whose file is gone is withdrawn, not deleted: problem reports point at it (ADR 0010).
    for (const row of loaded) {
      if (row.status === 'published' && !inFiles.has(textKey(row))) {
        await withdraw(em, row);
        report.withdrawn++;
      }
    }
    if (problems.length) throw new GuideSeedError(problems);
    return report;
  });
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

/** Same version and content: takes a new last-checked date, and shows the text again if it was withdrawn. True if anything changed. */
async function recheck(em: EntityManager, file: PublishedGuideFile): Promise<boolean> {
  // A CTE, so the query is a SELECT and returns its rows (TypeORM returns [rows, count] for an UPDATE).
  const [{ n }]: { n: number }[] = await em.query(
    `WITH changed AS (
       UPDATE "guide_texts" SET "last_checked_on" = $3, "last_checked_by" = $4, "status" = 'published', "updated_at" = now()
       WHERE "guide_id" = $1 AND "lang" = $2
         AND ("last_checked_on", "last_checked_by", "status") IS DISTINCT FROM ($3::date, $4::varchar, 'published'::varchar)
       RETURNING 1)
     SELECT count(*)::int AS n FROM changed`,
    [file.id, file.lang, file.lastChecked.on, file.lastChecked.by],
  );
  return n > 0;
}

async function withdraw(em: EntityManager, text: { id: string; lang: string }): Promise<void> {
  await em.query(`UPDATE "guide_texts" SET "status" = 'withdrawn', "updated_at" = now() WHERE "guide_id" = $1 AND "lang" = $2`, [text.id, text.lang]);
}
