import { createHash } from 'node:crypto';
import type { DataSource, QueryRunner } from 'typeorm';
import type { GuideContent, GuideFile } from './guide-file.js';
import { validateGuideSet } from './validate-guide.js';

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

/** What a guide page shows besides the fields stored in their own columns. */
export function contentOf(file: GuideFile): GuideContent {
  const { id, lang, status, version, changeNote, lastChecked, group, title, keywords, ...content } = file;
  return content;
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
  guide_id: string;
  lang: string;
  status: 'published' | 'withdrawn';
  version: number;
  content_hash: string;
}

/**
 * Loads the guide content files (ADR 0010) in one transaction, all or nothing.
 * - A draft is never loaded, and a published text may not turn back into one.
 * - A published file is inserted, or replaces a lower version.
 * - The same version must have the same content, except its last-checked date (guides plan §3 rule 7).
 * - A text whose file is gone, or marked withdrawn, is withdrawn: kept, never deleted.
 */
export async function seedGuides(dataSource: DataSource, files: GuideFile[]): Promise<GuideSeedReport> {
  const invalid = validateGuideSet(files);
  if (invalid.length) throw new GuideSeedError(invalid);

  const report: GuideSeedReport = { inserted: 0, updated: 0, rechecked: 0, unchanged: 0, withdrawn: 0, drafts: 0 };
  const problems: string[] = [];
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    // A second seed at the same time waits here instead of mixing its checks with ours.
    await runner.query(`LOCK TABLE "guide_texts" IN SHARE ROW EXCLUSIVE MODE`);
    const loaded: LoadedText[] = await runner.query(
      `SELECT "guide_id", "lang", "status", "version", "content_hash" FROM "guide_texts"`,
    );
    const rows = new Map(loaded.map((row) => [`${row.guide_id}.${row.lang}`, row]));
    const inFiles = new Set<string>();

    for (const file of files) {
      const key = `${file.id}.${file.lang}`;
      const row = rows.get(key);
      inFiles.add(key);
      if (file.status === 'draft') {
        if (row?.status === 'published') {
          problems.push(`${key}: is published; publish a new version or withdraw it instead of turning it back into a draft`);
        }
        report.drafts++;
      } else if (file.status === 'withdrawn') {
        if (row?.status === 'published') {
          await withdraw(runner, file.id, file.lang);
          report.withdrawn++;
        }
      } else if (!row) {
        await write(runner, file);
        report.inserted++;
      } else if (file.version < row.version) {
        problems.push(`${key}: version ${file.version} is lower than the loaded version ${row.version}`);
      } else if (file.version > row.version) {
        await write(runner, file);
        report.updated++;
      } else if (contentHash(file) !== row.content_hash) {
        problems.push(
          `${key}: changed without a new version; raise version above ${row.version} and write a change note (guides plan §3 rule 7)`,
        );
      } else if (await recheck(runner, file)) {
        report.rechecked++;
      } else {
        report.unchanged++;
      }
    }
    // A text whose file is gone is withdrawn, not deleted: problem reports point at it (ADR 0010).
    for (const row of loaded) {
      if (row.status === 'published' && !inFiles.has(`${row.guide_id}.${row.lang}`)) {
        await withdraw(runner, row.guide_id, row.lang);
        report.withdrawn++;
      }
    }
    if (problems.length) throw new GuideSeedError(problems);
    await runner.commitTransaction();
    return report;
  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
  }
}

async function write(runner: QueryRunner, file: GuideFile): Promise<void> {
  // validateGuideSet has checked that a published file has lastChecked.
  const checked = file.lastChecked!;
  await runner.query(
    `INSERT INTO "guides" ("id", "group") VALUES ($1, $2) ON CONFLICT ("id") DO UPDATE SET "group" = EXCLUDED."group"`,
    [file.id, file.group],
  );
  await runner.query(
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
      checked.on,
      checked.by,
      file.title,
      file.keywords,
      JSON.stringify(contentOf(file)),
      contentHash(file),
    ],
  );
}

/** Same version and content: takes a new last-checked date, and shows the text again if it was withdrawn. True if anything changed. */
async function recheck(runner: QueryRunner, file: GuideFile): Promise<boolean> {
  const checked = file.lastChecked!;
  // A CTE, so the query is a SELECT and returns its rows (TypeORM returns [rows, count] for an UPDATE).
  const [{ n }]: { n: number }[] = await runner.query(
    `WITH changed AS (
       UPDATE "guide_texts" SET "last_checked_on" = $3, "last_checked_by" = $4, "status" = 'published', "updated_at" = now()
       WHERE "guide_id" = $1 AND "lang" = $2
         AND ("last_checked_on", "last_checked_by", "status") IS DISTINCT FROM ($3::date, $4::varchar, 'published'::varchar)
       RETURNING 1)
     SELECT count(*)::int AS n FROM changed`,
    [file.id, file.lang, checked.on, checked.by],
  );
  return n > 0;
}

async function withdraw(runner: QueryRunner, id: string, lang: string): Promise<void> {
  await runner.query(`UPDATE "guide_texts" SET "status" = 'withdrawn', "updated_at" = now() WHERE "guide_id" = $1 AND "lang" = $2`, [
    id,
    lang,
  ]);
}
